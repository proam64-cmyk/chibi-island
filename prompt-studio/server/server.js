/*
 * Anime Game Prompt Studio — optional backend.
 *
 * - Serves the static app (same origin, so the browser never needs CORS or keys).
 * - Proxies AI requests to the Claude API using credentials that exist ONLY in this
 *   process's environment (ANTHROPIC_API_KEY). Keys are never sent to the browser,
 *   written to disk, logged, or included in responses.
 * - Without credentials it still serves the app; /api/status reports "unavailable"
 *   and the app stays in LOCAL mode.
 *
 * Environment variables (all optional):
 *   ANTHROPIC_API_KEY        API key used server-side (or ANTHROPIC_AUTH_TOKEN)
 *   AGPS_ASSUME_CREDENTIALS  "1" to enable AI when the SDK resolves credentials another way (e.g. `ant auth login` profile)
 *   PORT / HOST              default 8787 / 127.0.0.1 (local only)
 *   AGPS_MODELS              comma list of allowed model IDs (default: claude-haiku-5-5,claude-sonnet-5-5,claude-opus-5-5)
 *   AGPS_ACCESS_TOKEN        if set, requests to /api/* must send header X-Studio-Access with this value
 *   AGPS_ALLOWED_ORIGINS     comma list of extra origins allowed to call /api/* (CORS); default same-origin only
 *   AGPS_RATE_LIMIT          AI requests per minute per client IP (default 20)
 *   AGPS_MAX_OUTPUT_TOKENS   upper bound for max_tokens (default 32000)
 *   AGPS_REFUSAL_FALLBACK    "0" to disable server-side refusal fallbacks (default on for Opus 5.5 / Sonnet 5.5)
 *   AGPS_IMAGE_ANALYSIS      "0" to disable the image analysis endpoint
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_PREFIXES = ['css/', 'js/', 'icons/', 'tests/harness.js', 'tests/specs/'];
const PUBLIC_FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const DEFAULT_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];
const EFFORT = { standard: 'low', professional: 'medium', ultra: 'high' };
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function config(env) {
  const list = (v, d) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : d);
  return {
    port: parseInt(env.PORT, 10) || 8787,
    host: env.HOST || '127.0.0.1',
    hasCredentials: !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.AGPS_ASSUME_CREDENTIALS === '1'),
    models: list(env.AGPS_MODELS, DEFAULT_MODELS),
    accessToken: env.AGPS_ACCESS_TOKEN || '',
    origins: list(env.AGPS_ALLOWED_ORIGINS, []),
    rateLimit: parseInt(env.AGPS_RATE_LIMIT, 10) || 20,
    maxOutput: Math.min(128000, parseInt(env.AGPS_MAX_OUTPUT_TOKENS, 10) || 32000),
    fallback: env.AGPS_REFUSAL_FALLBACK !== '0',
    imageAnalysis: env.AGPS_IMAGE_ANALYSIS !== '0',
  };
}

function defaultClientFactory() {
  const Anthropic = require('@anthropic-ai/sdk');
  const C = Anthropic.default || Anthropic;
  const client = new C(); // resolves credentials from the environment; never from the request
  return { client, errors: C };
}

function send(res, status, body, headers) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
  }, headers || {}));
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('request body too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(Object.assign(new Error('invalid JSON body'), { status: 400 })); } });
    req.on('error', reject);
  });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createServer(opts) {
  opts = opts || {};
  const cfg = config(opts.env || process.env);
  let ai = null;
  const getAI = () => (ai || (ai = (opts.clientFactory || defaultClientFactory)()));
  const hits = new Map();

  function rateOk(ip) {
    const now = Date.now(), win = 60000;
    const arr = (hits.get(ip) || []).filter((t) => now - t < win);
    if (arr.length >= cfg.rateLimit) { hits.set(ip, arr); return false; }
    arr.push(now); hits.set(ip, arr); return true;
  }

  function cors(req) {
    const origin = req.headers.origin;
    if (origin && cfg.origins.includes(origin)) return { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Access', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    return {};
  }

  function mapError(e, errors) {
    const E = errors || {};
    const is = (cls) => cls && e instanceof cls;
    if (is(E.AuthenticationError) || is(E.PermissionDeniedError)) return [502, 'The server\'s API credentials were rejected. Check the key configured on the server.'];
    if (is(E.RateLimitError)) return [429, 'The API rate limit was reached. Try again shortly.'];
    if (is(E.NotFoundError)) return [400, 'Model not found or not available to this API key.'];
    if (is(E.BadRequestError)) return [400, 'The API rejected the request: ' + (e.message || 'bad request')];
    if (is(E.APIConnectionError)) return [503, 'Could not reach the API from the server.'];
    if (is(E.APIError)) return [502, 'API error ' + (e.status || '') + ': ' + (e.message || '')];
    return [e.status || 500, e.message || 'server error'];
  }

  async function callModel(params, quality) {
    const { client, errors } = getAI();
    const req = Object.assign({ max_tokens: Math.min(cfg.maxOutput, params.max_tokens || cfg.maxOutput), thinking: { type: 'adaptive' }, output_config: { effort: EFFORT[quality] || 'medium' } }, params);
    req.max_tokens = Math.min(cfg.maxOutput, req.max_tokens);
    let msg;
    if (cfg.fallback && FALLBACK_MODELS.includes(req.model)) {
      msg = await client.beta.messages.stream(Object.assign({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, req)).finalMessage();
    } else {
      msg = await client.messages.stream(req).finalMessage();
    }
    return { msg, errors };
  }

  function extract(msg) {
    if (msg.stop_reason === 'refusal') {
      const d = msg.stop_details || {};
      throw Object.assign(new Error('The model declined this request' + (d.category ? ' (category: ' + d.category + ')' : '') + '. No output was produced.'), { status: 422 });
    }
    const text = (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const usage = msg.usage ? { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens } : null;
    const fallback = (msg.content || []).some((b) => b.type === 'fallback') || ((msg.usage && msg.usage.iterations) || []).some((i) => i.type === 'fallback_message');
    return { text, model: msg.model, usage, stopReason: msg.stop_reason, fallback };
  }

  async function handleApi(req, res, url) {
    const headers = cors(req);
    if (req.method === 'OPTIONS') return send(res, 204, '', headers);
    if (req.headers.origin && !headers['Access-Control-Allow-Origin']) {
      const host = req.headers.host || '';
      try { if (new URL(req.headers.origin).host !== host) return send(res, 403, { error: 'origin not allowed' }); } catch (e) { return send(res, 403, { error: 'origin not allowed' }); }
    }
    if (cfg.accessToken && !safeEqual(req.headers['x-studio-access'] || '', cfg.accessToken)) return send(res, 401, { error: 'access passphrase required' }, headers);

    if (url.pathname === '/api/status' && req.method === 'GET') {
      return send(res, 200, { available: cfg.hasCredentials, reason: cfg.hasCredentials ? '' : 'server has no API credentials configured (set ANTHROPIC_API_KEY on the server)', models: cfg.hasCredentials ? cfg.models : [], imageAnalysis: cfg.hasCredentials && cfg.imageAnalysis }, headers);
    }
    if (req.method !== 'POST' || !['/api/generate', '/api/analyze-image'].includes(url.pathname)) return send(res, 404, { error: 'not found' }, headers);
    if (!cfg.hasCredentials) return send(res, 503, { error: 'AI is not configured on this server (no API credentials). The app works in LOCAL mode.' }, headers);
    const ip = req.socket.remoteAddress || 'unknown';
    if (!rateOk(ip)) return send(res, 429, { error: 'rate limit: too many AI requests per minute' }, headers);

    let errorsRef = null;
    try {
      const body = await readBody(req, 8 * 1024 * 1024);
      if (!cfg.models.includes(body.model)) return send(res, 400, { error: 'model not allowed on this server: ' + String(body.model).slice(0, 60) }, headers);
      if (url.pathname === '/api/generate') {
        const prompt = String(body.prompt || '');
        if (!prompt.trim()) return send(res, 400, { error: 'prompt is empty' }, headers);
        if (prompt.length > 400000) return send(res, 413, { error: 'prompt too large' }, headers);
        const user = [String(body.instruction || 'Improve this prompt.'), body.note ? 'Revision note from the developer: ' + String(body.note).slice(0, 2000) : '', '<compiled_prompt>', prompt, '</compiled_prompt>'].filter(Boolean).join('\n\n');
        const { msg, errors } = await callModel({ model: body.model, system: String(body.system || '').slice(0, 20000), messages: [{ role: 'user', content: user }] }, body.quality);
        errorsRef = errors;
        return send(res, 200, extract(msg), headers);
      }
      if (!cfg.imageAnalysis) return send(res, 404, { error: 'image analysis disabled' }, headers);
      if (!IMAGE_TYPES.includes(body.mediaType)) return send(res, 400, { error: 'unsupported image type' }, headers);
      const b64 = String(body.imageBase64 || '');
      if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length > 7 * 1024 * 1024) return send(res, 400, { error: 'invalid or too large image data' }, headers);
      const instruction = [
        'You are reviewing a character reference image for an anime game production pipeline.',
        'Describe only what is actually visible: silhouette, proportions, face, hairstyle, eye colour, costume layers, weapons/props, dominant colours (approximate hex), art style, pose, background, and any text/watermarks.',
        'If something is unclear or hidden, say so instead of guessing.',
        body.characterSpec ? 'Then compare the image with this written specification and list every discrepancy:\n' + String(body.characterSpec).slice(0, 6000) : '',
        'Output concise Markdown bullet lists.',
      ].filter(Boolean).join('\n');
      const { msg, errors } = await callModel({ model: body.model, max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: body.mediaType, data: b64 } }, { type: 'text', text: instruction }] }] }, 'professional');
      errorsRef = errors;
      return send(res, 200, extract(msg), headers);
    } catch (e) {
      let errs = errorsRef;
      if (!errs) { try { errs = getAI().errors; } catch (x) { errs = null; } }
      const [status, message] = mapError(e, errs);
      if (status >= 500) console.error('[agps] AI request failed:', status, e && e.name);
      return send(res, status, { error: message }, headers);
    }
  }

  function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '') rel = 'index.html';
    const allowed = PUBLIC_FILES.includes(rel) || PUBLIC_PREFIXES.some((p) => rel.startsWith(p));
    const abs = path.resolve(ROOT, rel);
    if (!allowed || !abs.startsWith(ROOT + path.sep) || rel.split('/').some((s) => s.startsWith('.') || s === 'node_modules')) return send(res, 404, 'Not found');
    fs.stat(abs, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(abs)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': rel === 'sw.js' ? 'no-cache' : 'public, max-age=300' });
      fs.createReadStream(abs).pipe(res);
    });
  }

  const server = http.createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, 'bad url'); }
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url).catch((e) => send(res, 500, { error: e.message }));
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url);
  });
  server.config = cfg;
  return server;
}

module.exports = { createServer, config };

if (require.main === module) {
  const server = createServer();
  const cfg = server.config;
  server.listen(cfg.port, cfg.host, () => {
    console.log('Anime Game Prompt Studio: http://' + (cfg.host === '0.0.0.0' ? 'localhost' : cfg.host) + ':' + cfg.port + '/');
    console.log(cfg.hasCredentials ? 'AI enabled. Allowed models: ' + cfg.models.join(', ') : 'AI disabled (no ANTHROPIC_API_KEY in the server environment) — the app runs in LOCAL mode.');
    if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost' && !cfg.accessToken) console.warn('WARNING: listening beyond localhost without AGPS_ACCESS_TOKEN; anyone who can reach this port can spend your API credits.');
  });
}

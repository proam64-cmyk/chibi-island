/* Server tests: static serving, security, API unavailability, routing to a mocked Claude client. */
'use strict';
const { createServer } = require('../server/server.js');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
}
async function req(base, path, opts) {
  const res = await fetch(base + path, opts);
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: res.status, text, json, headers: res.headers };
}
const post = (body, headers) => ({ method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body) });

function mockFactory(calls, behaviour) {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  const make = (params) => ({
    finalMessage: async () => {
      calls.push(params);
      if (behaviour === 'ratelimit') throw new RateLimitError('slow down');
      if (behaviour === 'auth') throw new AuthenticationError('bad key');
      if (behaviour === 'refusal') return { model: params.model, stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] };
      return { model: params.model, stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'IMPROVED PROMPT' }], usage: { input_tokens: 120, output_tokens: 30 } };
    },
  });
  return () => ({ client: { messages: { stream: make }, beta: { messages: { stream: make } } }, errors: { APIError, RateLimitError, AuthenticationError } });
}

module.exports = async function serverTests() {
  const results = [];
  const test = async (name, fn) => {
    try { await fn(); results.push({ suite: 'Server (optional backend)', name, ok: true }); }
    catch (e) { results.push({ suite: 'Server (optional backend)', name, ok: false, error: e.message }); }
  };
  const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

  // 1) no credentials
  const s1 = createServer({ env: {} });
  const b1 = await listen(s1);
  await test('serves the app shell', async () => {
    const r = await req(b1, '/'); assert(r.status === 200 && r.text.includes('Anime Game Prompt Studio'), 'index');
    const js = await req(b1, '/js/engine/compiler.js'); assert(js.status === 200 && /javascript/.test(js.headers.get('content-type')), 'js type');
    assert(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff header');
  });
  await test('blocks path traversal and private folders', async () => {
    for (const p of ['/server/server.js', '/../package.json', '/%2e%2e/%2e%2e/etc/passwd', '/android/capacitor.config.json', '/server/node_modules/x', '/.git/config']) {
      const r = await req(b1, p); assert(r.status === 404, p + ' → ' + r.status);
    }
  });
  await test('reports AI unavailable without credentials', async () => {
    const r = await req(b1, '/api/status'); assert(r.json && r.json.available === false && /no API credentials/.test(r.json.reason), JSON.stringify(r.json));
    const g = await req(b1, '/api/generate', post({ model: 'claude-opus-5-5', prompt: 'x' })); assert(g.status === 503, 'generate 503');
  });
  s1.close();

  // 2) with (fake) credentials and a mocked client
  const calls = [];
  const env = { ANTHROPIC_API_KEY: 'sk-ant-test-not-real-0000000000', AGPS_RATE_LIMIT: '12' };
  const s2 = createServer({ env, clientFactory: mockFactory(calls) });
  const b2 = await listen(s2);
  await test('status lists allowed models and never leaks the key', async () => {
    const r = await req(b2, '/api/status');
    assert(r.json.available === true && r.json.models.includes('claude-opus-5-5'), 'models'); assert(!r.text.includes('sk-ant'), 'no key in response');
  });
  await test('generate routes to the requested model with refusal fallback and adaptive thinking', async () => {
    const r = await req(b2, '/api/generate', post({ model: 'claude-opus-5-5', prompt: 'PROMPT', instruction: 'Improve', quality: 'ultra' }));
    assert(r.status === 200, 'status ' + r.status); assert(r.json.text === 'IMPROVED PROMPT' && r.json.model === 'claude-opus-5-5', JSON.stringify(r.json));
    const c = calls[calls.length - 1];
    assert(c.fallbacks === 'default' && c.betas.includes('server-side-fallback-2026-07-01'), 'fallback params');
    assert(c.thinking.type === 'adaptive' && c.output_config.effort === 'high', 'thinking/effort');
    assert(c.messages[0].content.includes('<compiled_prompt>'), 'prompt wrapped');
  });
  await test('Haiku requests do not send fallback parameters', async () => {
    await req(b2, '/api/generate', post({ model: 'claude-haiku-5-5', prompt: 'P' }));
    const c = calls[calls.length - 1]; assert(!c.fallbacks && !c.betas, 'no fallback for haiku');
  });
  await test('rejects models outside the allowlist and empty prompts', async () => {
    assert((await req(b2, '/api/generate', post({ model: 'gpt-4', prompt: 'x' }))).status === 400, 'model');
    assert((await req(b2, '/api/generate', post({ model: 'claude-haiku-5-5', prompt: '  ' }))).status === 400, 'empty');
    assert((await req(b2, '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status === 400, 'bad json');
  });
  await test('rejects cross-origin calls from unknown origins', async () => {
    const r = await req(b2, '/api/status', { headers: { Origin: 'https://evil.example' } }); assert(r.status === 403, 'status ' + r.status);
  });
  await test('image analysis validates media type and payload', async () => {
    assert((await req(b2, '/api/analyze-image', post({ model: 'claude-sonnet-5-5', mediaType: 'image/tiff', imageBase64: 'AAAA' }))).status === 400, 'type');
    assert((await req(b2, '/api/analyze-image', post({ model: 'claude-sonnet-5-5', mediaType: 'image/png', imageBase64: '<script>' }))).status === 400, 'data');
    const ok = await req(b2, '/api/analyze-image', post({ model: 'claude-sonnet-5-5', mediaType: 'image/png', imageBase64: 'iVBORw0KGgo=' }));
    assert(ok.status === 200 && ok.json.text, 'analysis ok');
    const c = calls[calls.length - 1]; assert(c.messages[0].content[0].type === 'image', 'image block sent');
  });
  await test('rate limits AI requests per client', async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await req(b2, '/api/generate', post({ model: 'claude-haiku-5-5', prompt: 'p' }))).status;
    assert(last === 429, 'expected 429, got ' + last);
  });
  s2.close();

  // 3) access token, refusal and upstream errors
  const s3 = createServer({ env: { ANTHROPIC_API_KEY: 'x', AGPS_ACCESS_TOKEN: 'open-sesame' }, clientFactory: mockFactory([], 'refusal') });
  const b3 = await listen(s3);
  await test('requires the access passphrase when configured', async () => {
    assert((await req(b3, '/api/status')).status === 401, 'no token');
    assert((await req(b3, '/api/status', { headers: { 'X-Studio-Access': 'open-sesame' } })).status === 200, 'token ok');
  });
  await test('model refusals return 422 without fake output', async () => {
    const r = await req(b3, '/api/generate', post({ model: 'claude-opus-5-5', prompt: 'p' }, { 'X-Studio-Access': 'open-sesame' }));
    assert(r.status === 422 && /declined/.test(r.json.error) && !r.json.text, JSON.stringify(r.json));
  });
  s3.close();
  for (const [kind, code] of [['ratelimit', 429], ['auth', 502]]) {
    const s = createServer({ env: { ANTHROPIC_API_KEY: 'x' }, clientFactory: mockFactory([], kind) });
    const b = await listen(s);
    await test('maps upstream ' + kind + ' errors to HTTP ' + code, async () => {
      const r = await req(b, '/api/generate', post({ model: 'claude-sonnet-5-5', prompt: 'p' }));
      assert(r.status === code, 'got ' + r.status); assert(!r.text.includes('stack'), 'no stack');
    });
    s.close();
  }
  return results;
};

/* AI model orchestration: LOCAL / ECONOMY / INTELLIGENT / MAXIMUM QUALITY routing, cost estimates, backend client. */
(function (A) {
  'use strict';
  const U = A.util;
  const R = (A.router = {});

  R.MODES = [
    { id: 'local', label: 'LOCAL', desc: 'Structured prompts compiled offline. No API, no cost.' },
    { id: 'economy', label: 'ECONOMY', desc: 'Cheapest available model for routine work.' },
    { id: 'intelligent', label: 'INTELLIGENT', desc: 'Estimates task complexity and picks an appropriate available model.' },
    { id: 'max', label: 'MAXIMUM QUALITY', desc: 'Prioritises Claude Opus 5.5 for complex tasks; routine tasks still avoid escalation.' },
  ];

  /** Default catalog (USD per million tokens, Anthropic first-party list prices; editable in the AI Models panel). */
  R.DEFAULT_CATALOG = [
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', tier: 'economy', inPrice: 0.1, outPrice: 0.5 },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', tier: 'balanced', inPrice: 2, outPrice: 10 },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', tier: 'premium', inPrice: 4, outPrice: 20 },
  ];
  R.TIERS = ['economy', 'balanced', 'premium'];

  R.OPUS_TASKS = {
    architecture: 'complex software architecture',
    'multi-system': 'multi-system gameplay engineering',
    debugging: 'difficult debugging',
    'continuity-analysis': 'large project continuity analysis',
    'asset-pipeline': 'cross-tool asset pipeline design',
    'extensive-spec': 'extensive implementation specification',
    'android-failure': 'Android packaging failure investigation',
  };
  R.ROUTINE_TASKS = { formatting: 'basic formatting', copy: 'copying', template: 'simple template', metadata: 'routine metadata' };

  R.estimate = function (model, inputTokens, outputTokens) {
    if (!model) return { inputTokens, outputTokens, cost: 0 };
    const cost = (inputTokens / 1e6) * model.inPrice + (outputTokens / 1e6) * model.outPrice;
    return { inputTokens, outputTokens, cost };
  };

  R.outputGuess = function (inputTokens, quality) {
    const base = { 1: 2000, 2: 4000, 3: 8000 }[quality || 2] || 4000;
    return Math.min(32000, Math.max(base, Math.round(inputTokens * 1.2)));
  };

  R.score = function (task) {
    let s = task.complexity != null ? task.complexity : 40;
    const why = ['base complexity ' + s];
    if (R.OPUS_TASKS[task.taskType]) { s += 15; why.push('+15 ' + R.OPUS_TASKS[task.taskType]); }
    if (R.ROUTINE_TASKS[task.taskType] || task.routine) { s -= 35; why.push('−35 routine task'); }
    if (task.inputTokens > 20000) { s += 10; why.push('+10 large input'); }
    if (task.quality === 3) { s += 5; why.push('+5 ultra detail'); }
    return { score: U.clamp(Math.round(s), 0, 100), why };
  };

  function pickTier(avail, tier) {
    const order = R.TIERS.indexOf(tier);
    for (let i = order; i >= 0; i--) { const m = avail.find((x) => x.tier === R.TIERS[i]); if (m) return { model: m, downgraded: i !== order }; }
    for (let i = order + 1; i < R.TIERS.length; i++) { const m = avail.find((x) => x.tier === R.TIERS[i]); if (m) return { model: m, downgraded: false, upgraded: true }; }
    return { model: null };
  }

  /**
   * route({mode, task:{taskType, complexity, routine, inputTokens, quality}, catalog, server:{available, models}, manualModel})
   * → {local, model, reason[], estimate}
   */
  R.route = function (args) {
    const mode = args.mode || 'local';
    const task = args.task || {};
    const catalog = (args.catalog && args.catalog.length ? args.catalog : R.DEFAULT_CATALOG);
    const server = args.server || { available: false };
    const reason = [];
    const local = (msg) => ({ local: true, model: null, reason: reason.concat([msg]), estimate: R.estimate(null, task.inputTokens || 0, 0) });
    if (mode === 'local') return local('LOCAL mode: the prompt is compiled offline; copy it into any tool manually. No model is called.');
    if (!server.available) return local('AI backend unavailable (' + (server.error || 'no server credentials configured') + '). Falling back to LOCAL: the compiled prompt is ready to copy. No model was called.');
    const avail = catalog.filter((m) => !server.models || server.models.includes(m.id));
    if (!avail.length) return local('None of the catalog models are enabled on the server. Falling back to LOCAL.');
    const inTok = task.inputTokens || 0;
    const outTok = R.outputGuess(inTok, task.quality);
    const sc = R.score(task);
    let model, tierWanted;
    if (args.manualModel) {
      model = avail.find((m) => m.id === args.manualModel);
      if (model) reason.push('Manually selected: ' + model.label + '.');
      else reason.push('Manually selected model "' + args.manualModel + '" is not available on the server; choosing automatically.');
    }
    if (!model) {
      if (mode === 'economy') {
        model = avail.slice().sort((a, b) => a.inPrice + a.outPrice - (b.inPrice + b.outPrice))[0];
        reason.push('ECONOMY: cheapest available model (' + model.label + ').');
      } else if (mode === 'intelligent') {
        tierWanted = sc.score < 35 ? 'economy' : sc.score < 70 ? 'balanced' : 'premium';
        const p = pickTier(avail, tierWanted); model = p.model;
        reason.push('INTELLIGENT: complexity score ' + sc.score + '/100 (' + sc.why.join(', ') + ') → ' + tierWanted + ' tier → ' + model.label + (p.downgraded ? ' (preferred tier unavailable; using next lower)' : '') + '.');
      } else {
        const routine = R.ROUTINE_TASKS[task.taskType] || task.routine;
        if (routine) {
          tierWanted = 'balanced';
          const p = pickTier(avail, tierWanted); model = p.model;
          reason.push('MAXIMUM QUALITY, but this is a routine task (' + (R.ROUTINE_TASKS[task.taskType] || 'routine') + '): avoiding unnecessary escalation to Opus → ' + model.label + '.');
        } else {
          const opus = avail.find((m) => m.id === 'claude-opus-5-5') || pickTier(avail, 'premium').model;
          model = opus;
          reason.push('MAXIMUM QUALITY: ' + (R.OPUS_TASKS[task.taskType] ? R.OPUS_TASKS[task.taskType] : 'complex production prompt') + ' → ' + model.label + (model.id === 'claude-opus-5-5' ? ' (Opus 5.5 prioritised).' : ' (Opus 5.5 not enabled on the server; best available).'));
        }
      }
    }
    const estimate = R.estimate(model, inTok, outTok);
    reason.push('Estimated usage: ~' + inTok.toLocaleString('en-US') + ' input + up to ~' + outTok.toLocaleString('en-US') + ' output tokens ≈ ' + U.money(estimate.cost) + ' at catalog prices (estimate only; actual usage is reported after the call).');
    return { local: false, model, reason, estimate, score: sc.score };
  };

  /* ---------------- Backend client (browser fetch; keys live only on the server) ---------------- */
  const ai = (A.ai = {});
  function base(url) { return (url || '').replace(/\/+$/, ''); }
  async function call(url, path, body, timeoutMs, accessToken) {
    if (typeof fetch === 'undefined') throw new Error('fetch is not available');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 8000) : null;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers['X-Studio-Access'] = accessToken;
      const res = await fetch(base(url) + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl ? ctrl.signal : undefined });
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) throw new Error((data && data.error) || 'HTTP ' + res.status);
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('request timed out');
      throw e;
    } finally { if (t) clearTimeout(t); }
  }
  ai.status = async function (url, accessToken) {
    if (typeof location !== 'undefined' && location.protocol === 'file:' && !url) return { available: false, error: 'opened from file:// — start the optional server to enable AI' };
    try {
      const d = await call(url, '/api/status', null, 4000, accessToken);
      return { available: !!(d && d.available), models: (d && d.models) || [], imageAnalysis: !!(d && d.imageAnalysis), error: d && !d.available ? d.reason || 'server has no API credentials configured' : '' };
    } catch (e) {
      return { available: false, models: [], error: 'backend not reachable: ' + e.message };
    }
  };
  ai.generate = (url, payload, accessToken) => call(url, '/api/generate', payload, 600000, accessToken);
  ai.analyzeImage = (url, payload, accessToken) => call(url, '/api/analyze-image', payload, 300000, accessToken);

  R.ACTIONS = {
    enhance: 'Improve this compiled prompt for the target tool: make it clearer, more precise and better structured. Keep every constraint.',
    expand: 'Expand this prompt with additional useful technical precision (edge cases, specifications, checks). No filler or repetition.',
    refine: 'Refine this prompt according to the revision note. Keep everything else.',
    correct: 'Find and fix contradictions, ambiguities, missing acceptance criteria and tool-syntax errors in this prompt.',
  };

  R.systemPrompt = function (meta) {
    return [
      'You are an expert prompt engineer for anime game production pipelines (image generation, Meshy 3D, coding assistants, Android release).',
      'You receive a prompt compiled by Anime Game Prompt Studio for the target tool "' + (meta.toolLabel || meta.tool) + '".',
      'Return ONLY the improved prompt as Markdown, ready to paste into that tool. Do not add commentary before or after it.',
      'Hard rules:',
      '- Preserve every character ID, character lock, palette value, forbidden change and reference statement exactly.',
      '- Never claim that images, files or source code were seen or analysed unless the prompt states an analysis is on record.',
      '- Respect the target tool syntax (e.g. Midjourney parameters only for Midjourney; separate negative prompt fields only where the tool has them).',
      '- For existing projects, never instruct a rewrite or replacement of working systems.',
      '- Do not invent engine features, store rules or API parameters; mark anything uncertain as "verify".',
      '- Write the prompt in English.',
    ].join('\n');
  };
})(globalThis.AGPS = globalThis.AGPS || {});

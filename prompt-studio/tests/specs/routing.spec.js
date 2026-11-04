/* Model orchestration: modes, fallback, routing decisions, cost estimates, backend unavailability. */
(function (A) {
  'use strict';
  const H = A.testHarness, R = A.router;
  const ALL = { available: true, models: R.DEFAULT_CATALOG.map((m) => m.id) };
  const route = (mode, task, server, manual) => R.route({ mode, task: Object.assign({ inputTokens: 3000, quality: 2 }, task), catalog: R.DEFAULT_CATALOG, server: server || ALL, manualModel: manual });

  H.describe('Model routing', (it) => {
    it('LOCAL never selects a model', () => {
      const r = route('local', { taskType: 'architecture', complexity: 90 });
      H.assert(r.local); H.eq(r.model, null); H.eq(r.estimate.cost, 0);
    });
    it('falls back to LOCAL when the backend is unavailable and says so', () => {
      const r = route('max', { taskType: 'architecture', complexity: 90 }, { available: false, error: 'backend not reachable: refused' });
      H.assert(r.local); H.includes(r.reason.join(' '), 'Falling back to LOCAL'); H.includes(r.reason.join(' '), 'No model was called');
    });
    it('falls back to LOCAL when no catalog model is enabled on the server', () => {
      H.assert(route('economy', {}, { available: true, models: ['some-other-model'] }).local);
    });
    it('ECONOMY picks the cheapest available model', () => {
      H.eq(route('economy', { taskType: 'architecture', complexity: 95 }).model.id, 'claude-haiku-5-5');
    });
    it('INTELLIGENT scales with complexity', () => {
      H.eq(route('intelligent', { taskType: 'template', complexity: 10 }).model.id, 'claude-haiku-5-5');
      H.eq(route('intelligent', { taskType: 'image-prompt', complexity: 40 }).model.id, 'claude-sonnet-5-5');
      H.eq(route('intelligent', { taskType: 'multi-system', complexity: 75 }).model.id, 'claude-opus-5-5');
    });
    it('MAXIMUM QUALITY prioritises Opus 5.5 for complex tasks', () => {
      ['architecture', 'multi-system', 'debugging', 'continuity-analysis', 'asset-pipeline', 'android-failure'].forEach((tt) => {
        const r = route('max', { taskType: tt, complexity: 60 });
        H.eq(r.model.id, 'claude-opus-5-5', tt); H.includes(r.reason.join(' '), 'Opus 5.5 prioritised');
      });
    });
    it('MAXIMUM QUALITY avoids escalation for routine tasks', () => {
      ['formatting', 'copy', 'template', 'metadata'].forEach((tt) => {
        const r = route('max', { taskType: tt, complexity: 10 });
        H.assert(r.model.id !== 'claude-opus-5-5', tt); H.includes(r.reason.join(' '), 'avoiding unnecessary escalation');
      });
    });
    it('uses the best available model when Opus is not enabled', () => {
      const r = route('max', { taskType: 'architecture', complexity: 80 }, { available: true, models: ['claude-sonnet-5-5', 'claude-haiku-5-5'] });
      H.eq(r.model.id, 'claude-sonnet-5-5'); H.includes(r.reason.join(' '), 'not enabled on the server');
    });
    it('honours manual selection and recovers from an unknown one', () => {
      H.eq(route('economy', {}, null, 'claude-opus-5-5').model.id, 'claude-opus-5-5');
      const r = route('economy', {}, null, 'gpt-x');
      H.eq(r.model.id, 'claude-haiku-5-5'); H.includes(r.reason.join(' '), 'not available');
    });
    it('estimates cost from catalog prices', () => {
      const e = R.estimate({ inPrice: 4, outPrice: 20 }, 1e6, 5e5);
      H.eq(Math.round(e.cost * 100) / 100, 14);
      const r = route('max', { taskType: 'architecture', complexity: 80, inputTokens: 10000 });
      H.assert(r.estimate.cost > 0); H.includes(r.reason.join(' '), 'estimate only');
    });
    it('system prompt forbids false analysis claims and rewrites', () => {
      const s = R.systemPrompt({ toolLabel: 'Midjourney' });
      H.includes(s, 'Never claim that images'); H.includes(s, 'never instruct a rewrite'); H.includes(s, 'Midjourney');
    });
    it('backend status reports unavailability instead of throwing', async () => {
      const s = await A.ai.status('http://127.0.0.1:9');
      H.eq(s.available, false); H.assert(s.error.length > 0);
    });
  });
})(globalThis.AGPS = globalThis.AGPS || {});

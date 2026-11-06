/* Node test runner: unit/integration specs (same as the in-app QA page) + server tests. */
'use strict';
const path = require('path');
const load = require('./load');
const A = load(['tests/harness.js', 'tests/specs/core.spec.js', 'tests/specs/prompts.spec.js', 'tests/specs/routing.spec.js']);
const serverTests = require('./server.test.js');

(async () => {
  await A.storage.init({ forceMemory: true });
  const res = await A.testHarness.run();
  const srv = await serverTests();
  // JSON Schemas must stay in sync with the runtime enums.
  const fs = require('fs');
  const schema = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', n), 'utf8'));
  const sync = [];
  const chk = (name, fn) => { try { fn(); sync.push({ suite: 'JSON Schemas', name, ok: true }); } catch (e) { sync.push({ suite: 'JSON Schemas', name, ok: false, error: e.message }); } };
  const same = (a, b, what) => { if (JSON.stringify(a.slice().sort()) !== JSON.stringify(b.slice().sort())) throw new Error(what + ' differ: ' + a + ' vs ' + b); };
  chk('character age categories match', () => same(schema('character.schema.json').properties.ageCategory.enum, A.schema.AGE_CATEGORIES.map((x) => x.id), 'age'));
  chk('asset roles and approval states match', () => { const s = schema('asset.schema.json').properties; same(s.role.enum, A.schema.ASSET_ROLES, 'roles'); same(s.approval.enum, A.schema.APPROVAL, 'approval'); same(s.workflowStage.enum.filter(Boolean), A.schema.WORKFLOW_STAGES.map((x) => x.id), 'stages'); });
  chk('genres and render modes match', () => { const s = schema('project.schema.json').properties.project.properties.profile.properties; same(s.genre.enum, A.schema.GENRES.map((g) => g.id), 'genres'); same(s.renderMode.enum, A.schema.RENDER_MODES, 'render'); });
  chk('stage kinds match', () => same(schema('project.schema.json').properties.project.properties.stages.items.properties.kind.enum, A.schema.STAGE_KINDS.map((k) => k.id), 'stage kinds'));
  chk('exported presets carry the declared format and version', () => { const e = JSON.parse(A.schema.exportProject(A.presets.create('kodama-last-branch'))); if (e.format !== schema('project.schema.json').properties.format.const || e.schemaVersion !== 1) throw new Error('format'); });
  const all = res.results.concat(srv, sync);
  let suite = '';
  all.forEach((r) => {
    if (r.suite !== suite) { suite = r.suite; console.log('\n' + suite); }
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : '\n      ' + r.error));
  });
  const failed = all.filter((r) => !r.ok).length;
  console.log('\n' + (all.length - failed) + ' passed, ' + failed + ' failed (' + all.length + ' total)');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

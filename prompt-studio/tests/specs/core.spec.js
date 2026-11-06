/* Core: utilities, schema validation, import/export, storage, presets, templates. */
(function (A) {
  'use strict';
  const FAKE = ['sk', 'ant', 'api03'].join('-') + '-'; // built at runtime so bundles contain no key-shaped literal
  const H = A.testHarness, U = A.util, S = A.schema;

  H.describe('Utilities', (it) => {
    it('diffLines marks added and removed lines', () => {
      const d = U.diffLines('a\nb\nc', 'a\nc\nd');
      H.eq(d.filter((x) => x.op === 'del').map((x) => x.text).join(), 'b');
      H.eq(d.filter((x) => x.op === 'add').map((x) => x.text).join(), 'd');
    });
    it('renderTemplate fills values and marks missing ones', () => {
      const out = U.renderTemplate('{{a.b}} / {{a.c}}', { a: { b: 'X' } });
      H.eq(out, 'X / [MISSING: a.c]');
    });
    it('list / slug / hexOk', () => {
      H.eq(U.list('a, b;c\n d').length, 4);
      H.eq(U.slug('KODAMA: The Last Branch!'), 'kodama-the-last-branch');
      H.assert(U.hexOk('#fff') && U.hexOk('#A1B2C3') && !U.hexOk('red') && !U.hexOk('#12345'));
    });
  });

  H.describe('Schema & validation', (it) => {
    it('creates a new project with defaults', () => {
      const p = S.createProject('new');
      H.eq(p.mode, 'new'); H.eq(p.schemaVersion, S.SCHEMA_VERSION); H.assert(Array.isArray(p.characters));
      H.eq(p.profile.targetFps, 60);
    });
    it('rejects invalid character fields', () => {
      const p = S.createProject('new');
      const c = S.createCharacter({ name: '', id: 'x', palette: ['#zzz', 'red', '#123456'] });
      p.characters.push(c);
      const v = S.validateCharacter(c, p);
      H.assert(v.errors.some((e) => /name is required/i.test(e)), 'name error');
      H.assert(v.errors.some((e) => /Character ID/.test(e)), 'id error');
      H.assert(v.errors.some((e) => /#zzz/.test(e) && /red/.test(e)), 'palette error');
    });
    it('rejects out-of-range FPS and duplicate IDs', () => {
      const p = S.createProject('new');
      p.profile.targetFps = 999;
      p.characters.push(S.createCharacter({ id: 'DUP-1', name: 'A' }), S.createCharacter({ id: 'DUP-1', name: 'B' }));
      const v = S.validateProject(p);
      H.assert(v.errors.some((e) => /FPS/.test(e)));
      H.assert(v.errors.some((e) => /Duplicate character ID/.test(e)));
    });
    it('normalises garbage input safely', () => {
      const p = S.normalizeProject({ profile: { subgenres: 'a, b', targetFps: 'abc', renderMode: '4D' }, characters: [{ name: 'X', palette: '#fff,#000' }], assets: [{ role: 'nope', approval: 'maybe' }], history: [null, { text: 'ok' }] });
      H.eq(p.profile.subgenres.length, 2); H.eq(p.profile.targetFps, 60); H.eq(p.profile.renderMode, '2D');
      H.eq(p.characters[0].palette.length, 2); H.eq(p.assets[0].role, 'other'); H.eq(p.assets[0].approval, 'draft'); H.eq(p.history.length, 1);
    });
    it('validates asset URLs and links', () => {
      const p = S.createProject('new');
      const a = S.createAsset({ name: 'x', publicUrl: 'http://insecure', characterId: 'NOPE' });
      const v = S.validateAsset(a, p);
      H.assert(v.errors.some((e) => /https/.test(e))); H.assert(v.errors.some((e) => /character not found/i.test(e)));
    });
    it('marks minors and adds a warning', () => {
      const c = S.createCharacter({ name: 'Kid', ageCategory: 'child' });
      H.assert(S.isMinor(c));
      H.assert(S.validateCharacter(c).warnings.some((w) => /non-sexualisation/.test(w)));
    });
  });

  H.describe('Export & import', (it) => {
    it('round-trips a project through JSON', () => {
      const p = A.presets.create('anime-war-arcade');
      p.history.push({ id: 'V1', text: 'hello', category: 'image', action: 'generate' });
      const json = S.exportProject(p);
      const r = S.importProject(json, []);
      H.eq(r.errors.length, 0, 'errors'); H.eq(r.project.id, p.id); H.eq(r.project.characters.length, 4); H.eq(r.project.history[0].text, 'hello');
    });
    it('strips API keys from exports', () => {
      const p = S.createProject('new');
      p.apiKey = FAKE + 'SECRETSECRETSECRET';
      p.profile.notes = 'my key is ' + FAKE + 'ABCDEFGHIJKLMNOP';
      const json = S.exportProject(p);
      H.excludes(json, FAKE); H.excludes(json, '"apiKey"');
      H.includes(json, '[REDACTED-SECRET]');
    });
    it('keeps non-secret keys such as maxTokens', () => {
      const o = S.stripSecrets({ maxTokens: 5, nested: { api_key: 'x', fine: 1 } });
      H.eq(o.maxTokens, 5); H.eq(o.nested.fine, 1); H.eq(o.nested.api_key, undefined);
    });
    it('gives readable errors for invalid files', () => {
      H.throws(() => S.importProject('{not json'), /not valid JSON/);
      H.throws(() => S.importProject('[1,2]'), /does not contain a project/);
      H.throws(() => S.importProject('{"foo":1}'), /not an Anime Game Prompt Studio project/);
      H.throws(() => S.importProject(JSON.stringify({ format: 'agps-project', schemaVersion: 99, project: { profile: {} } })), /newer studio version/);
    });
    it('renames imported projects whose ID already exists', () => {
      const p = S.createProject('new', { name: 'Same' });
      const r = S.importProject(S.exportProject(p), [p.id]);
      H.assert(r.project.id !== p.id); H.includes(r.project.name, '(imported)');
    });
  });

  H.describe('Storage', (it) => {
    it('persists, lists and deletes projects (isolated memory backend)', async () => {
      const St = A.storage, saved = St.backend;
      St.backend = St.memoryBackend();
      try {
        const a = S.createProject('new', { name: 'A' }), b = S.createProject('existing', { name: 'B' });
        await St.putProject(a); await St.putProject(b);
        H.eq((await St.listProjects()).length, 2);
        const got = await St.getProject(a.id); H.eq(got.name, 'A');
        got.name = 'A2'; H.eq((await St.getProject(a.id)).name, 'A', 'stored copy is isolated from mutations');
        await St.deleteProject(a.id); H.eq((await St.listProjects()).length, 1);
        await St.setSetting('k', { v: 1, apiKey: FAKE + 'xxxxxxxxxxxx' });
        const s = await St.getSetting('k'); H.eq(s.v, 1); H.eq(s.apiKey, undefined, 'secrets never persisted');
        H.eq(await St.getSetting('missing', 'def'), 'def');
      } finally { St.backend = saved; }
    });
  });

  H.describe('Preset profiles', (it) => {
    it('both presets load and validate', () => {
      ['anime-war-arcade', 'kodama-last-branch'].forEach((id) => {
        const p = A.presets.create(id);
        H.eq(S.validateProject(p).errors.length, 0, id); H.assert(p.isSample, id + ' flagged as sample'); H.includes(p.sampleNotice, 'No ');
      });
    });
    it('Anime War Arcade has four pilots; KODAMA is an existing-game profile', () => {
      const a = A.presets.create('anime-war-arcade'), k = A.presets.create('kodama-last-branch');
      H.eq(a.characters.length, 4); H.eq(a.profile.genre, 'shmup'); H.eq(k.mode, 'existing'); H.includes(k.existing.workingSystems, 'Gust dash');
    });
    it('profiles never mix characters or systems', () => {
      const a = A.presets.create('anime-war-arcade'), k = A.presets.create('kodama-last-branch');
      const aText = A.compiler.compile(A.categories.buildSpec('gameplay', a, {}).spec, 'ultra').text;
      const kText = A.compiler.compile(A.categories.buildSpec('gameplay', k, {}).spec, 'ultra').text;
      k.characters.forEach((c) => H.excludes(aText, c.name, 'AWA prompt'));
      a.characters.forEach((c) => H.excludes(kText, c.name, 'KODAMA prompt'));
    });
    it('creating a preset twice yields independent projects', () => {
      const x = A.presets.create('anime-war-arcade'), y = A.presets.create('anime-war-arcade');
      H.assert(x.id !== y.id); x.characters[0].name = 'Changed'; H.eq(y.characters[0].name, 'Kaede Hoshino');
    });
  });

  H.describe('Templates', (it) => {
    it('fills built-in templates from project data', () => {
      const p = A.presets.create('anime-war-arcade');
      const tpl = A.templates.BUILTIN.find((t) => t.id === 'tpl-character-quick');
      const out = A.templates.render(tpl, p, 'AWA-REN');
      H.includes(out, 'Ren Takamine'); H.includes(out, 'ice blue'); H.excludes(out, '[MISSING');
    });
    it('flags unfilled placeholders via the checker', () => {
      const p = S.createProject('new');
      const out = A.templates.render(A.templates.BUILTIN.find((t) => t.id === 'tpl-store-listing'), p);
      H.includes(out, '[MISSING: profile.title]');
      H.assert(A.compiler.lint(out, {}).some((i) => i.id === 'placeholder'));
    });
    it('fromText replaces the title with a placeholder', () => {
      const p = A.presets.create('anime-war-arcade');
      H.includes(A.templates.fromText('Build Anime War Arcade now', p), '{{profile.title}}');
    });
  });
})(globalThis.AGPS = globalThis.AGPS || {});

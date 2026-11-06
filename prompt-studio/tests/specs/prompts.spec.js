/* Prompt generation: all categories, provider formatting, continuity, references, Meshy, gameplay, safety, Android, compiler. */
(function (A) {
  'use strict';
  const FAKE = ['sk', 'ant', 'api03'].join('-') + '-'; // built at runtime so bundles contain no key-shaped literal
  const H = A.testHarness, K = A.categories, P = A.compiler, S = A.schema;
  const gen = (cat, p, o, q) => { const r = K.buildSpec(cat, p, Object.assign({ quality: q || 'professional' }, o || {})); if (r.error) throw new Error(cat + ': ' + r.error); return P.compile(r.spec, q || 'professional').text; };
  const awa = () => A.presets.create('anime-war-arcade');
  const kdm = () => A.presets.create('kodama-last-branch');

  H.describe('Prompt generation', (it) => {
    it('every workbench generates at every quality for both presets without checker errors', () => {
      [awa(), kdm()].forEach((p) => K.LIST.forEach((cat) => P.QUALITY_NAMES.forEach((q) => {
        const r = K.buildSpec(cat.id, p, { quality: q, characterId: p.characters[0].id });
        H.assert(!r.error, cat.id + ' ' + q + ': ' + r.error);
        const c = P.compile(r.spec, q);
        const errs = P.lint(c.text, K.lintContext(p, r.spec)).filter((i) => i.severity === 'error');
        H.eq(errs.map((e) => e.id).join(','), '', p.name + ' / ' + cat.id + ' / ' + q);
        P.REQUIRED.forEach((k) => H.assert(c.sections[k] || cat.id === 'image' && k === 'questions', cat.id + ' missing section ' + k));
      })));
    });
    it('ULTRA adds content beyond PROFESSIONAL, which adds beyond STANDARD', () => {
      const p = awa();
      K.LIST.forEach((cat) => {
        const len = (q) => gen(cat.id, p, { characterId: p.characters[0].id }, q).length;
        const s = len('standard'), pr = len('professional'), u = len('ultra');
        H.assert(pr >= s, cat.id + ' professional >= standard'); H.assert(u > pr, cat.id + ' ultra > professional (' + u + ' vs ' + pr + ')');
      });
    });
    it('a fresh project with no data still generates honest prompts', () => {
      const p = S.createProject('new');
      ['planning', 'gameplay', 'testing', 'android'].forEach((c) => H.assert(gen(c, p).length > 500, c));
      H.includes(gen('planning', p), 'What is the game title?');
    });
  });

  H.describe('Image provider adapters', (it) => {
    const opts = { assetType: 'master-sheet', characterId: 'AWA-KAEDE' };
    it('Midjourney uses one-line prompt with --ar, --niji and --no', () => {
      const t = gen('image', awa(), Object.assign({ provider: 'midjourney' }, opts));
      H.match(t, /--ar 16:9/); H.match(t, /--niji 6/); H.match(t, /--no [^\n]*speech bubble/); H.match(t, /--stylize 100/);
      H.excludes(t, 'Avoid:');
    });
    it('Midjourney V7 tileset adds --tile and --v 7', () => {
      const t = gen('image', awa(), { provider: 'midjourney', assetType: 'tileset', mjModel: 'v 7' });
      H.match(t, /--v 7/); H.match(t, /--tile/);
    });
    it('ChatGPT Image uses prose, supported sizes and no Midjourney syntax', () => {
      const t = gen('image', awa(), Object.assign({ provider: 'chatgpt-image' }, opts));
      H.includes(t, 'Avoid:'); H.includes(t, '1536×1024'); H.excludes(t, '--ar'); H.excludes(t, '--no ');
    });
    it('Gemini states the aspect ratio in words', () => {
      const t = gen('image', awa(), Object.assign({ provider: 'gemini-image' }, opts));
      H.includes(t, 'Aspect ratio: 16:9.'); H.excludes(t, '--ar');
    });
    it('Leonardo separates prompt and negative prompt and respects the length limit', () => {
      const t = gen('image', awa(), Object.assign({ provider: 'leonardo' }, opts), 'ultra');
      H.includes(t, 'Prompt field'); H.includes(t, 'Negative prompt field');
      H.assert(P.firstCodeBlock(t).length <= 1000, 'prompt ≤ 1000 chars');
      H.match(t, /Dimensions: \d+ × \d+ px/);
    });
    it('custom providers use their configured syntax', () => {
      const settings = { customProviders: [{ id: 'sd', label: 'SD WebUI', style: 'tags', negative: 'field', aspectSyntax: '[ar {w}x{h}]', maxChars: 2000 }] };
      const r = K.buildSpec('image', awa(), Object.assign({ provider: 'sd' }, opts), settings);
      const t = P.compile(r.spec, 'professional').text;
      H.includes(t, '[ar 16x9]'); H.includes(t, 'Negative prompt'); H.includes(t, 'SD WebUI');
    });
    it('parallax generates one block per layer', () => {
      const t = gen('image', awa(), { provider: 'midjourney', assetType: 'parallax' });
      H.eq((t.match(/Layer: /g) || []).length, 4);
    });
    it('character asset types require a character', () => {
      const r = K.buildSpec('image', awa(), { assetType: 'expressions', characterId: '' });
      H.match(r.error, /needs a registered character/);
    });
    it('clean-art option adds negatives and constraints', () => {
      const t = gen('image', awa(), { provider: 'leonardo', assetType: 'title-screen' });
      H.includes(t, 'speech bubble'); H.includes(t, 'no dialogue');
    });
  });

  H.describe('Character continuity & references', (it) => {
    it('every character prompt carries the full continuity lock', () => {
      const p = awa();
      p.characters.forEach((c) => ['chatgpt-image', 'gemini-image', 'midjourney', 'leonardo'].forEach((prov) => {
        const t = gen('image', p, { provider: prov, assetType: 'concept', characterId: c.id });
        H.includes(t, c.id, prov); H.includes(t, c.eyeColor, prov); H.includes(t, 'FORBIDDEN changes: ' + c.forbiddenChanges, prov);
        c.palette.forEach((hex) => H.includes(t, hex, prov + ' palette'));
      }));
    });
    it('states honestly when no master reference exists', () => {
      const t = gen('image', awa(), { provider: 'chatgpt-image', assetType: 'expressions', characterId: 'AWA-MIO' });
      H.includes(t, 'No master reference image is registered for Mio Arakawa'); H.includes(t, 'Do not assume one exists');
      H.includes(t, 'No approved master exists yet');
    });
    it('registered but unanalysed references are not described as seen', () => {
      const p = awa();
      const a = S.createAsset({ name: 'Kaede master', role: 'character-master', characterId: 'AWA-KAEDE', approval: 'approved', fileName: 'kaede.png' });
      p.assets.push(a);
      const t = gen('image', p, { provider: 'chatgpt-image', assetType: 'combat-poses', characterId: 'AWA-KAEDE' });
      H.includes(t, a.id); H.includes(t, 'have NOT been analysed'); H.includes(t, 'Attach the approved master');
    });
    it('Midjourney references use the approved public URL', () => {
      const p = awa();
      p.assets.push(S.createAsset({ name: 'Ren master', role: 'character-master', characterId: 'AWA-REN', approval: 'approved', publicUrl: 'https://cdn.example.org/ren.png' }));
      H.match(gen('image', p, { provider: 'midjourney', assetType: 'concept', characterId: 'AWA-REN', mjModel: 'niji 6' }), /--cref https:\/\/cdn\.example\.org\/ren\.png --cw 100/);
      H.match(gen('image', p, { provider: 'midjourney', assetType: 'concept', characterId: 'AWA-REN', mjModel: 'v 7' }), /--oref https:\/\/cdn\.example\.org\/ren\.png --ow 100/);
    });
    it('analysed references cite the stored analysis', () => {
      const p = awa();
      p.assets.push(S.createAsset({ name: 'Sora', role: 'character-master', characterId: 'AWA-SORA', approval: 'approved', analyzed: true, analysis: { model: 'claude-opus-5-5', at: 'now', text: 'Scar visible over right eyebrow.' } }));
      p.assets = p.assets.map(S.normalizeAsset);
      H.includes(gen('image', p, { assetType: 'concept', characterId: 'AWA-SORA' }), 'AI analysis on record (claude-opus-5-5)');
    });
    it('minor characters always get the non-sexualised constraint', () => {
      const p = S.createProject('new');
      p.characters.push(S.createCharacter({ id: 'KID-01', name: 'Hana', ageCategory: 'teen', eyeColor: 'brown', hairstyle: 'twin tails', costume: 'school-style adventurer uniform' }));
      ['chatgpt-image', 'midjourney', 'leonardo'].forEach((prov) => {
        const t = gen('image', p, { provider: prov, assetType: 'concept', characterId: 'KID-01' });
        H.includes(t, 'non-sexualised', prov);
      });
    });
  });

  H.describe('Meshy 3D Studio', (it) => {
    it('recommends mobile-appropriate polygon budgets', () => {
      H.assert(A.meshy.recommend('character', 'android-mid').trisMax <= 12000);
      H.assert(A.meshy.recommend('character', 'android-low').trisMax <= 6000);
      H.assert(A.meshy.recommend('character', 'desktop-web').trisMax > A.meshy.recommend('character', 'android-high').trisMax);
    });
    it('full pipeline covers all ten steps and both checklists', () => {
      const t = gen('meshy', awa(), { characterId: 'AWA-KAEDE' });
      ['1–3. Creation', '4. Mesh refinement', '5. Retopology', '6. UV mapping', '7. Material preparation', '8. Character rigging', '9. Animation preparation', '10. Export', 'Quality inspection checklist', 'Export checklist', 'Game integration prompt for Claude']
        .forEach((s) => H.includes(t, s));
      H.includes(t, 'not a finished game asset');
    });
    it('Meshy text prompt stays within the length limit', () => {
      const t = gen('meshy', awa(), { characterId: 'AWA-SORA', includeWeapon: true }, 'ultra');
      H.assert(P.firstCodeBlock(t).length <= A.meshy.MESHY_PROMPT_LIMIT);
    });
    it('multi-view mode demands consistent orthographic references and flags missing approval', () => {
      const t = gen('meshy', awa(), { characterId: 'AWA-REN', mode: 'multi-view' });
      H.includes(t, 'front, side (profile) and back orthographic views'); H.includes(t, 'No approved reference image is registered');
    });
    it('respects custom poly target, texture size and Godot integration', () => {
      const t = gen('meshy', kdm(), { characterId: 'KDM-KODAMA', polyTarget: 4000, texture: '512', format: 'glb' });
      H.includes(t, '≤ 4,000 triangles'); H.includes(t, '512 × 512'); H.includes(t, 'Godot 4');
    });
    it('static props skip rigging steps', () => {
      const t = gen('meshy', awa(), { subjectType: 'prop', description: 'energy cell canister', rig: 'none' });
      H.excludes(t, '8. Character rigging'); H.includes(t, 'no armature');
    });
  });

  H.describe('Gameplay engineering', (it) => {
    it('includes all requirement categories for each subsystem', () => {
      const t = gen('gameplay', awa(), { subsystems: ['projectiles', 'boss'] });
      ['Functional requirements', 'Implementation constraints', 'Dependencies', 'Edge cases', 'Failure scenarios', 'Acceptance criteria', 'Regression tests'].forEach((k) => H.includes(t, k));
      H.includes(t, 'function interceptTime');
    });
    it('genre defaults apply when no subsystem is selected', () => {
      const t = gen('gameplay', A.presets.create('kodama-last-branch'), { genre: 'platformer' });
      H.includes(t, 'coyote time');
    });
    it('the audio subsystem includes the per-stage audio map', () => {
      const p = awa();
      p.assets.push(S.createAsset({ id: 'AUD-ORBIT', name: 'Orbit theme', role: 'audio', fileName: 'orbit_theme.ogg', format: 'OGG', approval: 'approved' }), S.createAsset({ id: 'AUD-ALARM', name: 'Alarms', role: 'audio', fileName: 'alarms.ogg' }));
      p.stages[1].musicAssetId = 'AUD-ORBIT'; p.stages[4].ambienceAssetId = 'AUD-ALARM'; p.stages[5].loop = false;
      const t = gen('gameplay', p, { subsystems: ['audio'] });
      H.includes(t, 'Stage audio map'); H.includes(t, 'Stage 1 — Tsukuyomi Orbit [AWA-STG-01, stage / level]: music AUD-ORBIT "Orbit theme" (file orbit_theme.ogg, OGG), looping');
      H.includes(t, 'ambience AUD-ALARM "Alarms" (file alarms.ogg) [draft]');
      H.includes(t, 'Title screen [AWA-STG-TITLE, menu / title]: music NOT ASSIGNED YET');
      H.includes(t, 'were not analysed'); H.includes(t, 'Entering each stage in the stage audio map');
    });
    it('projects without stages keep the plain audio subsystem', () => {
      const p = awa(); p.stages = [];
      const t = gen('gameplay', p, { subsystems: ['audio'] });
      H.excludes(t, 'Stage audio map'); H.excludes(t, 'Stages (');
    });
    it('existing projects get preservation constraints', () => {
      const t = gen('gameplay', kdm(), {});
      H.includes(t, 'Must keep working: Gust dash ability'); H.includes(t, 'never rewrite working modules');
    });
    it('each coding assistant gets its own framing', () => {
      H.includes(gen('gameplay', awa(), { tool: 'codex' }), 'AGENTS.md');
      H.includes(gen('gameplay', awa(), { tool: 'gemini' }), 'List the files you will touch');
      H.includes(gen('gameplay', awa(), { tool: 'claude' }), 'Claude Code');
    });
  });

  H.describe('Existing project safety', (it) => {
    it('produces preservation, audit, backup, plan, regression and rollback', () => {
      const t = gen('existing', kdm());
      ['Preservation requirements', 'Audit checklist', 'Backup checkpoint', 'Minimal implementation plan', 'Regression tests', 'Rollback instructions', 'git tag pre-change-'].forEach((k) => H.includes(t, k));
      H.includes(t, 'file contents are NOT included');
    });
    it('does not invent source access when no manifest is provided', () => {
      const p = S.createProject('existing');
      const t = gen('existing', p);
      H.includes(t, 'No source files or manifest were provided'); H.includes(t, 'Which systems currently work');
    });
    it('audit focus forbids code changes', () => {
      const t = gen('existing', kdm(), { focus: 'audit' });
      H.includes(t, 'Do NOT change code'); H.excludes(t, 'Step 3 — Minimal implementation plan');
    });
    it('non-git projects get a folder backup and restore plan', () => {
      const p = kdm(); p.existing.versionControl = 'none';
      const t = gen('existing', p);
      H.includes(t, '_backup_'); H.includes(t, 'Restore the dated backup');
    });
  });

  H.describe('Android packaging', (it) => {
    it('HTML5 projects get a Capacitor plan with APK and AAB commands', () => {
      const t = gen('android', awa(), { appId: 'com.kirin.animewar' });
      ['npx cap add android', 'npx cap sync android', 'assembleDebug', 'assembleRelease', 'bundleRelease', 'apksigner verify', 'Play Store readiness checklist', 'Touch controls'].forEach((k) => H.includes(t, k));
      H.includes(t, 'A web browser alone cannot compile an APK or AAB');
      H.includes(t, 'AAB = Google Play upload format');
      H.includes(t, 'for Android: debug APK (testing), signed release APK (direct install), Android App Bundle (Play Store).');
      H.excludes(t, 'only,', 'mission lists outputs without the option label wording');
    });
    it('a single selected output is named on its own', () => {
      const t = gen('android', awa(), { appId: 'com.kirin.animewar', buildKind: 'aab' });
      H.includes(t, 'for Android: Android App Bundle (Play Store).');
    });
    it('Godot projects get a native export plan instead of Capacitor', () => {
      const t = gen('android', kdm(), { appId: 'com.forest.kodama' });
      H.excludes(t, 'npx cap'); H.includes(t, 'Godot Android export templates');
    });
    it('Unity projects get Unity player settings', () => {
      const p = awa(); p.profile.engine = 'unity';
      H.includes(gen('android', p, { appId: 'com.kirin.animewar' }), 'Build App Bundle (Google Play)');
    });
    it('3D HTML5 games include WebGL checks', () => {
      const p = awa(); p.profile.engine = 'threejs'; p.profile.renderMode = '3D';
      H.includes(gen('android', p, { appId: 'com.kirin.animewar' }), 'webglcontextlost');
    });
    it('studio target uses the bundled Android project files', () => {
      const t = gen('android', awa(), { target: 'studio' });
      H.includes(t, 'prepare-www.mjs'); H.includes(t, 'com.agps.promptstudio'); H.includes(t, 'no API keys are bundled');
    });
    it('rejects invalid application IDs and versions', () => {
      H.match(K.buildSpec('android', awa(), { appId: 'bad id' }).error, /Application ID/);
      H.match(K.buildSpec('android', awa(), { appId: 'com.example.game' }).error, /com\.example/);
      H.match(K.buildSpec('android', awa(), { appId: 'com.ok.game', versionCode: 0 }).error, /versionCode/);
      H.match(K.buildSpec('android', awa(), { appId: 'com.ok.game', minSdk: 36, targetSdk: 30 }).error, /minSdk/);
    });
  });

  H.describe('Compiler actions', (it) => {
    it('splits large prompts into coordinated phases', () => {
      const r = K.buildSpec('gameplay', awa(), { quality: 'ultra' });
      const ph = P.compilePhases(r.spec, 'ultra', 3000, 3);
      H.eq(ph.length, 3);
      H.includes(ph[0].text, 'PHASE 1 of 3'); H.includes(ph[1].text, 'Assume phases 1–1 were completed');
      H.includes(ph[2].text, 'FINAL DELIVERABLES'); H.includes(ph[0].text, 'Phase 1 report');
    });
    it('expand raises the quality level and adds appendices at ULTRA', () => {
      const r = K.buildSpec('planning', awa(), {});
      H.eq(P.expand(r.spec, 1).quality, 2);
      const x = P.expand(r.spec, 3, S.createProject('new'));
      H.includes(x.result.text, 'Assumption register'); H.includes(x.result.text, 'What is the game title?');
    });
    it('refine removes duplicates, restores missing sections and appends notes', () => {
      const r = K.buildSpec('testing', awa(), {});
      const c = P.compile(r.spec, 'professional');
      const edited = c.text.replace(/## \d+\. ACCEPTANCE TESTS[\s\S]*?(?=\n## )/, '') + '\n- Duplicate line for testing purposes\n- Duplicate line for testing purposes\n';
      const out = P.refine(edited, { compiled: c, note: 'Shorter please' });
      H.eq((out.text.match(/Duplicate line for testing purposes/g) || []).length, 1);
      H.includes(out.text, 'ACCEPTANCE TESTS'); H.includes(out.text, 'REVISION DIRECTIVE');
    });
    it('correct fixes unsafe or wrong content', () => {
      const ctx = { mode: 'existing', tool: 'chatgpt-image', category: 'image', characters: [], anyAnalyzed: false };
      const bad = 'Please rewrite the entire game from scratch. Key ' + FAKE + 'ABCDEFGHIJKL. I have analyzed the attached reference. A cute scene --ar 16:9 --niji 6. The browser can compile an APK.';
      const res = P.correct(bad, ctx);
      ['destructive-existing', 'secret', 'false-analysis', 'mj-params-wrong-tool', 'browser-apk'].forEach((id) => H.assert(res.applied.includes(id), 'applied ' + id));
      H.excludes(res.text, FAKE); H.excludes(res.text, '--ar'); H.excludes(res.text, 'from scratch');
      H.eq(res.remaining.filter((r) => r.severity === 'error').length, 0);
    });
    it('lint flags model claims that were not made by an API call', () => {
      H.assert(P.lint('This prompt was generated by Claude Opus.', {}).some((i) => i.id === 'false-model-claim'));
      H.assert(!P.lint('This prompt was generated by Claude Opus.', { aiGenerated: true }).some((i) => i.id === 'false-model-claim'));
    });
    it('Midjourney prompts missing --ar get one added', () => {
      const res = P.correct('```\nanime girl, clean lineart\n```', { tool: 'midjourney', aspect: '2:3' });
      H.includes(res.text, '--ar 2:3');
    });
  });
})(globalThis.AGPS = globalThis.AGPS || {});

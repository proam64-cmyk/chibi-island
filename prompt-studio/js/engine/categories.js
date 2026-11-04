/* Workbench category registry: option fields (rendered generically by the UI) + builder per category. */
(function (A) {
  'use strict';
  const U = A.util, S = A.schema;
  const K = (A.categories = {});

  const QUALITY = { key: 'quality', label: 'Quality mode', type: 'select', options: [['standard', 'STANDARD'], ['professional', 'PROFESSIONAL'], ['ultra', 'ULTRA DETAILED']], default: 'professional' };
  const CODE_TOOL = { key: 'tool', label: 'Target tool', type: 'select', options: () => A.gameplay.CODE_TOOLS.map((t) => [t.id, t.label]), default: 'claude' };
  const charOptions = (project, allowNone) => (allowNone ? [['', '— none —']] : []).concat(project.characters.map((c) => [c.id, c.name + ' (' + c.id + ')']));

  K.LIST = [
    {
      id: 'planning', label: 'Game Planning', icon: '🗺️', desc: 'Game design document, technical design and milestones.',
      fields: [CODE_TOOL, { key: 'kind', label: 'Deliverable', type: 'select', options: () => A.gameplay.PLAN_KINDS.map((k) => [k.id, k.label]), default: 'full' }, QUALITY],
      build: (p, o) => A.gameplay.buildPlanning(p, o),
    },
    {
      id: 'image', label: 'Anime Image Prompts', icon: '🎨', desc: 'Provider-specific prompts for concept art, master sheets, sprites, backgrounds, UI and marketing.',
      fields: [
        { key: 'provider', label: 'Image tool', type: 'select', options: (p, st) => A.image.allProviders(st).map((x) => [x.id, x.label]), default: 'chatgpt-image' },
        { key: 'assetType', label: 'Asset type', type: 'select', options: () => A.image.ASSET_TYPES.map((t) => [t.id, t.label]), default: 'concept' },
        { key: 'characterId', label: 'Character', type: 'select', options: (p) => charOptions(p, true), default: '' },
        { key: 'view', label: 'View (orthographic / tileset)', type: 'select', options: [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['three-quarter', 'Three-quarter'], ['side view', 'Tileset: side view'], ['top-down', 'Tileset: top-down']], default: 'front', showIf: (o) => o.assetType === 'turnaround' || o.assetType === 'tileset' },
        { key: 'animation', label: 'Animation', type: 'text', default: 'idle loop', showIf: (o) => o.assetType === 'sprite-sheet' },
        { key: 'frames', label: 'Frames', type: 'number', default: 6, min: 2, max: 24, showIf: (o) => o.assetType === 'sprite-sheet' },
        { key: 'subject', label: 'Subject / items', type: 'text', default: '', placeholder: 'e.g. armored void serpent', showIf: (o) => ['enemy', 'boss', 'ui-icons', 'tileset', 'loading-screen', 'title-screen', 'marketing'].includes(o.assetType) },
        { key: 'scene', label: 'Scene description', type: 'textarea', default: '', showIf: (o) => o.assetType === 'background' || o.assetType === 'parallax' },
        { key: 'aspect', label: 'Aspect ratio override', type: 'select', options: [['', 'Default for asset type'], ['1:1', '1:1'], ['2:3', '2:3'], ['3:2', '3:2'], ['16:9', '16:9'], ['9:16', '9:16'], ['4:3', '4:3'], ['2:1', '2:1'], ['21:9', '21:9']], default: '' },
        { key: 'mjModel', label: 'Midjourney model', type: 'select', options: [['niji 6', 'Niji 6 (anime)'], ['v 7', 'V7'], ['v 6.1', 'V6.1']], default: 'niji 6', showIf: (o) => o.provider === 'midjourney' },
        { key: 'stylize', label: 'Midjourney --stylize', type: 'number', default: 100, min: 0, max: 1000, showIf: (o) => o.provider === 'midjourney' },
        { key: 'styleRefUrl', label: 'Style reference URL (https)', type: 'text', default: '', showIf: (o) => o.provider === 'midjourney' },
        { key: 'cleanArt', label: 'Clean art (no text, bubbles, labels)', type: 'checkbox', default: true },
        { key: 'transparent', label: 'Request transparent background (if supported)', type: 'checkbox', default: false, showIf: (o) => o.provider === 'chatgpt-image' },
        { key: 'variants', label: 'Variations to generate', type: 'number', default: 4, min: 1, max: 12 },
        { key: 'extra', label: 'Extra direction', type: 'textarea', default: '' },
        { key: 'negative', label: 'Extra negatives (comma-separated)', type: 'text', default: '' },
        QUALITY,
      ],
      build: (p, o, st) => A.image.build(p, o, st),
    },
    {
      id: 'meshy', label: 'Meshy 3D Studio', icon: '🧊', desc: 'Text/image/multi-view to 3D, refinement, retopology, UVs, materials, rigging, animation, export.',
      fields: [
        { key: 'mode', label: 'Meshy mode', type: 'select', options: () => A.meshy.MODES.map((m) => [m.id, m.label]), default: 'text-to-3d' },
        { key: 'stage', label: 'Pipeline step', type: 'select', options: () => A.meshy.STAGES.map((m) => [m.id, m.label]), default: 'full' },
        { key: 'subjectType', label: 'Subject type', type: 'select', options: () => A.meshy.SUBJECTS.map((s) => [s, s]), default: 'character' },
        { key: 'characterId', label: 'Character', type: 'select', options: (p) => charOptions(p, true), default: '' },
        { key: 'description', label: 'Text concept / description', type: 'textarea', default: '' },
        { key: 'tier', label: 'Platform tier', type: 'select', options: () => A.meshy.PLATFORM_TIERS.map((t) => [t.id, t.label]), default: 'android-mid' },
        { key: 'polyTarget', label: 'Triangle target (blank = recommended)', type: 'number', default: '', min: 100, max: 200000 },
        { key: 'texture', label: 'Texture size', type: 'select', options: [['', 'Recommended'], ['512', '512'], ['1024', '1024'], ['2048', '2048'], ['4096', '4096 (desktop only)']], default: '' },
        { key: 'lods', label: 'Extra LOD levels (blank = recommended)', type: 'number', default: '', min: 0, max: 4 },
        { key: 'style', label: 'Material style', type: 'select', options: [['toon', 'Anime toon (cel-shaded in engine)'], ['pbr', 'PBR metallic-roughness']], default: 'toon' },
        { key: 'rig', label: 'Rig', type: 'select', options: [['humanoid', 'Humanoid biped'], ['custom', 'Custom'], ['none', 'None (static)']], default: 'humanoid' },
        { key: 'animations', label: 'Animations', type: 'text', default: 'idle, walk, run, attack, hit, death' },
        { key: 'format', label: 'Export format', type: 'select', options: () => A.meshy.FORMATS.map((f) => [f.id, f.label]), default: 'glb' },
        { key: 'height', label: 'Character height (m)', type: 'text', default: '1.7' },
        { key: 'integrationTool', label: 'Integration prompt for', type: 'select', options: [['claude', 'Claude'], ['codex', 'Codex'], ['gemini', 'Gemini']], default: 'claude' },
        QUALITY,
      ],
      build: (p, o) => A.meshy.build(p, o),
    },
    {
      id: 'gameplay', label: 'Gameplay Engineering', icon: '⚔️', desc: 'Subsystem implementation prompts with requirements, edge cases, acceptance and regression tests.',
      fields: [
        CODE_TOOL,
        { key: 'genre', label: 'Genre profile', type: 'select', options: () => S.GENRES.map((g) => [g.id, g.label]), default: (p) => p.profile.genre },
        { key: 'subsystems', label: 'Subsystems (none = genre defaults)', type: 'multiselect', options: () => A.gameplay.SUBSYSTEMS.map((s) => [s.id, s.label]), default: [] },
        { key: 'extra', label: 'Specific feature request', type: 'textarea', default: '' },
        QUALITY,
      ],
      build: (p, o) => A.gameplay.build(p, o),
    },
    {
      id: 'existing', label: 'Existing Game Safety', icon: '🛡️', desc: 'Preservation, audit, backup checkpoint, minimal plan, regression tests and rollback.',
      fields: [CODE_TOOL, { key: 'focus', label: 'Focus', type: 'select', options: () => A.existing.FOCUS.map((f) => [f.id, f.label]), default: 'full' }, { key: 'change', label: 'Change for this prompt (blank = all requested changes)', type: 'textarea', default: '' }, QUALITY],
      build: (p, o) => A.existing.build(p, o),
    },
    {
      id: 'testing', label: 'Testing & Debugging', icon: '🧪', desc: 'Test plans, bug investigations, performance profiling, Android failure triage.',
      fields: [CODE_TOOL, { key: 'kind', label: 'Task', type: 'select', options: () => A.gameplay.TEST_KINDS.map((k) => [k.id, k.label]), default: 'test-plan' }, { key: 'bug', label: 'Bug / failure description', type: 'textarea', default: '' }, { key: 'logs', label: 'Logs / stack trace', type: 'textarea', default: '' }, QUALITY],
      build: (p, o) => A.gameplay.buildTesting(p, o),
    },
    {
      id: 'android', label: 'Android Packaging', icon: '📦', desc: 'Capacitor (HTML5) or engine-native Android plans: APK, signed APK, AAB, Play readiness.',
      fields: [
        { key: 'target', label: 'Packaging target', type: 'select', options: [['game', 'This game project'], ['studio', 'Anime Game Prompt Studio itself']], default: 'game' },
        { key: 'tool', label: 'Target tool', type: 'select', options: () => A.gameplay.CODE_TOOLS.map((t) => [t.id, t.label]).concat([['manual', 'Manual checklist (no AI)']]), default: 'claude' },
        { key: 'appName', label: 'App name', type: 'text', default: '' },
        { key: 'appId', label: 'Application ID', type: 'text', default: '', placeholder: 'com.yourstudio.game' },
        { key: 'versionName', label: 'versionName', type: 'text', default: '1.0.0' },
        { key: 'versionCode', label: 'versionCode', type: 'number', default: 1, min: 1 },
        { key: 'orientation', label: 'Orientation', type: 'select', options: [['', 'From project'], ['landscape', 'Landscape'], ['portrait', 'Portrait'], ['any', 'Any']], default: '' },
        { key: 'minSdk', label: 'minSdk', type: 'number', default: 24, min: 21, max: 36 },
        { key: 'targetSdk', label: 'targetSdk (verify Play requirement)', type: 'number', default: 36, min: 30, max: 40 },
        { key: 'permissions', label: 'Permissions', type: 'multiselect', options: () => A.android.PERMISSIONS.map((x) => [x.id, x.label]), default: ['INTERNET'] },
        { key: 'buildKind', label: 'Build outputs', type: 'select', options: () => A.android.BUILD_KINDS.map((b) => [b.id, b.label]), default: 'all' },
        { key: 'ci', label: 'Include CI build steps', type: 'checkbox', default: false },
        QUALITY,
      ],
      build: (p, o) => A.android.build(p, o),
    },
  ];
  K.get = (id) => K.LIST.find((c) => c.id === id) || K.LIST[0];

  K.resolveOptions = (field, project, settings) => (typeof field.options === 'function' ? field.options(project, settings) : field.options || []);
  K.defaults = function (cat, project) {
    const o = {};
    cat.fields.forEach((f) => { o[f.key] = typeof f.default === 'function' ? f.default(project) : U.clone(f.default); });
    return o;
  };

  /** Build a spec for a category with stored options, returning {spec} or {error}. */
  K.buildSpec = function (catId, project, options, settings) {
    const cat = K.get(catId);
    const o = Object.assign(K.defaults(cat, project), options || {});
    try { return { spec: cat.build(project, o, settings), options: o }; } catch (e) { return { error: e.message, validation: e.validation || null, options: o }; }
  };

  /** Lint context derived from project + spec. */
  K.lintContext = function (project, spec, extra) {
    const m = (spec && spec.meta) || {};
    return Object.assign({
      tool: m.tool, category: m.category, mode: project.mode, cleanArt: !!m.cleanArt, aspect: m.aspect, maxChars: m.maxChars,
      characters: project.characters, anyAnalyzed: project.assets.some((a) => a.analyzed), aiGenerated: false,
    }, extra || {});
  };
})(globalThis.AGPS = globalThis.AGPS || {});

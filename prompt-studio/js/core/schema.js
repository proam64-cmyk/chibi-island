/* Project / character / asset data model, defaults, normalisation, validation, import/export. */
(function (A) {
  'use strict';
  const U = A.util;
  const S = (A.schema = {});

  S.SCHEMA_VERSION = 1;
  S.EXPORT_FORMAT = 'agps-project';

  S.GENRES = [
    { id: 'shmup', label: "Shoot 'em up" },
    { id: 'bullet-hell', label: 'Bullet hell' },
    { id: 'action-rpg', label: 'Action RPG' },
    { id: 'tactical-rpg', label: 'Turn-based tactical RPG' },
    { id: 'platformer', label: 'Platformer' },
    { id: 'fighting', label: 'Fighting game' },
    { id: 'arcade', label: 'Arcade' },
    { id: 'exploration', label: 'Exploration adventure' },
    { id: 'hybrid', label: 'Hybrid genre' },
  ];
  S.RENDER_MODES = ['2D', '2.5D', '3D'];
  S.ENGINES = [
    { id: 'html5-canvas', label: 'HTML5 Canvas / vanilla JS', family: 'html5' },
    { id: 'phaser', label: 'Phaser', family: 'html5' },
    { id: 'pixi', label: 'PixiJS', family: 'html5' },
    { id: 'threejs', label: 'Three.js', family: 'html5' },
    { id: 'babylon', label: 'Babylon.js', family: 'html5' },
    { id: 'playcanvas', label: 'PlayCanvas (self-hosted build)', family: 'html5' },
    { id: 'rpgmaker-mz', label: 'RPG Maker MZ (HTML5 deployment)', family: 'html5' },
    { id: 'construct', label: 'Construct 3 (HTML5 export)', family: 'html5' },
    { id: 'godot', label: 'Godot 4', family: 'godot' },
    { id: 'unity', label: 'Unity', family: 'unity' },
    { id: 'unreal', label: 'Unreal Engine', family: 'unreal' },
    { id: 'defold', label: 'Defold', family: 'defold' },
    { id: 'gamemaker', label: 'GameMaker', family: 'gamemaker' },
    { id: 'other', label: 'Other / undecided', family: 'other' },
  ];
  S.PLATFORMS = ['android', 'web', 'windows', 'macos', 'linux', 'ios'];
  S.AGE_CATEGORIES = [
    { id: 'adult', label: 'Adult (25+)', minor: false },
    { id: 'young-adult', label: 'Young adult (18–24)', minor: false },
    { id: 'middle-aged', label: 'Middle-aged', minor: false },
    { id: 'elder', label: 'Elder', minor: false },
    { id: 'teen', label: 'Teen (13–17)', minor: true },
    { id: 'child', label: 'Child (under 13)', minor: true },
    { id: 'non-human', label: 'Non-human / creature', minor: false },
    { id: 'ageless-spirit', label: 'Ageless spirit / construct', minor: false },
  ];
  S.ASSET_ROLES = [
    'character-master', 'generated-image', 'sprite', 'background', 'ui', 'mesh', 'material', 'animation', 'audio', 'other',
  ];
  S.APPROVAL = ['draft', 'in-review', 'approved', 'rejected'];
  S.WORKFLOW_STAGES = [
    { id: 'concept', label: 'Character concept' },
    { id: 'master-sheet', label: 'Master sheet' },
    { id: '2d-asset', label: '2D asset' },
    { id: '3d-reference', label: '3D reference' },
    { id: 'meshy-generation', label: 'Meshy generation' },
    { id: 'refinement', label: 'Refinement' },
    { id: 'game-integration', label: 'Game integration' },
  ];

  S.engine = (id) => S.ENGINES.find((e) => e.id === id) || S.ENGINES[S.ENGINES.length - 1];
  S.ageCategory = (id) => S.AGE_CATEGORIES.find((a) => a.id === id) || S.AGE_CATEGORIES[0];
  S.isMinor = (ch) => !!(ch && S.ageCategory(ch.ageCategory).minor);

  S.defaultProfile = () => ({
    title: '',
    logline: '',
    story: '',
    genre: 'action-rpg',
    subgenres: [],
    renderMode: '2D',
    platforms: ['android', 'web'],
    engine: 'phaser',
    targetFps: 60,
    orientation: 'landscape',
    combat: '',
    abilities: '',
    world: '',
    progression: '',
    artDirection: '',
    animation: '',
    saveSystem: '',
    controls: '',
    difficulty: '',
    audio: '',
    monetization: 'none',
    notes: '',
  });

  S.defaultExisting = () => ({
    sourceManifest: '',
    workingSystems: '',
    requestedChanges: '',
    knownBugs: '',
    artReferences: '',
    constraints: '',
    versionControl: 'git',
    currentVersion: '',
  });

  S.createProject = function (mode, overrides) {
    const p = {
      schemaVersion: S.SCHEMA_VERSION,
      id: U.uid('PRJ'),
      name: 'Untitled project',
      mode: mode === 'existing' ? 'existing' : 'new',
      isSample: false,
      sampleNotice: '',
      createdAt: U.now(),
      updatedAt: U.now(),
      profile: S.defaultProfile(),
      existing: S.defaultExisting(),
      characters: [],
      assets: [],
      history: [],
      workbench: {},
    };
    return S.normalizeProject(Object.assign(p, overrides || {}));
  };

  S.createCharacter = function (overrides) {
    return Object.assign(
      {
        id: U.uid('CHR'),
        name: '',
        role: 'protagonist',
        ageCategory: 'adult',
        bodyProportions: '',
        face: '',
        hairstyle: '',
        eyeColor: '',
        costume: '',
        weapons: '',
        abilities: '',
        palette: [],
        allowedTransformations: '',
        artStyle: '',
        personality: '',
        forbiddenChanges: '',
        referenceAssetIds: [],
        notes: '',
      },
      overrides || {}
    );
  };

  S.createAsset = function (overrides) {
    return Object.assign(
      {
        id: U.uid('AST'),
        name: '',
        role: 'generated-image',
        sourceTool: '',
        version: 1,
        format: '',
        targetGame: '',
        dependencies: [],
        approval: 'draft',
        characterId: '',
        workflowStage: '',
        fileName: '',
        fileSize: 0,
        publicUrl: '',
        thumbnail: '',
        analyzed: false,
        analysis: null,
        notes: '',
        createdAt: U.now(),
      },
      overrides || {}
    );
  };

  function str(v, d) { return v == null ? d || '' : String(v); }

  S.normalizeCharacter = function (c) {
    const base = S.createCharacter();
    const out = Object.assign(base, c || {});
    out.id = str(out.id) || U.uid('CHR');
    ['name','role','bodyProportions','face','hairstyle','eyeColor','costume','weapons','abilities','allowedTransformations','artStyle','personality','forbiddenChanges','notes'].forEach((k) => (out[k] = str(out[k])));
    if (!S.AGE_CATEGORIES.some((a) => a.id === out.ageCategory)) out.ageCategory = 'adult';
    out.palette = U.list(out.palette).map((h) => h.trim());
    out.referenceAssetIds = Array.isArray(out.referenceAssetIds) ? out.referenceAssetIds.map(String) : [];
    return out;
  };

  S.normalizeAsset = function (a) {
    const out = Object.assign(S.createAsset(), a || {});
    out.id = str(out.id) || U.uid('AST');
    if (!S.ASSET_ROLES.includes(out.role)) out.role = 'other';
    if (!S.APPROVAL.includes(out.approval)) out.approval = 'draft';
    out.version = Math.max(1, parseInt(out.version, 10) || 1);
    out.dependencies = U.list(out.dependencies);
    out.analyzed = !!(out.analyzed && out.analysis && out.analysis.text);
    if (!out.analyzed) out.analysis = null;
    ['name','sourceTool','format','targetGame','characterId','workflowStage','fileName','publicUrl','thumbnail','notes'].forEach((k) => (out[k] = str(out[k])));
    return out;
  };

  S.normalizeProject = function (p) {
    const out = Object.assign({}, p);
    out.schemaVersion = S.SCHEMA_VERSION;
    out.id = str(out.id) || U.uid('PRJ');
    out.name = str(out.name) || (out.profile && out.profile.title) || 'Untitled project';
    out.mode = out.mode === 'existing' ? 'existing' : 'new';
    out.profile = Object.assign(S.defaultProfile(), out.profile || {});
    out.profile.subgenres = U.list(out.profile.subgenres);
    out.profile.platforms = U.list(out.profile.platforms);
    out.profile.targetFps = parseInt(out.profile.targetFps, 10) || 60;
    if (!S.RENDER_MODES.includes(out.profile.renderMode)) out.profile.renderMode = '2D';
    out.existing = Object.assign(S.defaultExisting(), out.existing || {});
    out.characters = (Array.isArray(out.characters) ? out.characters : []).map(S.normalizeCharacter);
    out.assets = (Array.isArray(out.assets) ? out.assets : []).map(S.normalizeAsset);
    out.history = (Array.isArray(out.history) ? out.history : []).filter((h) => h && typeof h.text === 'string').slice(-S.HISTORY_LIMIT);
    out.workbench = out.workbench && typeof out.workbench === 'object' ? out.workbench : {};
    out.createdAt = str(out.createdAt) || U.now();
    out.updatedAt = str(out.updatedAt) || U.now();
    out.isSample = !!out.isSample;
    out.sampleNotice = str(out.sampleNotice);
    return out;
  };
  S.HISTORY_LIMIT = 300;

  S.validateCharacter = function (c, project) {
    const errors = [], warnings = [];
    if (!U.has(c.name)) errors.push('Character name is required.');
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,40}$/.test(c.id)) errors.push('Character ID must be 3–41 letters, digits, "-" or "_".');
    const bad = (c.palette || []).filter((h) => !U.hexOk(h));
    if (bad.length) errors.push('Invalid palette colour(s): ' + bad.join(', ') + ' (use #RGB or #RRGGBB).');
    if (!U.has(c.eyeColor)) warnings.push('Eye colour is not set — continuity prompts will be weaker.');
    if (!U.has(c.hairstyle)) warnings.push('Hairstyle is not set.');
    if (!U.has(c.costume)) warnings.push('Costume is not set.');
    if (!U.has(c.forbiddenChanges)) warnings.push('No forbidden visual changes defined.');
    if (S.isMinor(c)) warnings.push('Minor age category: prompts automatically add non-sexualisation and age-appropriate constraints.');
    if (project) {
      const missing = (c.referenceAssetIds || []).filter((id) => !project.assets.some((a) => a.id === id));
      if (missing.length) errors.push('Linked reference asset(s) not found in registry: ' + missing.join(', '));
      const dup = project.characters.filter((o) => o.id === c.id).length > 1;
      if (dup) errors.push('Duplicate character ID: ' + c.id);
    }
    return { errors, warnings };
  };

  S.validateAsset = function (a, project) {
    const errors = [], warnings = [];
    if (!U.has(a.name)) errors.push('Asset name is required.');
    if (!S.ASSET_ROLES.includes(a.role)) errors.push('Unknown asset role.');
    if (a.publicUrl && !/^https:\/\//i.test(a.publicUrl)) errors.push('Public URL must start with https://');
    if (project) {
      const unknown = (a.dependencies || []).filter((id) => !project.assets.some((o) => o.id === id));
      if (unknown.length) warnings.push('Unknown dependency IDs: ' + unknown.join(', '));
      if (a.characterId && !project.characters.some((c) => c.id === a.characterId)) errors.push('Linked character not found: ' + a.characterId);
    }
    return { errors, warnings };
  };

  S.validateProject = function (p) {
    const errors = [], warnings = [];
    if (!p || typeof p !== 'object') return { errors: ['Project is not an object.'], warnings };
    if (!U.has(p.profile && p.profile.title)) warnings.push('Game title is empty.');
    const fps = p.profile && p.profile.targetFps;
    if (fps && (fps < 15 || fps > 240)) errors.push('Target FPS must be between 15 and 240.');
    const ids = new Set();
    (p.characters || []).forEach((c) => {
      if (ids.has(c.id)) errors.push('Duplicate character ID ' + c.id);
      ids.add(c.id);
      const r = S.validateCharacter(c, p);
      r.errors.forEach((e) => errors.push((c.name || c.id) + ': ' + e));
    });
    const aids = new Set();
    (p.assets || []).forEach((a) => {
      if (aids.has(a.id)) errors.push('Duplicate asset ID ' + a.id);
      aids.add(a.id);
      S.validateAsset(a, p).errors.forEach((e) => errors.push((a.name || a.id) + ': ' + e));
    });
    if (p.mode === 'existing' && !U.has(p.existing && p.existing.workingSystems))
      warnings.push('Existing project: list the systems that already work so they can be preserved.');
    return { errors: U.uniq(errors), warnings };
  };

  /** Keys that must never be persisted or exported. */
  const SECRET_KEY_RE = /^(api[_-]?key|apikey|x-api-key|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|bearer|password|anthropic[_-]?api[_-]?key)$/i;
  const SECRET_VALUE_RE = /(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,})/g;
  S.stripSecrets = function (obj) {
    if (Array.isArray(obj)) return obj.map(S.stripSecrets);
    if (obj && typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach((k) => {
        if (SECRET_KEY_RE.test(k)) return;
        out[k] = S.stripSecrets(obj[k]);
      });
      return out;
    }
    if (typeof obj === 'string') return obj.replace(SECRET_VALUE_RE, '[REDACTED-SECRET]');
    return obj;
  };

  S.exportProject = function (project, opts) {
    const p = S.stripSecrets(U.clone(project));
    if (opts && opts.withoutThumbnails) p.assets.forEach((a) => (a.thumbnail = ''));
    return JSON.stringify({ format: S.EXPORT_FORMAT, schemaVersion: S.SCHEMA_VERSION, exportedAt: U.now(), project: p }, null, 2);
  };

  /** Parse an export file. Throws Error with a readable message on invalid input. */
  S.importProject = function (jsonText, existingIds) {
    let data;
    try { data = JSON.parse(jsonText); } catch (e) { throw new Error('File is not valid JSON: ' + e.message); }
    const raw = data && data.format === S.EXPORT_FORMAT ? data.project : data;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('File does not contain a project object.');
    if (!raw.profile && !raw.characters) throw new Error('File is not an Anime Game Prompt Studio project (missing profile/characters).');
    if (data.schemaVersion && data.schemaVersion > S.SCHEMA_VERSION)
      throw new Error('Project was created by a newer studio version (schema ' + data.schemaVersion + ').');
    const p = S.normalizeProject(S.stripSecrets(raw));
    if (existingIds && existingIds.includes(p.id)) {
      p.id = U.uid('PRJ');
      p.name = p.name + ' (imported)';
    }
    const v = S.validateProject(p);
    return { project: p, errors: v.errors, warnings: v.warnings };
  };
})(globalThis.AGPS = globalThis.AGPS || {});

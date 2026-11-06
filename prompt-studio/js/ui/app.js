/* Anime Game Prompt Studio — UI controller. Renders views as HTML strings and uses event delegation. */
(function (A) {
  'use strict';
  const U = A.util, S = A.schema, St = A.storage, K = A.categories, P = A.compiler, R = A.router;
  const esc = U.esc;
  const t = (s) => A.i18n.t(s);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const DEFAULT_SETTINGS = { lang: 'en', aiMode: 'local', catalog: U.clone(R.DEFAULT_CATALOG), serverUrl: '', autosave: true, customProviders: [], qaManual: {}, lastProjectId: null };

  const st = (A.app = {
    projects: [], project: null, view: 'projects', selChar: null, settings: U.clone(DEFAULT_SETTINGS),
    server: { available: false, models: [], error: 'not checked yet' }, editors: {}, phases: {}, templates: [],
    assetFilter: { role: '', approval: '' }, histFilter: '', tplSel: null, tplChar: '', tplOut: '', qa: null, navOpen: false, saveState: 'idle',
  });

  /* ---------------- persistence ---------------- */
  const saveNow = async () => {
    if (!st.project) return;
    try {
      st.saveState = 'saving'; paintSave();
      await St.putProject(st.project);
      const i = st.projects.findIndex((p) => p.id === st.project.id);
      if (i >= 0) st.projects[i] = U.clone(st.project); else st.projects.unshift(U.clone(st.project));
      st.saveState = 'saved';
    } catch (e) { st.saveState = 'error'; toast(t('Save failed') + ': ' + e.message, 'error'); }
    paintSave();
  };
  const scheduleSave = U.debounce(() => { if (st.settings.autosave) saveNow(); else { st.saveState = 'unsaved'; paintSave(); } }, 600);
  const touch = () => { st.saveState = 'unsaved'; paintSave(); scheduleSave(); };
  const saveSettings = () => St.setSetting('app', st.settings).catch((e) => toast(e.message, 'error'));

  function paintSave() {
    const el = $('#saveState'); if (!el) return;
    const map = { idle: '', saving: t('Saving…'), saved: t('All changes saved'), unsaved: t('Unsaved changes'), error: t('Save error') };
    el.textContent = map[st.saveState] || '';
    el.className = 'save-state ' + st.saveState;
  }

  /* ---------------- UI helpers ---------------- */
  function toast(msg, kind) {
    const el = $('#toast');
    const item = document.createElement('div');
    item.className = 'toast-item ' + (kind || 'info');
    item.textContent = msg;
    el.appendChild(item);
    setTimeout(() => item.remove(), kind === 'error' ? 7000 : 3500);
  }

  let modalReturnFocus = null;
  function modal(title, body, buttons, opts) {
    const m = $('#modal');
    modalReturnFocus = document.activeElement;
    m.innerHTML = '<div class="modal-card' + (opts && opts.wide ? ' wide' : '') + '" role="document"><header><h2 id="modalTitle">' + esc(title) + '</h2><button class="icon-btn" data-action="closeModal" aria-label="' + esc(t('Close')) + '">✕</button></header><div class="modal-body">' + body + '</div><footer>' +
      (buttons || []).map((b) => '<button class="btn ' + (b.primary ? 'primary' : b.danger ? 'danger' : '') + '" data-action="' + b.action + '"' + (b.arg != null ? ' data-arg="' + esc(b.arg) + '"' : '') + '>' + esc(b.label) + '</button>').join('') +
      '<button class="btn ghost" data-action="closeModal">' + esc(t('Close')) + '</button></footer></div>';
    m.hidden = false;
    m.setAttribute('aria-labelledby', 'modalTitle');
    const f = m.querySelector('input,select,textarea,button.primary') || m.querySelector('button');
    if (f) f.focus();
  }
  function closeModal() {
    const m = $('#modal'); m.hidden = true; m.innerHTML = '';
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
  }
  function confirmModal(title, text, action, arg, danger) {
    modal(title, '<p>' + esc(text) + '</p>', [{ label: t('Confirm'), action, arg, primary: !danger, danger }]);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); }
      else {
        const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
        if (!ok) throw new Error('copy command rejected');
      }
      toast(t('Copied to clipboard'), 'ok');
    } catch (e) { toast(t('Copy failed — select the text and copy manually') + ' (' + e.message + ')', 'error'); }
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /** Generic form field. o: {id, label, bind, type, value, options:[[v,l]], help, rows, placeholder, rerender, min, max, dtype, readonly} */
  function fld(o) {
    const id = o.id || 'f-' + String(o.bind).replace(/[^\w]/g, '-');
    const attrs = ' id="' + id + '" data-bind="' + esc(o.bind) + '"' + (o.dtype ? ' data-type="' + o.dtype + '"' : '') + (o.rerender ? ' data-rerender="1"' : '') + (o.readonly ? ' readonly' : '');
    let ctl = '';
    const v = o.value == null ? '' : o.value;
    if (o.type === 'textarea') ctl = '<textarea' + attrs + ' rows="' + (o.rows || 3) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>' + esc(v) + '</textarea>';
    else if (o.type === 'select') ctl = '<select' + attrs + '>' + (o.options || []).map(([ov, ol]) => '<option value="' + esc(ov) + '"' + (String(ov) === String(v) ? ' selected' : '') + '>' + esc(t(ol)) + '</option>').join('') + '</select>';
    else if (o.type === 'checkbox') return '<div class="field check"><input type="checkbox"' + attrs + ' data-type="bool"' + (v ? ' checked' : '') + '><label for="' + id + '">' + esc(t(o.label)) + '</label>' + (o.help ? '<small>' + esc(t(o.help)) + '</small>' : '') + '</div>';
    else if (o.type === 'checks') {
      const vals = Array.isArray(v) ? v : U.list(v);
      return '<fieldset class="field checks"><legend>' + esc(t(o.label)) + '</legend><div class="check-grid">' + (o.options || []).map(([ov, ol], i) =>
        '<label class="chip"><input type="checkbox" data-bind="' + esc(o.bind) + '" data-type="checks" value="' + esc(ov) + '"' + (vals.includes(ov) ? ' checked' : '') + (o.rerender ? ' data-rerender="1"' : '') + ' id="' + id + '-' + i + '"><span>' + esc(t(ol)) + '</span></label>').join('') + '</div>' + (o.help ? '<small>' + esc(t(o.help)) + '</small>' : '') + '</fieldset>';
    }
    else ctl = '<input type="' + (o.type === 'number' ? 'number' : o.type === 'color' ? 'text' : 'text') + '"' + attrs + ' value="' + esc(v) + '"' + (o.type === 'number' ? ' inputmode="decimal"' + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') : '') + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>';
    return '<div class="field"><label for="' + id + '">' + esc(t(o.label)) + '</label>' + ctl + (o.help ? '<small>' + esc(t(o.help)) + '</small>' : '') + '</div>';
  }
  const opts = (arr) => arr.map((x) => (Array.isArray(x) ? x : [x, x]));
  const badge = (txt, kind) => '<span class="badge ' + (kind || '') + '">' + esc(txt) + '</span>';
  const btn = (label, action, extra) => '<button class="btn ' + ((extra && extra.cls) || '') + '" data-action="' + action + '"' + (extra && extra.arg != null ? ' data-arg="' + esc(extra.arg) + '"' : '') + (extra && extra.title ? ' title="' + esc(extra.title) + '"' : '') + '>' + esc(t(label)) + '</button>';
  const msgList = (arr, kind) => (arr && arr.length ? '<ul class="msgs ' + kind + '">' + arr.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '');

  /* ---------------- navigation ---------------- */
  const NAV = () => [
    { group: t('Studio'), items: [['projects', '🏠', t('Projects')]] },
    { group: t('Project'), items: [['profile', '📝', t('Game Profile')], ['existing', '🛡️', t('Existing Project')], ['characters', '🧑‍🎤', t('Characters')], ['assets', '🗂️', t('Asset Registry')], ['workflow', '🔗', t('Asset Workflow')]] },
    { group: t('Prompt Workbenches'), items: K.LIST.map((c) => ['wb:' + c.id, c.icon, t(c.label)]) },
    { group: t('Library'), items: [['templates', '📚', t('Templates')], ['history', '🕘', t('Prompt History')]] },
    { group: t('System'), items: [['models', '🤖', t('AI Models')], ['settings', '⚙️', t('Settings')], ['qa', '✅', t('QA & Diagnostics')]] },
  ];

  function renderShell() {
    const p = st.project;
    $('#topbar').innerHTML =
      '<button class="icon-btn nav-toggle" data-action="toggleNav" aria-label="' + esc(t('Menu')) + '" aria-expanded="' + st.navOpen + '" aria-controls="sidebar">☰</button>' +
      '<div class="brand"><span class="logo" aria-hidden="true">✦</span><span class="brand-text">Anime Game <b>Prompt Studio</b></span></div>' +
      '<div class="current-project">' + (p ? '<span class="cp-label">' + esc(t('Project')) + ':</span> <b>' + esc(p.name) + '</b> ' + badge(p.mode === 'existing' ? t('Existing game') : t('New game'), p.mode) : '<span class="muted">' + esc(t('No project open')) + '</span>') + '</div>' +
      '<span id="saveState" class="save-state" aria-live="polite"></span>' +
      '<button class="pill ' + (st.server.available ? 'ok' : 'off') + '" data-action="go" data-arg="models" title="' + esc(st.server.available ? t('AI backend connected') : st.server.error) + '">' + (st.server.available ? '● ' + t('AI connected') : '○ ' + t('Local mode')) + '</button>' +
      '<label class="sr-only" for="langSel">' + esc(t('Language')) + '</label><select id="langSel" data-bind="s:lang" data-rerender="1" class="lang"><option value="en"' + (st.settings.lang === 'en' ? ' selected' : '') + '>EN</option><option value="es"' + (st.settings.lang === 'es' ? ' selected' : '') + '>ES</option></select>';
    $('#sidebar').innerHTML = NAV().map((g) => '<div class="nav-group"><h3>' + esc(g.group) + '</h3>' + g.items.map(([id, ic, label]) =>
      '<button class="nav-item' + (st.view === id ? ' active' : '') + '" data-action="go" data-arg="' + id + '"' + (st.view === id ? ' aria-current="page"' : '') + '><span aria-hidden="true">' + ic + '</span> ' + esc(label) + '</button>').join('') + '</div>').join('') +
      '<p class="storage-note">' + esc(t('Storage')) + ': ' + (St.backend && St.backend.persistent ? 'IndexedDB' : t('memory only (not persistent)')) + '</p>';
    $('#sidebar').classList.toggle('open', st.navOpen);
    document.documentElement.lang = st.settings.lang;
    paintSave();
  }

  function render() {
    renderShell();
    const main = $('#main');
    let html;
    try { html = renderView(); } catch (e) { console.error(e); html = '<div class="panel error"><h2>' + esc(t('Something went wrong')) + '</h2><p>' + esc(e.message) + '</p></div>'; }
    main.innerHTML = html;
    afterRender();
  }

  function renderView() {
    const v = st.view;
    if (v === 'projects') return viewProjects();
    if (v === 'models') return viewModels();
    if (v === 'settings') return viewSettings();
    if (v === 'qa') return viewQA();
    if (!st.project) return noProject();
    if (v === 'profile') return viewProfile();
    if (v === 'existing') return viewExisting();
    if (v === 'characters') return viewCharacters();
    if (v === 'assets') return viewAssets();
    if (v === 'workflow') return viewWorkflow();
    if (v === 'templates') return viewTemplates();
    if (v === 'history') return viewHistory();
    if (v.startsWith('wb:')) return viewWorkbench(v.slice(3));
    return viewProjects();
  }

  function afterRender() {
    if (st.view.startsWith('wb:')) { lintEditor(st.view.slice(3)); updateRouteLine(st.view.slice(3)); }
  }

  function noProject() {
    return '<section class="panel empty"><h1>' + esc(t('No project open')) + '</h1><p>' + esc(t('Create a project or load a sample profile to start.')) + '</p>' + btn('Go to projects', 'go', { arg: 'projects', cls: 'primary' }) + '</section>';
  }

  function sampleBanner() {
    const p = st.project;
    return p && p.isSample ? '<div class="banner sample">ℹ️ ' + esc(p.sampleNotice || t('Sample profile — no real source files are attached.')) + '</div>' : '';
  }

  /* ---------------- Projects ---------------- */
  function viewProjects() {
    const cards = st.projects.map((p) =>
      '<article class="card project-card"><header><h3>' + esc(p.name) + '</h3>' + badge(p.mode === 'existing' ? t('Existing game') : t('New game'), p.mode) + (p.isSample ? badge(t('Sample'), 'sample') : '') + '</header>' +
      '<p class="muted">' + esc(S.engine(p.profile.engine).label) + ' · ' + esc(p.profile.renderMode) + ' · ' + esc(A.context.genreLabel(p.profile.genre)) + '</p>' +
      '<p class="muted small">' + esc(t('Characters')) + ': ' + p.characters.length + ' · ' + esc(t('Assets')) + ': ' + p.assets.length + ' · ' + esc(t('Prompt versions')) + ': ' + (p.history || []).length + '<br>' + esc(t('Updated')) + ': ' + esc(U.fmtDate(p.updatedAt)) + '</p>' +
      '<div class="row">' + btn('Open', 'openProject', { arg: p.id, cls: 'primary' }) + btn('Duplicate', 'dupProject', { arg: p.id }) + btn('Export JSON', 'exportProject', { arg: p.id }) + btn('Delete', 'askDeleteProject', { arg: p.id, cls: 'danger' }) + '</div></article>').join('');
    const presets = A.presets.LIST.map((pr) => '<article class="card preset"><h3>' + esc(pr.label) + '</h3><p>' + esc(t(pr.summary)) + '</p>' + btn('Load sample profile', 'loadPreset', { arg: pr.presetId }) + '</article>').join('');
    return '<section class="hero"><h1>Anime Game <span class="grad">Prompt Studio</span></h1><p>' + esc(t('Turn your game concept into tool-specific production prompts — offline, with character continuity, existing-project safety and Android release planning.')) + '</p>' +
      '<div class="row">' + btn('+ Create new game', 'newProject', { arg: 'new', cls: 'primary' }) + btn('Improve existing game', 'newProject', { arg: 'existing' }) +
      '<label class="btn file-btn">' + esc(t('Import project JSON')) + '<input type="file" accept="application/json,.json" data-action-change="importProject" class="sr-only"></label></div></section>' +
      '<section><h2>' + esc(t('Your projects')) + '</h2>' + (cards ? '<div class="grid cards">' + cards + '</div>' : '<p class="muted">' + esc(t('No projects yet.')) + '</p>') + '</section>' +
      '<section><h2>' + esc(t('Sample profiles')) + '</h2><p class="muted small">' + esc(t('Sample profiles are editable examples. They do not include real source files or art.')) + '</p><div class="grid cards">' + presets + '</div></section>';
  }

  /* ---------------- Profile ---------------- */
  function viewProfile() {
    const p = st.project, pf = p.profile;
    const v = S.validateProject(p);
    return sampleBanner() + '<section class="panel"><h1>' + esc(t('Game Profile')) + '</h1>' + msgList(v.errors, 'error') + msgList(v.warnings, 'warn') +
      '<div class="form-grid">' +
      fld({ label: 'Project name', bind: 'p:name', value: p.name }) +
      fld({ label: 'Project mode', bind: 'p:mode', type: 'select', value: p.mode, options: [['new', 'Create new game'], ['existing', 'Improve existing game']], rerender: true }) +
      fld({ label: 'Game title', bind: 'p:profile.title', value: pf.title }) +
      fld({ label: 'Logline', bind: 'p:profile.logline', value: pf.logline }) +
      fld({ label: 'Genre', bind: 'p:profile.genre', type: 'select', value: pf.genre, options: S.GENRES.map((g) => [g.id, g.label]) }) +
      fld({ label: 'Subgenres (comma-separated)', bind: 'p:profile.subgenres', dtype: 'list', value: pf.subgenres.join(', ') }) +
      fld({ label: 'Rendering mode', bind: 'p:profile.renderMode', type: 'select', value: pf.renderMode, options: opts(S.RENDER_MODES) }) +
      fld({ label: 'Engine / technology', bind: 'p:profile.engine', type: 'select', value: pf.engine, options: S.ENGINES.map((e) => [e.id, e.label]) }) +
      fld({ label: 'Target FPS', bind: 'p:profile.targetFps', type: 'number', dtype: 'number', value: pf.targetFps, min: 15, max: 240 }) +
      fld({ label: 'Orientation', bind: 'p:profile.orientation', type: 'select', value: pf.orientation, options: [['landscape', 'Landscape'], ['portrait', 'Portrait'], ['any', 'Any']] }) +
      '</div>' + fld({ label: 'Platforms', bind: 'p:profile.platforms', type: 'checks', value: pf.platforms, options: opts(S.PLATFORMS) }) +
      '<div class="form-grid wide">' +
      [['story', 'Story'], ['combat', 'Combat mechanics'], ['abilities', 'Character abilities'], ['world', 'World design'], ['progression', 'Progression'], ['artDirection', 'Art direction'], ['animation', 'Animation requirements'], ['saveSystem', 'Save system'], ['controls', 'Controls'], ['difficulty', 'Difficulty'], ['audio', 'Audio'], ['notes', 'Notes']]
        .map(([k, l]) => fld({ label: l, bind: 'p:profile.' + k, type: 'textarea', value: pf[k], rows: k === 'story' ? 5 : 3 })).join('') +
      '</div><p class="muted small">' + esc(t('Changes are saved automatically.')) + '</p></section>';
  }

  /* ---------------- Existing ---------------- */
  function viewExisting() {
    const p = st.project, x = p.existing;
    const head = p.mode !== 'existing'
      ? '<div class="banner">' + esc(t('This project is in "new game" mode. Switch to existing-game mode to get preservation-first prompts.')) + ' ' + btn('Switch to existing-game mode', 'setMode', { arg: 'existing', cls: 'primary' }) + '</div>' : '';
    return sampleBanner() + head + '<section class="panel"><h1>' + esc(t('Existing Project')) + '</h1>' +
      '<p class="muted">' + esc(t('Describe what exists today. The studio never assumes access to files you have not provided.')) + '</p>' +
      '<div class="row"><label class="btn file-btn">' + esc(t('Read file list from a folder')) + '<input type="file" webkitdirectory directory multiple class="sr-only" data-action-change="readManifest"></label><span class="muted small">' + esc(t('Only file paths are recorded; file contents are not read or uploaded.')) + '</span></div>' +
      '<div class="form-grid wide">' +
      fld({ label: 'Source manifest (one path per line)', bind: 'p:existing.sourceManifest', type: 'textarea', rows: 8, value: x.sourceManifest }) +
      fld({ label: 'Existing functional systems (one per line)', bind: 'p:existing.workingSystems', type: 'textarea', rows: 6, value: x.workingSystems }) +
      fld({ label: 'Requested changes (one per line)', bind: 'p:existing.requestedChanges', type: 'textarea', rows: 5, value: x.requestedChanges }) +
      fld({ label: 'Known bugs (one per line)', bind: 'p:existing.knownBugs', type: 'textarea', rows: 4, value: x.knownBugs }) +
      fld({ label: 'Current art & character references', bind: 'p:existing.artReferences', type: 'textarea', rows: 4, value: x.artReferences }) +
      fld({ label: 'Technical constraints', bind: 'p:existing.constraints', type: 'textarea', rows: 4, value: x.constraints }) +
      fld({ label: 'Version control', bind: 'p:existing.versionControl', type: 'select', value: x.versionControl, options: [['git', 'Git'], ['none', 'None / manual backups']] }) +
      fld({ label: 'Current version', bind: 'p:existing.currentVersion', value: x.currentVersion }) +
      '</div><div class="row">' + btn('Generate safety package', 'go', { arg: 'wb:existing', cls: 'primary' }) + '</div></section>';
  }

  /* ---------------- Characters ---------------- */
  function viewCharacters() {
    const p = st.project;
    if (!st.selChar || !p.characters.some((c) => c.id === st.selChar)) st.selChar = p.characters[0] ? p.characters[0].id : null;
    const list = p.characters.map((c) => '<button class="list-item' + (c.id === st.selChar ? ' active' : '') + '" data-action="selChar" data-arg="' + esc(c.id) + '"><span class="swatches">' + c.palette.slice(0, 4).map((h) => '<i style="background:' + (U.hexOk(h) ? h : '#000') + '"></i>').join('') + '</span><b>' + esc(c.name || t('(unnamed)')) + '</b><small>' + esc(c.id) + '</small></button>').join('');
    const c = p.characters.find((x) => x.id === st.selChar);
    let editor = '<p class="muted">' + esc(t('No character selected.')) + '</p>';
    if (c) {
      const v = S.validateCharacter(c, p);
      const imgAssets = p.assets.filter((a) => ['character-master', 'generated-image', 'sprite'].includes(a.role));
      const rs = A.context.referenceStatus(p, c);
      editor = '<div id="charValidation">' + msgList(v.errors, 'error') + msgList(v.warnings, 'warn') + '</div>' +
        '<div class="form-grid">' +
        fld({ label: 'Character ID (unique)', bind: 'c:id', value: c.id, help: 'Changing the ID updates linked assets.' }) +
        fld({ label: 'Name', bind: 'c:name', value: c.name }) +
        fld({ label: 'Role', bind: 'c:role', value: c.role }) +
        fld({ label: 'Age category', bind: 'c:ageCategory', type: 'select', value: c.ageCategory, options: S.AGE_CATEGORIES.map((a) => [a.id, a.label]) }) +
        fld({ label: 'Body proportions', bind: 'c:bodyProportions', value: c.bodyProportions }) +
        fld({ label: 'Face', bind: 'c:face', value: c.face }) +
        fld({ label: 'Hairstyle', bind: 'c:hairstyle', value: c.hairstyle }) +
        fld({ label: 'Eye colour', bind: 'c:eyeColor', value: c.eyeColor }) +
        fld({ label: 'Colour palette (hex, comma-separated)', bind: 'c:palette', dtype: 'list', value: c.palette.join(', '), placeholder: '#D7263D, #FFFFFF' }) +
        fld({ label: 'Art style', bind: 'c:artStyle', value: c.artStyle }) +
        '</div><div class="form-grid wide">' +
        fld({ label: 'Costume details', bind: 'c:costume', type: 'textarea', value: c.costume }) +
        fld({ label: 'Weapons / equipment', bind: 'c:weapons', type: 'textarea', value: c.weapons }) +
        fld({ label: 'Abilities', bind: 'c:abilities', type: 'textarea', value: c.abilities }) +
        fld({ label: 'Personality', bind: 'c:personality', type: 'textarea', value: c.personality }) +
        fld({ label: 'Allowed transformations', bind: 'c:allowedTransformations', type: 'textarea', value: c.allowedTransformations }) +
        fld({ label: 'Forbidden visual changes', bind: 'c:forbiddenChanges', type: 'textarea', value: c.forbiddenChanges }) +
        '</div>' +
        (imgAssets.length ? fld({ label: 'Reference images (from Asset Registry)', bind: 'c:referenceAssetIds', type: 'checks', value: c.referenceAssetIds, options: imgAssets.map((a) => [a.id, a.name + ' · ' + a.approval + (a.analyzed ? ' · analysed' : ' · not analysed')]), rerender: true })
          : '<p class="muted small">' + esc(t('No reference images registered. Prompts will state that no master reference exists.')) + ' ' + btn('Open Asset Registry', 'go', { arg: 'assets' }) + '</p>') +
        '<p class="small">' + esc(t('Reference status')) + ': ' + (rs.all.length ? rs.all.length + ' ' + t('registered') + ', ' + rs.approved.length + ' ' + t('approved') + ', ' + rs.analyzed.length + ' ' + t('analysed') : t('none registered')) + '</p>' +
        '<div class="row">' + btn('Master sheet prompt', 'charPrompt', { arg: 'master-sheet', cls: 'primary' }) + btn('Expression sheet prompt', 'charPrompt', { arg: 'expressions' }) + btn('Meshy 3D prompt', 'charMeshy') + btn('Duplicate', 'dupChar') + btn('Delete character', 'askDeleteChar', { cls: 'danger' }) + '</div>' +
        '<details class="lock-preview"><summary>' + esc(t('Continuity lock preview (reused in every prompt)')) + '</summary><pre>' + esc(A.context.characterLock(c, 3).join('\n')) + '</pre></details>';
    }
    return sampleBanner() + '<section class="panel"><div class="split"><aside class="list"><div class="row">' + btn('+ New character', 'newChar', { cls: 'primary' }) + '</div>' + (list || '<p class="muted">' + esc(t('No characters yet.')) + '</p>') + '</aside><div class="detail"><h1>' + esc(t('Character Continuity')) + '</h1>' + editor + '</div></div></section>';
  }

  /* ---------------- Assets ---------------- */
  function viewAssets() {
    const p = st.project, f = st.assetFilter;
    const rows = p.assets.filter((a) => (!f.role || a.role === f.role) && (!f.approval || a.approval === f.approval)).map((a) => {
      const ch = p.characters.find((c) => c.id === a.characterId);
      return '<tr><td>' + (a.thumbnail ? '<img class="thumb" src="' + esc(a.thumbnail) + '" alt="">' : '<span class="thumb ph" aria-hidden="true">' + esc((a.format || '?').slice(0, 4)) + '</span>') + '</td><td><code>' + esc(a.id) + '</code></td><td><b>' + esc(a.name) + '</b><br><small class="muted">' + esc(a.fileName || '') + '</small></td><td>' + esc(a.role) + '</td><td>' + esc(a.sourceTool || '—') + '</td><td>v' + a.version + '</td><td>' + esc(a.format || '—') + '</td><td>' + esc(ch ? ch.name : '—') + '</td><td>' + esc(a.workflowStage || '—') + '</td><td>' + badge(a.approval, a.approval) + '</td><td>' + (a.analyzed ? badge(t('analysed'), 'ok') : badge(t('not analysed'), 'muted')) + '</td><td class="actions">' +
        btn('Edit', 'editAsset', { arg: a.id }) + btn('New version', 'versionAsset', { arg: a.id }) + (a.thumbnail ? btn('Analyse with AI', 'analyzeAsset', { arg: a.id }) : '') + btn('Delete', 'askDeleteAsset', { arg: a.id, cls: 'danger' }) + '</td></tr>';
    }).join('');
    return sampleBanner() + '<section class="panel"><h1>' + esc(t('Asset Registry')) + '</h1>' +
      '<p class="muted">' + esc(t('Importing a file records its metadata (and a small preview for images). The studio does not analyse file contents unless you explicitly run AI analysis on an image.')) + '</p>' +
      '<div class="row">' + btn('+ Add asset record', 'newAsset', { cls: 'primary' }) + '<label class="btn file-btn">' + esc(t('Import files…')) + '<input type="file" multiple class="sr-only" data-action-change="importFiles"></label>' +
      fld({ label: 'Filter by role', bind: 'f:role', type: 'select', value: f.role, options: [['', 'All']].concat(opts(S.ASSET_ROLES)), rerender: true }) +
      fld({ label: 'Filter by approval', bind: 'f:approval', type: 'select', value: f.approval, options: [['', 'All']].concat(opts(S.APPROVAL)), rerender: true }) + '</div>' +
      (rows ? '<div class="table-wrap"><table class="assets"><caption class="sr-only">' + esc(t('Assets')) + '</caption><thead><tr><th></th><th>ID</th><th>' + esc(t('Name')) + '</th><th>' + esc(t('Role')) + '</th><th>' + esc(t('Source tool')) + '</th><th>' + esc(t('Version')) + '</th><th>' + esc(t('Format')) + '</th><th>' + esc(t('Character')) + '</th><th>' + esc(t('Stage')) + '</th><th>' + esc(t('Approval')) + '</th><th>' + esc(t('Analysis')) + '</th><th>' + esc(t('Actions')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">' + esc(t('No assets match.')) + '</p>') + '</section>';
  }

  function assetForm(a) {
    const p = st.project;
    return '<div class="form-grid" id="assetForm" data-asset="' + esc(a.id) + '">' +
      fld({ label: 'Asset ID', bind: 'a:id', value: a.id, readonly: true }) +
      fld({ label: 'Name', bind: 'a:name', value: a.name }) +
      fld({ label: 'Role', bind: 'a:role', type: 'select', value: a.role, options: opts(S.ASSET_ROLES) }) +
      fld({ label: 'Source tool', bind: 'a:sourceTool', value: a.sourceTool, placeholder: 'Midjourney, Meshy, Blender…' }) +
      fld({ label: 'Version', bind: 'a:version', type: 'number', dtype: 'number', value: a.version, min: 1 }) +
      fld({ label: 'File format', bind: 'a:format', value: a.format, placeholder: 'PNG, GLB, FBX…' }) +
      fld({ label: 'Target game', bind: 'a:targetGame', value: a.targetGame || p.profile.title }) +
      fld({ label: 'Character', bind: 'a:characterId', type: 'select', value: a.characterId, options: [['', '— none —']].concat(p.characters.map((c) => [c.id, c.name])) }) +
      fld({ label: 'Workflow stage', bind: 'a:workflowStage', type: 'select', value: a.workflowStage, options: [['', '— none —']].concat(S.WORKFLOW_STAGES.map((s) => [s.id, s.label])) }) +
      fld({ label: 'Approval status', bind: 'a:approval', type: 'select', value: a.approval, options: opts(S.APPROVAL) }) +
      fld({ label: 'Public https URL (for Midjourney references)', bind: 'a:publicUrl', value: a.publicUrl }) +
      fld({ label: 'Original file name', bind: 'a:fileName', value: a.fileName }) +
      '</div>' + (p.assets.filter((o) => o.id !== a.id).length ? fld({ label: 'Dependencies', bind: 'a:dependencies', type: 'checks', value: a.dependencies, options: p.assets.filter((o) => o.id !== a.id).map((o) => [o.id, o.id + ' ' + o.name]) }) : '') +
      fld({ label: 'Notes', bind: 'a:notes', type: 'textarea', value: a.notes }) +
      (a.analyzed ? '<details open><summary>' + esc(t('AI analysis on record')) + ' (' + esc(a.analysis.model) + ', ' + esc(U.fmtDate(a.analysis.at)) + ')</summary><pre class="wrap">' + esc(a.analysis.text) + '</pre></details>' : '<p class="muted small">' + esc(t('Not analysed. Prompts describe this asset only from your written specification.')) + '</p>') +
      '<div id="assetErrors"></div>';
  }

  /* ---------------- Workflow ---------------- */
  const STAGE_ACTION = {
    concept: ['image', { assetType: 'concept' }], 'master-sheet': ['image', { assetType: 'master-sheet' }], '2d-asset': ['image', { assetType: 'expressions' }],
    '3d-reference': ['image', { assetType: 'turnaround', view: 'front' }], 'meshy-generation': ['meshy', { mode: 'multi-view', stage: 'creation' }],
    refinement: ['meshy', { stage: 'refine' }], 'game-integration': ['meshy', { stage: 'export' }],
  };
  function viewWorkflow() {
    const p = st.project;
    const rows = p.characters.map((c) => {
      let prevOk = true;
      const cells = S.WORKFLOW_STAGES.map((s) => {
        const as = p.assets.filter((a) => a.characterId === c.id && a.workflowStage === s.id);
        const approved = as.some((a) => a.approval === 'approved');
        const status = approved ? 'approved' : as.length ? 'in-progress' : 'missing';
        const gate = !prevOk && status === 'missing';
        prevOk = approved;
        return '<td class="stage ' + status + '"><div class="stage-status">' + esc(t(status === 'in-progress' ? 'in progress' : status)) + (as.length ? ' (' + as.length + ')' : '') + '</div>' + (gate ? '<small class="warn-text">' + esc(t('previous stage not approved')) + '</small>' : '') +
          '<button class="btn small" data-action="stagePrompt" data-arg="' + esc(c.id + '|' + s.id) + '">' + esc(t('Prompt')) + '</button></td>';
      }).join('');
      return '<tr><th scope="row">' + esc(c.name) + '<br><small>' + esc(c.id) + '</small></th>' + cells + '</tr>';
    }).join('');
    return sampleBanner() + '<section class="panel"><h1>' + esc(t('Asset Workflow')) + '</h1><p class="muted">CHARACTER CONCEPT → MASTER SHEET → 2D ASSET → 3D REFERENCE → MESHY GENERATION → REFINEMENT → GAME INTEGRATION</p>' +
      '<p class="muted small">' + esc(t('Stage status comes from assets in the registry linked to the character with a workflow stage. Approve assets to unlock the next stage cleanly.')) + '</p>' +
      (rows ? '<div class="table-wrap"><table class="workflow"><thead><tr><th>' + esc(t('Character')) + '</th>' + S.WORKFLOW_STAGES.map((s) => '<th>' + esc(t(s.label)) + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">' + esc(t('Add characters first.')) + '</p>') + '</section>';
  }

  /* ---------------- Workbench ---------------- */
  function wbOptions(catId) {
    const p = st.project;
    const cat = K.get(catId);
    p.workbench[catId] = Object.assign(K.defaults(cat, p), p.workbench[catId] || {});
    return p.workbench[catId];
  }
  function editorOf(catId) {
    if (!st.editors[catId]) {
      const last = [...(st.project.history || [])].reverse().find((h) => h.category === catId);
      st.editors[catId] = { text: last ? last.text : '', entryId: last ? last.id : null, phaseMode: 'off', aiGenerated: last ? last.action === 'ai' : false };
    }
    return st.editors[catId];
  }
  function wbFieldsHtml(catId) {
    const cat = K.get(catId), o = wbOptions(catId);
    return cat.fields.filter((f) => !f.showIf || f.showIf(o)).map((f) => fld({
      label: f.label, bind: 'w:' + catId + '.' + f.key, type: f.type === 'multiselect' ? 'checks' : f.type, value: o[f.key],
      options: K.resolveOptions(f, st.project, st.settings), dtype: f.type === 'number' ? 'number' : null, min: f.min, max: f.max, placeholder: f.placeholder,
      rerender: f.type === 'select' || f.type === 'checkbox', id: 'wb-' + catId + '-' + f.key,
    })).join('');
  }
  function viewWorkbench(catId) {
    const cat = K.get(catId), ed = editorOf(catId);
    const phases = st.phases[catId];
    return sampleBanner() + '<section class="wb"><header class="wb-head"><h1><span aria-hidden="true">' + cat.icon + '</span> ' + esc(t(cat.label)) + '</h1><p class="muted">' + esc(t(cat.desc)) + '</p></header>' +
      '<div class="wb-grid"><form class="panel wb-form" id="wbForm" data-cat="' + catId + '"><h2>' + esc(t('Configuration')) + '</h2>' + wbFieldsHtml(catId) + '<button class="btn primary form-generate" data-action="wbGenerate" data-arg="' + catId + '">' + esc(t('Generate prompt')) + '</button></form>' +
      '<div class="panel wb-editor"><div class="toolbar" role="toolbar" aria-label="' + esc(t('Prompt actions')) + '">' +
      btn('Generate', 'wbGenerate', { arg: catId, cls: 'primary' }) + btn('Expand', 'wbExpand', { arg: catId }) + btn('Refine', 'wbRefine', { arg: catId }) + btn('Correct', 'wbCorrect', { arg: catId }) +
      btn('Compare versions', 'wbCompare', { arg: catId }) + btn('Copy', 'wbCopy', { arg: catId }) + btn('Export', 'wbExport', { arg: catId }) + btn('Send to AI model…', 'wbAI', { arg: catId, cls: 'accent' }) +
      btn('Save version', 'wbSave', { arg: catId }) + btn('Save as template', 'wbTemplate', { arg: catId }) + '</div>' +
      '<div class="row phase-row"><label for="phaseMode-' + catId + '">' + esc(t('Split into coordinated phases')) + '</label><select id="phaseMode-' + catId + '" data-bind="ph:' + catId + '"><option value="off"' + (ed.phaseMode === 'off' ? ' selected' : '') + '>' + esc(t('Off')) + '</option><option value="auto"' + (ed.phaseMode === 'auto' ? ' selected' : '') + '>' + esc(t('Auto (when over tool limit)')) + '</option>' + [2, 3, 4].map((n) => '<option value="' + n + '"' + (String(ed.phaseMode) === String(n) ? ' selected' : '') + '>' + n + ' ' + esc(t('phases')) + '</option>').join('') + '</select>' +
      (phases ? '<div class="phase-tabs" role="tablist">' + phases.map((ph, i) => '<button role="tab" class="btn small' + (ed.phaseIndex === i ? ' primary' : '') + '" data-action="wbPhase" data-arg="' + catId + '|' + i + '" aria-selected="' + (ed.phaseIndex === i) + '">' + esc(t('Phase')) + ' ' + (i + 1) + '</button>').join('') + '</div>' : '') + '</div>' +
      '<div class="route-line" id="routeLine"></div>' +
      '<div id="issues" class="issues" aria-live="polite"></div>' +
      '<label for="editor" class="editor-label">' + esc(t('Prompt (editable)')) + '</label><textarea id="editor" class="editor" data-bind="e:' + catId + '" spellcheck="false" placeholder="' + esc(t('Press Generate to compile a prompt from your project data.')) + '">' + esc(ed.text) + '</textarea>' +
      '<div class="meta-line" id="metaLine"></div>' +
      '<div class="field"><label for="refineNote">' + esc(t('Revision note (used by Refine and by the AI)')) + '</label><input id="refineNote" type="text" placeholder="' + esc(t('e.g. make the boss phases more readable on small screens')) + '"></div>' +
      '</div></div></section>';
  }

  function currentSpec(catId) {
    const r = K.buildSpec(catId, st.project, wbOptions(catId), st.settings);
    return r;
  }
  function lintCtx(catId, spec) { return K.lintContext(st.project, spec || (currentSpec(catId).spec), { aiGenerated: !!editorOf(catId).aiGenerated }); }

  function lintEditor(catId) {
    const ed = editorOf(catId);
    const box = $('#issues'); const meta = $('#metaLine');
    if (meta) meta.textContent = '≈ ' + U.estimateTokens(ed.text).toLocaleString() + ' ' + t('tokens') + ' · ' + ed.text.length.toLocaleString() + ' ' + t('characters') + (ed.entryId ? ' · ' + t('version') + ' ' + ed.entryId : '');
    if (!box) return;
    if (ed.error) { box.innerHTML = msgList([ed.error], 'error'); return; }
    if (!ed.text.trim()) { box.innerHTML = ''; return; }
    const r = currentSpec(catId);
    const issues = P.lint(ed.text, lintCtx(catId, r.spec));
    const extra = ed.notes || [];
    box.innerHTML = (extra.length ? msgList(extra, 'info') : '') + (issues.length ? '<ul class="msgs lint">' + issues.map((i) => '<li class="' + i.severity + '">' + badge(t(i.severity), i.severity) + ' ' + esc(t(i.message)) + (i.fixable ? ' <small>(' + esc(t('Correct can fix this')) + ')</small>' : '') + '</li>').join('') + '</ul>' : '<p class="ok-text small">✓ ' + esc(t('No issues found by the prompt checker.')) + '</p>');
  }
  const lintSoon = U.debounce(() => { if (st.view.startsWith('wb:')) lintEditor(st.view.slice(3)); }, 400);

  function routeFor(catId, text) {
    const r = currentSpec(catId);
    const m = (r.spec && r.spec.meta) || {};
    return R.route({ mode: st.settings.aiMode, task: { taskType: m.taskType, complexity: m.complexity, routine: m.routine, inputTokens: U.estimateTokens(text || editorOf(catId).text) + 400, quality: P.qLevel(wbOptions(catId).quality) }, catalog: st.settings.catalog, server: st.server });
  }
  function updateRouteLine(catId) {
    const el = $('#routeLine'); if (!el) return;
    const r = routeFor(catId);
    el.innerHTML = '<b>' + esc(t('Model routing')) + ' (' + esc(R.MODES.find((m) => m.id === st.settings.aiMode).label) + '):</b> ' + (r.local ? esc(t('LOCAL — no model will be called.')) : esc(r.model.label) + ' · ≈ ' + esc(U.money(r.estimate.cost))) + ' <button class="link" data-action="go" data-arg="models">' + esc(t('change')) + '</button>';
  }

  function addHistory(catId, text, action, extra) {
    const p = st.project;
    const o = wbOptions(catId);
    const prev = editorOf(catId).entryId;
    const entry = Object.assign({ id: 'V' + (p.history.length + 1) + '-' + Date.now().toString(36).slice(-4).toUpperCase(), createdAt: U.now(), category: catId, action, quality: o.quality, tool: o.tool || o.provider || catId, options: U.clone(o), parentId: prev, title: '', text }, extra || {});
    p.history.push(entry);
    if (p.history.length > S.HISTORY_LIMIT) p.history.splice(0, p.history.length - S.HISTORY_LIMIT);
    const ed = editorOf(catId); ed.entryId = entry.id; ed.text = text; ed.aiGenerated = action === 'ai';
    touch();
    return entry;
  }

  function setEditor(catId, text) {
    const ed = editorOf(catId); ed.text = text;
    const ta = $('#editor'); if (ta) ta.value = text;
    lintEditor(catId); updateRouteLine(catId);
  }

  const ACTIONS = {
    closeModal, toggleNav() { st.navOpen = !st.navOpen; renderShell(); },
    go(el) { if (!$('#modal').hidden) closeModal(); st.view = el.dataset.arg; st.navOpen = false; render(); $('#main').focus(); window.scrollTo(0, 0); },

    async newProject(el) {
      const p = S.createProject(el.dataset.arg, { name: el.dataset.arg === 'existing' ? t('Existing game') : t('New game') });
      st.project = p; await saveNow(); st.settings.lastProjectId = p.id; saveSettings();
      st.editors = {}; st.phases = {}; st.view = el.dataset.arg === 'existing' ? 'existing' : 'profile'; render();
      toast(t('Project created'), 'ok');
    },
    async loadPreset(el) {
      const p = A.presets.create(el.dataset.arg);
      st.project = p; await saveNow(); st.settings.lastProjectId = p.id; saveSettings();
      st.editors = {}; st.phases = {}; st.view = 'profile'; render(); toast(t('Sample profile loaded'), 'ok');
    },
    async openProject(el) {
      const raw = await St.getProject(el.dataset.arg);
      if (!raw) return toast(t('Project not found'), 'error');
      st.project = S.normalizeProject(raw); st.settings.lastProjectId = st.project.id; saveSettings();
      st.editors = {}; st.phases = {}; st.view = 'profile'; render();
    },
    async dupProject(el) {
      const raw = await St.getProject(el.dataset.arg); if (!raw) return;
      const p = S.normalizeProject(U.clone(raw)); p.id = U.uid('PRJ'); p.name += ' ' + t('(copy)'); p.createdAt = U.now();
      await St.putProject(p); st.projects = await St.listProjects(); render(); toast(t('Project duplicated'), 'ok');
    },
    async exportProject(el) {
      const raw = el.dataset.arg ? await St.getProject(el.dataset.arg) : st.project;
      if (!raw) return;
      download(U.slug(raw.name) + '.agps.json', S.exportProject(raw), 'application/json');
    },
    askDeleteProject(el) { confirmModal(t('Delete project'), t('Delete this project and all its prompt history? This cannot be undone. Export it first if you may need it.'), 'deleteProject', el.dataset.arg, true); },
    async deleteProject(el) {
      await St.deleteProject(el.dataset.arg);
      if (st.project && st.project.id === el.dataset.arg) st.project = null;
      st.projects = await St.listProjects(); closeModal(); render(); toast(t('Project deleted'), 'ok');
    },
    setMode(el) { st.project.mode = el.dataset.arg; touch(); render(); },

    selChar(el) { st.selChar = el.dataset.arg; render(); },
    newChar() {
      const c = S.createCharacter({ name: t('New character') });
      st.project.characters.push(c); st.selChar = c.id; touch(); render();
      const f = $('#f-c-name'); if (f) { f.focus(); f.select(); }
    },
    dupChar() {
      const c = st.project.characters.find((x) => x.id === st.selChar); if (!c) return;
      const d = S.normalizeCharacter(Object.assign(U.clone(c), { id: U.uid('CHR'), name: c.name + ' ' + t('(copy)'), referenceAssetIds: [] }));
      st.project.characters.push(d); st.selChar = d.id; touch(); render();
    },
    askDeleteChar() { confirmModal(t('Delete character'), t('Delete this character specification? Assets stay in the registry but lose the link.'), 'deleteChar', st.selChar, true); },
    deleteChar(el) {
      const id = el.dataset.arg;
      st.project.characters = st.project.characters.filter((c) => c.id !== id);
      st.project.assets.forEach((a) => { if (a.characterId === id) a.characterId = ''; });
      st.selChar = null; closeModal(); touch(); render();
    },
    charPrompt(el) { Object.assign(wbOptions('image'), { characterId: st.selChar, assetType: el.dataset.arg }); touch(); st.view = 'wb:image'; render(); },
    charMeshy() { Object.assign(wbOptions('meshy'), { characterId: st.selChar, subjectType: 'character' }); touch(); st.view = 'wb:meshy'; render(); },
    stagePrompt(el) {
      const [cid, stage] = el.dataset.arg.split('|');
      const [cat, o] = STAGE_ACTION[stage];
      Object.assign(wbOptions(cat), o, { characterId: cid }); if (cat === 'meshy') wbOptions(cat).subjectType = 'character';
      touch(); st.view = 'wb:' + cat; render();
    },

    newAsset() {
      const a = S.createAsset({ name: '', targetGame: st.project.profile.title });
      st.assetDraft = a;
      modal(t('New asset record'), assetForm(a), [{ label: t('Save asset'), action: 'saveAsset', primary: true }], { wide: true });
    },
    editAsset(el) {
      const a = st.project.assets.find((x) => x.id === el.dataset.arg); if (!a) return;
      st.assetDraft = U.clone(a);
      modal(t('Edit asset') + ' ' + a.id, assetForm(st.assetDraft), [{ label: t('Save asset'), action: 'saveAsset', primary: true }], { wide: true });
    },
    saveAsset() {
      const a = S.normalizeAsset(st.assetDraft);
      const others = Object.assign({}, st.project, { assets: st.project.assets.filter((x) => x.id !== a.id).concat([a]) });
      const v = S.validateAsset(a, others);
      if (v.errors.length) { $('#assetErrors').innerHTML = msgList(v.errors, 'error'); return; }
      const i = st.project.assets.findIndex((x) => x.id === a.id);
      if (i >= 0) st.project.assets[i] = a; else st.project.assets.push(a);
      closeModal(); touch(); render(); toast(t('Asset saved') + (v.warnings.length ? ' — ' + v.warnings.join(' ') : ''), v.warnings.length ? 'warn' : 'ok');
    },
    versionAsset(el) {
      const a = st.project.assets.find((x) => x.id === el.dataset.arg); if (!a) return;
      const n = S.normalizeAsset(Object.assign(U.clone(a), { id: U.uid('AST'), version: a.version + 1, approval: 'draft', dependencies: U.uniq((a.dependencies || []).concat([a.id])), analyzed: false, analysis: null, createdAt: U.now() }));
      st.project.assets.push(n); touch(); render(); toast(t('New version created as draft') + ': ' + n.id, 'ok');
    },
    askDeleteAsset(el) { confirmModal(t('Delete asset'), t('Remove this asset record? Files on your disk are not touched.'), 'deleteAsset', el.dataset.arg, true); },
    deleteAsset(el) {
      const id = el.dataset.arg, p = st.project;
      p.assets = p.assets.filter((a) => a.id !== id);
      p.assets.forEach((a) => { a.dependencies = a.dependencies.filter((d) => d !== id); });
      p.characters.forEach((c) => { c.referenceAssetIds = c.referenceAssetIds.filter((d) => d !== id); });
      closeModal(); touch(); render();
    },
    analyzeAsset(el) { aiAnalyze(el.dataset.arg); },
    async doAnalyze(el) { await runAnalyze(el.dataset.arg); },

    wbGenerate(el) { generate(el.dataset.arg); },
    wbExpand(el) {
      const catId = el.dataset.arg, o = wbOptions(catId), q = P.qLevel(o.quality);
      let text, note;
      if (q < 3) {
        o.quality = P.QUALITY_NAMES[q];
        const r = currentSpec(catId); if (r.error) return showSpecError(catId, r);
        text = P.compile(r.spec, q + 1).text; note = t('Expanded to') + ' ' + o.quality.toUpperCase() + '.';
      } else {
        const r = currentSpec(catId); if (r.error) return showSpecError(catId, r);
        const x = P.expand(r.spec, 3, st.project); text = x.result.text; note = t(x.note);
      }
      st.phases[catId] = null;
      addHistory(catId, text, 'expand');
      editorOf(catId).notes = [note]; render(); toast(note, 'ok');
    },
    wbRefine(el) {
      const catId = el.dataset.arg, ed = editorOf(catId);
      if (!ed.text.trim()) return toast(t('Nothing to refine yet — generate or paste a prompt first.'), 'warn');
      const r = currentSpec(catId);
      const compiled = r.spec ? P.compile(r.spec, wbOptions(catId).quality) : null;
      const res = P.refine(ed.text, { compiled, note: ($('#refineNote') || {}).value });
      addHistory(catId, res.text, 'refine');
      ed.notes = res.changes.map(t); setEditor(catId, res.text); toast(t('Refined'), 'ok');
    },
    wbCorrect(el) {
      const catId = el.dataset.arg, ed = editorOf(catId);
      if (!ed.text.trim()) return toast(t('Nothing to correct yet.'), 'warn');
      const res = P.correct(ed.text, lintCtx(catId));
      if (res.applied.length) addHistory(catId, res.text, 'correct');
      ed.notes = [res.applied.length ? t('Applied fixes') + ': ' + res.applied.join(', ') : t('No automatic fixes were needed.')].concat(res.remaining.filter((x) => !x.fixable).map((x) => t('Needs manual attention') + ': ' + t(x.message)));
      setEditor(catId, res.text);
    },
    wbCompare(el) { compareModal(el.dataset.arg); },
    runCompare() {
      const a = $('#cmpA').value, b = $('#cmpB').value, catId = $('#cmpA').dataset.cat;
      const get = (id) => (id === 'editor' ? editorOf(catId).text : (st.project.history.find((h) => h.id === id) || {}).text || '');
      const d = U.diffLines(get(a), get(b));
      const add = d.filter((x) => x.op === 'add').length, del = d.filter((x) => x.op === 'del').length;
      $('#cmpOut').innerHTML = '<p class="small">' + esc(t('Added lines')) + ': <b class="ok-text">' + add + '</b> · ' + esc(t('Removed lines')) + ': <b class="err-text">' + del + '</b></p><pre class="diff">' + d.map((x) => '<span class="' + x.op + '">' + (x.op === 'add' ? '+ ' : x.op === 'del' ? '− ' : '  ') + esc(x.text) + '</span>').join('\n') + '</pre>';
    },
    wbCopy(el) { const tx = editorOf(el.dataset.arg).text; if (!tx.trim()) return toast(t('Nothing to copy yet.'), 'warn'); copyText(tx); },
    wbExport(el) {
      const catId = el.dataset.arg;
      if (!editorOf(catId).text.trim()) return toast(t('Nothing to export yet.'), 'warn');
      modal(t('Export prompt'), '<p>' + esc(t('Choose a format. Exports never contain API keys.')) + '</p>', [
        { label: t('Markdown (.md)'), action: 'doExport', arg: catId + '|md', primary: true }, { label: t('Plain text (.txt)'), action: 'doExport', arg: catId + '|txt' }, { label: t('JSON with metadata'), action: 'doExport', arg: catId + '|json' }]);
    },
    doExport(el) {
      const [catId, fmt] = el.dataset.arg.split('|');
      const ed = editorOf(catId), base = U.slug(st.project.name) + '_' + catId + '_' + (ed.entryId || 'draft');
      if (fmt === 'json') download(base + '.json', JSON.stringify(S.stripSecrets({ format: 'agps-prompt', project: st.project.name, category: catId, options: wbOptions(catId), versionId: ed.entryId, exportedAt: U.now(), text: ed.text }), null, 2), 'application/json');
      else download(base + '.' + fmt, ed.text, fmt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8');
      closeModal();
    },
    wbSave(el) { const catId = el.dataset.arg, ed = editorOf(catId); if (!ed.text.trim()) return toast(t('Nothing to save yet.'), 'warn'); addHistory(catId, ed.text, 'manual'); lintEditor(catId); toast(t('Version saved'), 'ok'); },
    wbTemplate(el) {
      const catId = el.dataset.arg; if (!editorOf(catId).text.trim()) return toast(t('Nothing to save yet.'), 'warn');
      modal(t('Save as template'), '<div class="field"><label for="tplName">' + esc(t('Template name')) + '</label><input id="tplName" type="text" value="' + esc(K.get(catId).label + ' — ' + U.fmtDate(U.now())) + '"></div><p class="muted small">' + esc(t('The game title and logline are replaced by placeholders so the template works for other projects.')) + '</p>', [{ label: t('Save template'), action: 'doSaveTemplate', arg: catId, primary: true }]);
    },
    async doSaveTemplate(el) {
      const catId = el.dataset.arg, name = ($('#tplName').value || '').trim();
      if (!name) return toast(t('Template name is required.'), 'error');
      const tpl = { id: U.uid('TPL'), name, category: catId, body: A.templates.fromText(editorOf(catId).text, st.project), createdAt: U.now() };
      await St.putTemplate(tpl); st.templates = await St.listTemplates(); closeModal(); toast(t('Template saved'), 'ok');
    },
    wbPhase(el) {
      const [catId, i] = el.dataset.arg.split('|'); const ed = editorOf(catId);
      ed.phaseIndex = +i; setEditor(catId, st.phases[catId][+i].text); render();
    },
    wbAI(el) { aiPrepare(el.dataset.arg); },
    async doAI(el) { await aiRun(el.dataset.arg); },

    tplSelect(el) { st.tplSel = el.dataset.arg; st.tplOut = ''; render(); },
    tplRender() {
      const tpl = allTemplates().find((x) => x.id === st.tplSel); if (!tpl) return;
      if (tpl.needsCharacter && !st.tplChar) return toast(t('Select a character for this template.'), 'warn');
      st.tplOut = A.templates.render(tpl, st.project, st.tplChar); render();
    },
    tplCopy() { if (st.tplOut) copyText(st.tplOut); else toast(t('Render the template first.'), 'warn'); },
    tplDownload() { if (st.tplOut) download(U.slug(st.tplSel) + '.md', st.tplOut, 'text/markdown'); else toast(t('Render the template first.'), 'warn'); },
    tplToHistory() {
      if (!st.tplOut) return toast(t('Render the template first.'), 'warn');
      const tpl = allTemplates().find((x) => x.id === st.tplSel); const cat = K.LIST.some((c) => c.id === tpl.category) ? tpl.category : 'planning';
      editorOf(cat); addHistory(cat, st.tplOut, 'template', { title: tpl.name }); st.view = 'wb:' + cat; render();
    },
    tplNew() { st.tplDraft = { id: U.uid('TPL'), name: '', category: 'planning', body: '' }; templateModal(); },
    tplEdit() { const tpl = st.templates.find((x) => x.id === st.tplSel); if (!tpl) return; st.tplDraft = U.clone(tpl); templateModal(); },
    async tplSave() {
      const d = st.tplDraft; d.name = ($('#tdName').value || '').trim(); d.category = $('#tdCat').value; d.body = $('#tdBody').value;
      if (!d.name || !d.body.trim()) return toast(t('Name and body are required.'), 'error');
      await St.putTemplate(d); st.templates = await St.listTemplates(); st.tplSel = d.id; closeModal(); render(); toast(t('Template saved'), 'ok');
    },
    tplAskDelete() { confirmModal(t('Delete template'), t('Delete this template?'), 'tplDelete', st.tplSel, true); },
    async tplDelete(el) { await St.deleteTemplate(el.dataset.arg); st.templates = await St.listTemplates(); st.tplSel = null; closeModal(); render(); },

    histRestore(el) {
      const h = st.project.history.find((x) => x.id === el.dataset.arg); if (!h) return;
      if (h.options) st.project.workbench[h.category] = Object.assign({}, h.options);
      const ed = editorOf(h.category); ed.text = h.text; ed.entryId = h.id; ed.aiGenerated = h.action === 'ai'; ed.notes = [t('Restored version') + ' ' + h.id];
      st.phases[h.category] = null; st.view = 'wb:' + h.category; touch(); render(); toast(t('Version restored into the editor'), 'ok');
    },
    histDownload(el) { const h = st.project.history.find((x) => x.id === el.dataset.arg); if (h) download(U.slug(st.project.name) + '_' + h.id + '.md', h.text, 'text/markdown'); },
    histCopy(el) { const h = st.project.history.find((x) => x.id === el.dataset.arg); if (h) copyText(h.text); },
    histDelete(el) { st.project.history = st.project.history.filter((x) => x.id !== el.dataset.arg); touch(); render(); },
    histCompare(el) { const h = st.project.history.find((x) => x.id === el.dataset.arg); if (h) compareModal(h.category, h.id); },

    async checkServer() { await checkServer(true); },
    addModel() { st.settings.catalog.push({ id: 'claude-model-id', label: 'New model', tier: 'balanced', inPrice: 1, outPrice: 5 }); saveSettings(); render(); },
    delModel(el) { st.settings.catalog.splice(+el.dataset.arg, 1); saveSettings(); render(); },
    resetCatalog() { st.settings.catalog = U.clone(R.DEFAULT_CATALOG); saveSettings(); render(); toast(t('Catalog reset to defaults'), 'ok'); },
    addProvider() { st.settings.customProviders.push({ id: 'custom-' + Date.now().toString(36), label: 'Custom image tool', style: 'tags', negative: 'field', negativePrefix: '', aspectSyntax: '', maxChars: 1500, referenceNote: '' }); saveSettings(); render(); },
    delProvider(el) { st.settings.customProviders.splice(+el.dataset.arg, 1); saveSettings(); render(); },
    async exportAll() {
      const all = await St.listProjects();
      download('agps-all-projects-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ format: 'agps-collection', exportedAt: U.now(), projects: all.map((p) => JSON.parse(S.exportProject(p)).project) }, null, 2), 'application/json');
    },
    askClearAll() { confirmModal(t('Delete all local data'), t('This deletes every project, template and setting stored in this browser. Export first if needed.'), 'clearAll', '', true); },
    async clearAll() { await St.clearAll(); st.projects = []; st.project = null; st.templates = []; st.settings = U.clone(DEFAULT_SETTINGS); closeModal(); st.view = 'projects'; render(); toast(t('All local data deleted'), 'ok'); },
    runQA() { runQA(); },
  };

  function showSpecError(catId, r) {
    const ed = editorOf(catId); ed.error = t(r.error); lintEditor(catId); ed.error = null; toast(t(r.error), 'error');
  }

  function generate(catId) {
    const r = currentSpec(catId);
    if (r.error) return showSpecError(catId, r);
    const ed = editorOf(catId), o = wbOptions(catId);
    const compiled = P.compile(r.spec, o.quality);
    st.phases[catId] = null; ed.phaseIndex = 0; ed.notes = [];
    let text = compiled.text;
    const mode = ed.phaseMode;
    if (mode && mode !== 'off') {
      const forced = mode === 'auto' ? 0 : +mode;
      if (forced || compiled.overLimit) {
        const ph = P.compilePhases(r.spec, o.quality, r.spec.toolTokenLimit ? Math.min(r.spec.toolTokenLimit, 8000) : 6000, forced);
        if (ph) { st.phases[catId] = ph; text = ph[0].text; ed.notes.push(t('Split into') + ' ' + ph.length + ' ' + t('coordinated phases. Use the phase tabs to view each one.')); }
        else ed.notes.push(t('This prompt has too few instruction groups to split into phases.'));
      } else ed.notes.push(t('Prompt fits the target tool limit; no phase split needed.'));
    }
    if (compiled.overLimit && !st.phases[catId]) ed.notes.push(t('Prompt is larger than the recommended size for this tool. Consider enabling phase splitting.'));
    addHistory(catId, text, 'generate', { title: r.spec.title });
    render();
    if (window.innerWidth < 1100) { const e = $('#editor'); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'start' }); }
  }

  function compareModal(catId, preselect) {
    const hs = st.project.history.filter((h) => h.category === catId).slice().reverse();
    if (!hs.length) return toast(t('No saved versions yet for this workbench.'), 'warn');
    const optsHtml = (sel) => '<option value="editor"' + (sel === 'editor' ? ' selected' : '') + '>' + esc(t('Current editor text')) + '</option>' + hs.map((h) => '<option value="' + esc(h.id) + '"' + (h.id === sel ? ' selected' : '') + '>' + esc(h.id + ' · ' + h.action + ' · ' + U.fmtDate(h.createdAt)) + '</option>').join('');
    const a = preselect || (hs[1] ? hs[1].id : hs[0].id);
    modal(t('Compare versions'), '<div class="row"><div class="field"><label for="cmpA">' + esc(t('Version A (old)')) + '</label><select id="cmpA" data-cat="' + catId + '">' + optsHtml(a) + '</select></div><div class="field"><label for="cmpB">' + esc(t('Version B (new)')) + '</label><select id="cmpB">' + optsHtml('editor') + '</select></div></div><div id="cmpOut"></div>', [{ label: t('Compare'), action: 'runCompare', primary: true }], { wide: true });
    ACTIONS.runCompare();
  }

  /* ---------------- AI ---------------- */
  function aiPrepare(catId) {
    const ed = editorOf(catId);
    if (!ed.text.trim()) return toast(t('Generate a prompt first; the AI improves the compiled prompt.'), 'warn');
    const r = routeFor(catId);
    if (r.local) {
      return modal(t('AI model not used'), '<p>' + r.reason.map(esc).join('<br>') + '</p><p class="muted small">' + esc(t('To enable AI: run the optional server (npm start in prompt-studio) with ANTHROPIC_API_KEY set on the server, then select ECONOMY, INTELLIGENT or MAXIMUM QUALITY in AI Models. Keys never go into this page.')) + '</p>', [{ label: t('Copy prompt instead'), action: 'wbCopy', arg: catId, primary: true }, { label: t('Open AI Models'), action: 'go', arg: 'models' }]);
    }
    const avail = st.settings.catalog.filter((m) => st.server.models.includes(m.id));
    const action = ($('#refineNote') || {}).value ? 'refine' : 'enhance';
    st.aiPending = { catId, note: ($('#refineNote') || {}).value || '', action };
    modal(t('Confirm paid AI request'), '<p>' + r.reason.map(esc).join('<br>') + '</p>' +
      '<div class="field"><label for="aiModel">' + esc(t('Model')) + '</label><select id="aiModel">' + avail.map((m) => '<option value="' + esc(m.id) + '"' + (m.id === r.model.id ? ' selected' : '') + '>' + esc(m.label + ' ($' + m.inPrice + ' / $' + m.outPrice + ' per MTok)') + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="aiAction">' + esc(t('Task')) + '</label><select id="aiAction">' + Object.keys(R.ACTIONS).map((k) => '<option value="' + k + '"' + (k === action ? ' selected' : '') + '>' + esc(t(k)) + ' — ' + esc(t(R.ACTIONS[k])) + '</option>').join('') + '</select></div>' +
      '<p class="muted small">' + esc(t('The request goes to your studio server, which calls the API with its own key. Nothing is sent until you confirm.')) + '</p>', [{ label: t('Send request'), action: 'doAI', arg: catId, primary: true }]);
  }

  async function aiRun(catId) {
    const model = $('#aiModel').value, action = $('#aiAction').value;
    const ed = editorOf(catId), r = currentSpec(catId);
    const meta = Object.assign({}, (r.spec && r.spec.meta) || {}, { toolLabel: r.spec ? r.spec.toolLabel : catId });
    const body = $('.modal-body'); body.innerHTML = '<p class="busy">' + esc(t('Waiting for the model…')) + '</p>';
    try {
      const res = await A.ai.generate(st.settings.serverUrl, { model, action, system: R.systemPrompt(meta), prompt: ed.text, instruction: R.ACTIONS[action], note: st.aiPending ? st.aiPending.note : '', quality: wbOptions(catId).quality }, sessionAccess());
      if (!res || typeof res.text !== 'string' || !res.text.trim()) throw new Error(t('Empty response') + (res && res.stopReason ? ' (stop reason: ' + res.stopReason + ')' : ''));
      addHistory(catId, res.text, 'ai', { model: { requested: model, served: res.model, usage: res.usage || null, stopReason: res.stopReason || '' } });
      ed.aiGenerated = true;
      ed.notes = [t('Response received from') + ' ' + res.model + ' (' + t('as reported by the API') + ')' + (res.usage ? ' · ' + res.usage.input_tokens + ' in / ' + res.usage.output_tokens + ' out tokens' : '') + (res.fallback ? ' · ' + t('served by fallback model') : '')];
      closeModal(); render(); toast(t('AI response added as a new version'), 'ok');
    } catch (e) {
      body.innerHTML = '<p class="err-text">' + esc(t('AI request failed')) + ': ' + esc(e.message) + '</p><p class="muted small">' + esc(t('No AI output was produced. The local prompt in the editor is unchanged.')) + '</p>';
    }
  }

  function sessionAccess() { try { return sessionStorage.getItem('agps-access') || ''; } catch (e) { return ''; } }

  function aiAnalyze(assetId) {
    const a = st.project.assets.find((x) => x.id === assetId);
    if (!st.server.available || !st.server.imageAnalysis) {
      return modal(t('Image analysis unavailable'), '<p>' + esc(t('Image analysis needs the optional studio server with an API key configured server-side. Until then, the asset stays marked "not analysed" and prompts never claim its contents were seen.')) + '</p><p class="muted small">' + esc(st.server.error || '') + '</p>', [{ label: t('Open AI Models'), action: 'go', arg: 'models' }]);
    }
    const r = R.route({ mode: st.settings.aiMode === 'local' ? 'intelligent' : st.settings.aiMode, task: { taskType: 'image-analysis', complexity: 40, inputTokens: 1200 }, catalog: st.settings.catalog, server: st.server });
    if (r.local) return toast(r.reason.join(' '), 'warn');
    st.aiPending = { assetId, model: r.model.id };
    modal(t('Analyse image with AI'), '<p>' + esc(t('Asset')) + ': <b>' + esc(a.name) + '</b></p><p>' + r.reason.map(esc).join('<br>') + '</p><p class="muted small">' + esc(t('A 768 px preview copy is sent to your studio server. The analysis is stored on the asset and cited in prompts as AI analysis.')) + '</p>', [{ label: t('Analyse'), action: 'doAnalyze', arg: assetId, primary: true }]);
  }
  async function runAnalyze(assetId) {
    const a = st.project.assets.find((x) => x.id === assetId);
    const ch = st.project.characters.find((c) => c.id === a.characterId);
    const body = $('.modal-body'); body.innerHTML = '<p class="busy">' + esc(t('Analysing…')) + '</p>';
    try {
      const m = /^data:(image\/\w+);base64,(.*)$/.exec(a.thumbnail || '');
      if (!m) throw new Error('no preview image stored for this asset');
      const res = await A.ai.analyzeImage(st.settings.serverUrl, { model: st.aiPending.model, mediaType: m[1], imageBase64: m[2], characterSpec: ch ? A.context.characterLock(ch, 2).join('\n') : '' }, sessionAccess());
      a.analyzed = true; a.analysis = { model: res.model, at: U.now(), text: res.text };
      closeModal(); touch(); render(); toast(t('Analysis stored on asset') + ' ' + a.id, 'ok');
    } catch (e) { body.innerHTML = '<p class="err-text">' + esc(t('Analysis failed')) + ': ' + esc(e.message) + '</p>'; }
  }

  async function checkServer(manual) {
    st.server = await A.ai.status(st.settings.serverUrl, sessionAccess());
    renderShell();
    if (st.view === 'models' || st.view.startsWith('wb:')) render();
    if (manual) toast(st.server.available ? t('AI backend connected') + ' (' + st.server.models.join(', ') + ')' : t('AI backend unavailable') + ': ' + st.server.error, st.server.available ? 'ok' : 'warn');
  }

  /* ---------------- Templates ---------------- */
  const allTemplates = () => A.templates.BUILTIN.concat(st.templates);
  function viewTemplates() {
    const list = allTemplates().map((tp) => '<button class="list-item' + (tp.id === st.tplSel ? ' active' : '') + '" data-action="tplSelect" data-arg="' + esc(tp.id) + '"><b>' + esc(tp.name) + '</b><small>' + esc(tp.category) + (tp.builtin ? ' · ' + t('built-in') : ' · ' + t('yours')) + '</small></button>').join('');
    const tp = allTemplates().find((x) => x.id === st.tplSel);
    const detail = tp ? '<h2>' + esc(tp.name) + '</h2><pre class="wrap tpl-body">' + esc(tp.body) + '</pre>' +
      (tp.needsCharacter || /character\./.test(tp.body) ? fld({ label: 'Character', bind: 'tc:char', type: 'select', value: st.tplChar, options: [['', '— select —']].concat(st.project.characters.map((c) => [c.id, c.name])) }) : '') +
      '<div class="row">' + btn('Fill with project data', 'tplRender', { cls: 'primary' }) + btn('Copy', 'tplCopy') + btn('Download', 'tplDownload') + btn('Open in workbench', 'tplToHistory') + (tp.builtin ? '' : btn('Edit', 'tplEdit') + btn('Delete', 'tplAskDelete', { cls: 'danger' })) + '</div>' +
      (st.tplOut ? '<label for="tplOut">' + esc(t('Result')) + '</label><textarea id="tplOut" class="editor small" readonly>' + esc(st.tplOut) + '</textarea>' + msgList(P.lint(st.tplOut, { mode: st.project.mode }).map((i) => t(i.message)), 'warn') : '')
      : '<p class="muted">' + esc(t('Select a template.')) + '</p>';
    return '<section class="panel"><div class="split"><aside class="list"><div class="row">' + btn('+ New template', 'tplNew', { cls: 'primary' }) + '</div>' + list + '</aside><div class="detail"><h1>' + esc(t('Templates')) + '</h1><p class="muted small">' + esc(t('Placeholders like {{profile.title}} or {{character.name}} are filled from the open project. Unfilled values appear as [MISSING: …] and are flagged by Correct.')) + '</p>' + detail + '</div></div></section>';
  }
  function templateModal() {
    const d = st.tplDraft;
    modal(t('Template'), '<div class="field"><label for="tdName">' + esc(t('Name')) + '</label><input id="tdName" type="text" value="' + esc(d.name) + '"></div><div class="field"><label for="tdCat">' + esc(t('Category')) + '</label><select id="tdCat">' + K.LIST.map((c) => '<option value="' + c.id + '"' + (c.id === d.category ? ' selected' : '') + '>' + esc(t(c.label)) + '</option>').join('') + '</select></div><div class="field"><label for="tdBody">' + esc(t('Body')) + '</label><textarea id="tdBody" rows="12">' + esc(d.body) + '</textarea><small>' + esc(t('Available: {{profile.title}}, {{profile.logline}}, {{profile.renderMode}}, {{engineLabel}}, {{genreLabel}}, {{character.name}}, {{character.eyeColor}}, {{date}} …')) + '</small></div>', [{ label: t('Save template'), action: 'tplSave', primary: true }], { wide: true });
  }

  /* ---------------- History ---------------- */
  function viewHistory() {
    const hs = st.project.history.filter((h) => !st.histFilter || h.category === st.histFilter).slice().reverse();
    const rows = hs.map((h) => '<tr><td><code>' + esc(h.id) + '</code></td><td>' + esc(U.fmtDate(h.createdAt)) + '</td><td>' + esc(t(K.get(h.category).label)) + '</td><td>' + badge(h.action, h.action) + (h.model ? '<br><small>' + esc(t('served by')) + ' ' + esc(h.model.served) + '</small>' : '') + '</td><td>' + esc(h.quality || '') + '</td><td class="clip">' + esc((h.title || h.text.split('\n')[0]).slice(0, 90)) + '</td><td class="actions">' + btn('Restore', 'histRestore', { arg: h.id, cls: 'primary' }) + btn('Compare', 'histCompare', { arg: h.id }) + btn('Copy', 'histCopy', { arg: h.id }) + btn('Download', 'histDownload', { arg: h.id }) + btn('Delete', 'histDelete', { arg: h.id, cls: 'danger' }) + '</td></tr>').join('');
    return '<section class="panel"><h1>' + esc(t('Prompt History')) + '</h1><div class="row">' + fld({ label: 'Filter by workbench', bind: 'hf:cat', type: 'select', value: st.histFilter, options: [['', 'All']].concat(K.LIST.map((c) => [c.id, c.label])), rerender: true }) + '<span class="muted small">' + esc(t('Up to')) + ' ' + S.HISTORY_LIMIT + ' ' + esc(t('versions are kept per project (oldest dropped first).')) + '</span></div>' +
      (rows ? '<div class="table-wrap"><table><thead><tr><th>ID</th><th>' + esc(t('Created')) + '</th><th>' + esc(t('Workbench')) + '</th><th>' + esc(t('Action')) + '</th><th>' + esc(t('Quality')) + '</th><th>' + esc(t('Title')) + '</th><th>' + esc(t('Actions')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">' + esc(t('No prompt versions yet.')) + '</p>') + '</section>';
  }

  /* ---------------- Models ---------------- */
  function viewModels() {
    const s = st.settings;
    const modes = R.MODES.map((m) => '<label class="mode-card' + (s.aiMode === m.id ? ' active' : '') + '"><input type="radio" name="aiMode" value="' + m.id + '" data-bind="s:aiMode" data-rerender="1"' + (s.aiMode === m.id ? ' checked' : '') + '><b>' + esc(m.label) + '</b><span>' + esc(t(m.desc)) + '</span></label>').join('');
    const cat = s.catalog.map((m, i) => '<tr><td><input aria-label="' + esc(t('Label')) + '" data-bind="m:' + i + '.label" value="' + esc(m.label) + '"></td><td><input aria-label="' + esc(t('API model ID')) + '" data-bind="m:' + i + '.id" value="' + esc(m.id) + '"></td><td><select aria-label="' + esc(t('Tier')) + '" data-bind="m:' + i + '.tier">' + R.TIERS.map((x) => '<option' + (x === m.tier ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></td><td><input aria-label="' + esc(t('Input $/MTok')) + '" type="number" step="0.01" data-type="number" data-bind="m:' + i + '.inPrice" value="' + m.inPrice + '"></td><td><input aria-label="' + esc(t('Output $/MTok')) + '" type="number" step="0.01" data-type="number" data-bind="m:' + i + '.outPrice" value="' + m.outPrice + '"></td><td>' + (st.server.models.includes(m.id) ? badge(t('enabled on server'), 'ok') : badge(t('not on server'), 'muted')) + '</td><td>' + btn('Remove', 'delModel', { arg: i, cls: 'danger small' }) + '</td></tr>').join('');
    const sampleTasks = [['template', 10], ['metadata', 15], ['image-prompt', 30], ['single-system', 45], ['multi-system', 75], ['architecture', 75], ['android-failure', 70]];
    const fake = { available: true, models: s.catalog.map((m) => m.id) };
    const preview = sampleTasks.map(([tt, cx]) => { const r = R.route({ mode: s.aiMode, task: { taskType: tt, complexity: cx, inputTokens: 3000, quality: 2 }, catalog: s.catalog, server: fake }); return '<tr><td>' + esc(tt) + '</td><td>' + (r.local ? 'LOCAL' : esc(r.model.label)) + '</td><td class="small">' + esc(r.reason[0]) + '</td></tr>'; }).join('');
    return '<section class="panel"><h1>' + esc(t('AI Models')) + '</h1>' +
      '<div class="banner">' + esc(t('A prompt cannot switch the model used on claude.ai or other chat websites. Automatic routing only works through the optional studio server, which calls the API with credentials stored on the server. API keys are never stored in this page, in exports, or in the Android app.')) + '</div>' +
      '<h2>' + esc(t('Operating mode')) + '</h2><div class="mode-grid">' + modes + '</div>' +
      '<h2>' + esc(t('Studio server')) + '</h2><div class="row">' + fld({ label: 'Server URL (blank = same origin)', bind: 's:serverUrl', value: s.serverUrl, placeholder: 'http://localhost:8787' }) +
      '<div class="field"><label for="accessPass">' + esc(t('Server access passphrase (optional, kept for this tab only)')) + '</label><input id="accessPass" type="password" autocomplete="off" data-bind="sa:pass" value="' + esc(sessionAccess()) + '"></div>' + btn('Check connection', 'checkServer', { cls: 'primary' }) + '</div>' +
      '<p>' + (st.server.available ? badge(t('Connected'), 'ok') + ' ' + esc(t('Models enabled on server')) + ': ' + esc(st.server.models.join(', ')) + (st.server.imageAnalysis ? ' · ' + esc(t('image analysis available')) : '') : badge(t('Unavailable'), 'muted') + ' ' + esc(st.server.error)) + '</p>' +
      '<h2>' + esc(t('Model catalog')) + '</h2><p class="muted small">' + esc(t('Prices are USD per million tokens and are used for estimates only. Edit them if your pricing differs.')) + '</p><div class="table-wrap"><table class="catalog"><thead><tr><th>' + esc(t('Label')) + '</th><th>' + esc(t('API model ID')) + '</th><th>' + esc(t('Tier')) + '</th><th>' + esc(t('Input $/MTok')) + '</th><th>' + esc(t('Output $/MTok')) + '</th><th>' + esc(t('Server')) + '</th><th></th></tr></thead><tbody>' + cat + '</tbody></table></div><div class="row">' + btn('+ Add model', 'addModel') + btn('Reset to defaults', 'resetCatalog') + '</div>' +
      '<h2>' + esc(t('Routing preview')) + '</h2><p class="muted small">' + esc(t('How the current mode would route typical tasks if every catalog model were enabled on the server.')) + '</p><div class="table-wrap"><table><thead><tr><th>' + esc(t('Task type')) + '</th><th>' + esc(t('Model')) + '</th><th>' + esc(t('Reason')) + '</th></tr></thead><tbody>' + preview + '</tbody></table></div></section>';
  }

  /* ---------------- Settings ---------------- */
  function viewSettings() {
    const s = st.settings;
    const provs = s.customProviders.map((p, i) => '<fieldset class="panel inner"><legend>' + esc(p.label) + '</legend><div class="form-grid">' +
      fld({ label: 'Label', bind: 'cp:' + i + '.label', value: p.label }) + fld({ label: 'ID', bind: 'cp:' + i + '.id', value: p.id }) +
      fld({ label: 'Prompt style', bind: 'cp:' + i + '.style', type: 'select', value: p.style, options: [['tags', 'Comma-separated tags'], ['prose', 'Natural-language prose']] }) +
      fld({ label: 'Negative prompt', bind: 'cp:' + i + '.negative', type: 'select', value: p.negative, options: [['field', 'Separate field'], ['inline', 'Inline in prompt'], ['none', 'Not supported']] }) +
      fld({ label: 'Inline negative prefix', bind: 'cp:' + i + '.negativePrefix', value: p.negativePrefix, placeholder: 'Avoid: ' }) +
      fld({ label: 'Aspect syntax ({w} {h})', bind: 'cp:' + i + '.aspectSyntax', value: p.aspectSyntax, placeholder: '--ar {w}:{h}' }) +
      fld({ label: 'Max prompt characters', bind: 'cp:' + i + '.maxChars', type: 'number', dtype: 'number', value: p.maxChars }) +
      fld({ label: 'Reference image note', bind: 'cp:' + i + '.referenceNote', value: p.referenceNote }) + '</div>' + btn('Remove provider', 'delProvider', { arg: i, cls: 'danger' }) + '</fieldset>').join('');
    return '<section class="panel"><h1>' + esc(t('Settings')) + '</h1><div class="form-grid">' +
      fld({ label: 'Interface language', bind: 's:lang', type: 'select', value: s.lang, options: [['en', 'English'], ['es', 'Español']], rerender: true, help: 'Generated technical prompts are always in English.' }) +
      fld({ label: 'Autosave', bind: 's:autosave', type: 'checkbox', value: s.autosave }) + '</div>' +
      '<h2>' + esc(t('Custom image-generation providers')) + '</h2><p class="muted small">' + esc(t('Configure other image tools (e.g. Stable Diffusion front-ends). Each gets its own adapter settings.')) + '</p>' + provs + btn('+ Add provider', 'addProvider') +
      '<h2>' + esc(t('Data')) + '</h2><p class="muted small">' + esc(t('Storage backend')) + ': ' + (St.backend.persistent ? 'IndexedDB' : esc(t('memory only — data is lost when the tab closes')) + (St.lastError ? ' (' + esc(St.lastError) + ')' : '')) + '</p><div class="row">' + btn('Export all projects', 'exportAll') + '<label class="btn file-btn">' + esc(t('Import project JSON')) + '<input type="file" accept="application/json,.json" data-action-change="importProject" class="sr-only"></label>' + btn('Delete all local data', 'askClearAll', { cls: 'danger' }) + '</div></section>';
  }

  /* ---------------- QA ---------------- */
  const MANUAL_QA = ['Create a project, reload the page, project is still there', 'Generate an image prompt for each provider and inspect syntax', 'Export a project JSON and re-import it', 'Use the app at 360 px width: no horizontal scrolling, buttons reachable', 'Turn off the network: app still works in LOCAL mode', 'Stop the server: AI button explains fallback instead of failing', 'Character prompts include the continuity lock and IDs', 'Android plan for an HTML5 project uses Capacitor; for Godot/Unity it does not'];
  function viewQA() {
    const q = st.qa;
    const res = q ? '<p>' + badge(q.passed + ' ' + t('passed'), 'ok') + ' ' + (q.failed ? badge(q.failed + ' ' + t('failed'), 'error') : '') + ' <span class="muted small">' + q.ms + ' ms</span></p><div class="table-wrap"><table><thead><tr><th>' + esc(t('Suite')) + '</th><th>' + esc(t('Test')) + '</th><th>' + esc(t('Result')) + '</th></tr></thead><tbody>' + q.results.map((r) => '<tr class="' + (r.ok ? '' : 'fail') + '"><td>' + esc(r.suite) + '</td><td>' + esc(r.name) + '</td><td>' + (r.ok ? '✓' : '✗ ' + esc(r.error)) + '</td></tr>').join('') + '</tbody></table></div>' : '';
    const manual = MANUAL_QA.map((m, i) => '<label class="chip block"><input type="checkbox" data-bind="qm:' + i + '"' + (st.settings.qaManual[i] ? ' checked' : '') + '> ' + esc(t(m)) + '</label>').join('');
    return '<section class="panel"><h1>' + esc(t('QA & Diagnostics')) + '</h1><p class="muted">' + esc(t('Runs the same automated test suite as `npm test` inside this browser, using an isolated in-memory store (your data is not touched).')) + '</p>' + btn('Run automated tests', 'runQA', { cls: 'primary' }) + res +
      '<h2>' + esc(t('Manual checklist')) + '</h2>' + manual +
      '<h2>' + esc(t('Environment')) + '</h2><ul class="small"><li>' + esc(t('Storage')) + ': ' + esc(St.backend.name) + '</li><li>' + esc(t('AI backend')) + ': ' + esc(st.server.available ? 'connected' : st.server.error) + '</li><li>' + esc(t('Service worker')) + ': ' + esc('serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'active' : 'supported, not controlling yet') : 'not supported') + '</li><li>Viewport: ' + window.innerWidth + '×' + window.innerHeight + '</li></ul></section>';
  }
  async function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('cannot load ' + src)); document.body.appendChild(s); });
  }
  async function runQA() {
    try {
      await loadScript('tests/harness.js');
      for (const f of (A.testFiles || [])) await loadScript('tests/specs/' + f);
      st.qa = await A.testHarness.run(); render();
      toast(st.qa.failed ? st.qa.failed + ' ' + t('tests failed') : t('All tests passed'), st.qa.failed ? 'error' : 'ok');
    } catch (e) { toast(t('Could not run tests') + ': ' + e.message, 'error'); }
  }

  /* ---------------- input binding ---------------- */
  function readValue(el) {
    const ty = el.dataset.type;
    if (ty === 'bool') return el.checked;
    if (ty === 'checks') return $$('[data-bind="' + el.dataset.bind + '"]:checked').map((x) => x.value);
    if (ty === 'number') return el.value === '' ? '' : Number(el.value);
    if (ty === 'list') return U.list(el.value);
    return el.value;
  }

  function onInput(e) {
    const el = e.target;
    const bind = el.dataset && el.dataset.bind;
    if (!bind) return;
    const idx = bind.indexOf(':');
    const kind = bind.slice(0, idx), path = bind.slice(idx + 1);
    const val = readValue(el);
    const isChange = e.type === 'change';
    const p = st.project;
    switch (kind) {
      case 'p': U.set(p, path, val); if (path === 'name') renderShell(); touch(); break;
      case 'c': {
        const c = p.characters.find((x) => x.id === st.selChar); if (!c) return;
        if (path === 'id') {
          const nv = String(val).trim();
          if (!isChange) return;
          if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,40}$/.test(nv) || p.characters.some((x) => x.id === nv && x !== c)) { toast(t('Invalid or duplicate character ID'), 'error'); el.value = c.id; return; }
          p.assets.forEach((a) => { if (a.characterId === c.id) a.characterId = nv; });
          Object.values(p.workbench).forEach((o) => { if (o.characterId === c.id) o.characterId = nv; });
          c.id = nv; st.selChar = nv; touch(); render(); return;
        }
        c[path] = val; touch();
        const v = S.validateCharacter(c, p); const box = $('#charValidation'); if (box) box.innerHTML = msgList(v.errors, 'error') + msgList(v.warnings, 'warn');
        if (path === 'name' && isChange) render();
        break;
      }
      case 'w': {
        const [cat, key] = path.split('.');
        wbOptions(cat)[key] = val; touch();
        if (el.dataset.rerender && isChange) { const f = $('#wbForm'); if (f) { f.innerHTML = '<h2>' + esc(t('Configuration')) + '</h2>' + wbFieldsHtml(cat) + '<button class="btn primary form-generate" data-action="wbGenerate" data-arg="' + cat + '">' + esc(t('Generate prompt')) + '</button>'; const n = document.getElementById(el.id); if (n) n.focus(); } updateRouteLine(cat); }
        break;
      }
      case 'e': editorOf(path).text = el.value; lintSoon(); break;
      case 'ph': editorOf(path).phaseMode = val; break;
      case 's':
        if (el.type === 'radio' && !el.checked) return;
        st.settings[path] = val; saveSettings();
        if (path === 'lang') A.i18n.setLang(val);
        if (path === 'serverUrl') { if (isChange) checkServer(); return; }
        if (el.dataset.rerender && isChange) render();
        break;
      case 'sa': try { sessionStorage.setItem('agps-access', val); } catch (err) { /* ignore */ } break;
      case 'm': { const [i, k] = path.split('.'); st.settings.catalog[+i][k] = val; saveSettings(); break; }
      case 'cp': { const [i, k] = path.split('.'); st.settings.customProviders[+i][k] = val; saveSettings(); break; }
      case 'a': if (st.assetDraft) U.set(st.assetDraft, path, val); break;
      case 'f': st.assetFilter[path] = val; if (isChange) render(); break;
      case 'hf': st.histFilter = val; if (isChange) render(); break;
      case 'tc': st.tplChar = val; break;
      case 'qm': st.settings.qaManual[path] = val; saveSettings(); break;
      default: break;
    }
    if (kind === 'p' && el.dataset.rerender && isChange) render();
  }

  async function onFileChange(e) {
    const el = e.target, act = el.dataset.actionChange;
    if (!act) return;
    const files = Array.from(el.files || []);
    el.value = '';
    if (!files.length) return;
    if (act === 'importProject') {
      try {
        const text = await files[0].text();
        let data; try { data = JSON.parse(text); } catch (err) { data = null; }
        const list = data && data.format === 'agps-collection' ? data.projects.map((p) => JSON.stringify(p)) : [text];
        const ids = st.projects.map((p) => p.id);
        let last = null, warns = [];
        for (const item of list) {
          const r = S.importProject(item, ids);
          if (r.errors.length) warns = warns.concat(r.errors);
          await St.putProject(r.project); ids.push(r.project.id); last = r.project;
        }
        st.projects = await St.listProjects();
        if (last) { st.project = last; st.editors = {}; st.phases = {}; st.view = 'profile'; st.settings.lastProjectId = last.id; saveSettings(); }
        render(); toast(t('Imported') + ' ' + list.length + ' ' + t('project(s)') + (warns.length ? ' — ' + t('with validation issues') + ': ' + warns.slice(0, 3).join('; ') : ''), warns.length ? 'warn' : 'ok');
      } catch (err) { toast(t('Import failed') + ': ' + err.message, 'error'); }
    } else if (act === 'importFiles') {
      for (const f of files) {
        const ext = (f.name.split('.').pop() || '').toLowerCase();
        const role = /^(png|jpe?g|webp|gif|bmp|avif)$/.test(ext) ? 'generated-image' : /^(glb|gltf|fbx|obj|usdz|stl|blend|dae|vrm)$/.test(ext) ? 'mesh' : /^(wav|ogg|mp3|m4a|flac|opus)$/.test(ext) ? 'audio' : /^(anim|bvh)$/.test(ext) ? 'animation' : /^(mtl|sbsar|mat)$/.test(ext) ? 'material' : 'other';
        const a = S.createAsset({ name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, fileSize: f.size, format: ext.toUpperCase(), role, targetGame: st.project.profile.title, sourceTool: '' });
        if (role === 'generated-image' && f.size < 25e6) { try { a.thumbnail = await makeThumb(f, 768); } catch (err) { /* preview optional */ } }
        st.project.assets.push(a);
      }
      touch(); render(); toast(t('Registered') + ' ' + files.length + ' ' + t('file(s). Contents were not analysed.'), 'ok');
    } else if (act === 'readManifest') {
      const paths = files.map((f) => f.webkitRelativePath || f.name).filter((p) => !/(^|\/)(node_modules|\.git|\.godot|Library|Temp|build|dist)\//.test(p)).sort();
      st.project.existing.sourceManifest = paths.slice(0, 2000).join('\n') + (paths.length > 2000 ? '\n… (' + (paths.length - 2000) + ' more)' : '');
      touch(); render(); toast(t('Recorded') + ' ' + paths.length + ' ' + t('file paths (contents not read).'), 'ok');
    }
  }

  function makeThumb(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('cannot decode image')); };
      img.src = url;
    });
  }

  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) { if (e.target.id === 'modal') closeModal(); return; }
      const fn = ACTIONS[el.dataset.action];
      if (fn) { e.preventDefault(); Promise.resolve(fn(el)).catch((err) => { console.error(err); toast(err.message, 'error'); }); }
    });
    document.addEventListener('submit', (e) => e.preventDefault());
    document.addEventListener('input', (e) => { if (e.target.type !== 'file') onInput(e); });
    document.addEventListener('change', (e) => { if (e.target.type === 'file') onFileChange(e); else onInput(e); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && st.view.startsWith('wb:')) { e.preventDefault(); generate(st.view.slice(3)); }
    });
    window.addEventListener('beforeunload', () => { if (st.saveState === 'unsaved') scheduleSave.flush(); });
    window.addEventListener('online', () => checkServer());
  }

  async function boot() {
    await St.init();
    const s = await St.getSetting('app', null);
    st.settings = Object.assign(U.clone(DEFAULT_SETTINGS), s || {});
    if (!Array.isArray(st.settings.catalog) || !st.settings.catalog.length) st.settings.catalog = U.clone(R.DEFAULT_CATALOG);
    A.i18n.setLang(st.settings.lang);
    st.projects = await St.listProjects();
    st.templates = await St.listTemplates();
    if (st.settings.lastProjectId) { const p = st.projects.find((x) => x.id === st.settings.lastProjectId); if (p) { st.project = S.normalizeProject(p); st.view = 'profile'; } }
    const hash = location.hash.replace('#', '');
    if (hash && (NAV().some((g) => g.items.some((i) => i[0] === hash)))) st.view = hash;
    bindGlobal(); render();
    if (!St.backend.persistent) toast(t('IndexedDB is unavailable; data will not persist after closing this tab. Export your project to keep it.'), 'warn');
    checkServer();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  A.ui = { boot, render, actions: ACTIONS, generate };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})(globalThis.AGPS = globalThis.AGPS || {});

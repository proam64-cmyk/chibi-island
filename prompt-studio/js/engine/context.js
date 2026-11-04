/* Shared prompt-context builders: project summary, character continuity locks, reference honesty. */
(function (A) {
  'use strict';
  const U = A.util, S = A.schema;
  const C = (A.context = {});

  C.genreLabel = (id) => (S.GENRES.find((g) => g.id === id) || { label: id || 'unspecified' }).label;

  /** Lines describing the project. Missing important fields become explicit "not specified" statements. */
  C.projectSummary = function (project, q) {
    const p = project.profile;
    const L = [];
    L.push('Game title: ' + (p.title || project.name || 'untitled (not specified)'));
    if (p.logline) L.push('Logline: ' + p.logline);
    L.push('Genre: ' + C.genreLabel(p.genre) + (p.subgenres.length ? ' (subgenres: ' + p.subgenres.join(', ') + ')' : ''));
    L.push('Rendering mode: ' + p.renderMode);
    L.push('Engine / technology: ' + S.engine(p.engine).label);
    L.push('Target platforms: ' + (p.platforms.length ? p.platforms.join(', ') : 'not specified'));
    L.push('Target frame rate: ' + p.targetFps + ' FPS; preferred orientation: ' + (p.orientation || 'not specified'));
    if (q >= 2 || !p.story) L.push('Story: ' + (p.story || 'not specified'));
    const extra = [
      ['Combat', p.combat], ['Abilities', p.abilities], ['World & level design', p.world], ['Progression', p.progression],
      ['Art direction', p.artDirection], ['Animation', p.animation], ['Save system', p.saveSystem], ['Controls', p.controls],
      ['Difficulty', p.difficulty], ['Audio', p.audio],
    ];
    extra.forEach(([k, v]) => { if (U.has(v)) L.push(k + ': ' + v); });
    if (project.mode === 'existing') L.push('Project status: EXISTING GAME — changes must preserve current working functionality.');
    if (project.isSample) L.push('Note: this is a sample studio profile; no real source files are attached unless listed below.');
    return L;
  };

  /** Fields left empty that matter for implementation; used for "open questions". */
  C.openQuestions = function (project) {
    const p = project.profile, Q = [];
    if (!p.title) Q.push('What is the game title?');
    if (p.engine === 'other') Q.push('Which engine/technology will be used? Implementation details depend on it.');
    if (!p.controls) Q.push('Which control scheme (touch, gamepad, keyboard) is required on each platform?');
    if (!p.saveSystem) Q.push('What must the save system persist, and how many slots?');
    if (!p.difficulty) Q.push('What difficulty options and tuning targets apply?');
    if (!p.combat && ['shmup','bullet-hell','action-rpg','fighting','tactical-rpg'].includes(p.genre)) Q.push('Describe the combat rules (damage model, invulnerability, hit feedback).');
    if (!project.characters.length) Q.push('No characters are registered; add continuity specs before generating character art.');
    if (project.mode === 'existing' && !project.existing.sourceManifest) Q.push('No source manifest was provided; which files/folders make up the project?');
    return Q;
  };

  C.characterById = (project, id) => project.characters.find((c) => c.id === id);

  C.referenceStatus = function (project, ch) {
    const refs = (ch.referenceAssetIds || []).map((id) => project.assets.find((a) => a.id === id)).filter(Boolean);
    const linked = project.assets.filter((a) => a.characterId === ch.id && a.role === 'character-master' && !refs.includes(a));
    const all = refs.concat(linked);
    return {
      all,
      approved: all.filter((a) => a.approval === 'approved'),
      analyzed: all.filter((a) => a.analyzed),
      withUrl: all.filter((a) => a.approval === 'approved' && /^https:\/\//.test(a.publicUrl)),
    };
  };

  /** Honest statement about reference images for a character. */
  C.referenceLines = function (project, ch, toolHint) {
    const r = C.referenceStatus(project, ch);
    const L = [];
    if (!r.all.length) {
      L.push('No master reference image is registered for ' + ch.name + ' (' + ch.id + '). Do not assume one exists. Work only from the written specification below and treat the result as a CANDIDATE master that still needs approval.');
      return L;
    }
    r.all.forEach((a) => {
      let line = 'Registered reference: ' + a.id + ' "' + a.name + '"' + (a.fileName ? ' (file ' + a.fileName + ')' : '') + ' — approval: ' + a.approval + ', version ' + a.version + '.';
      if (a.analyzed) line += ' AI analysis on record (' + a.analysis.model + '): ' + a.analysis.text.slice(0, 400).replace(/\s+/g, ' ');
      else line += ' Its contents have NOT been analysed by the studio; the description below comes from the written character specification.';
      L.push(line);
    });
    if (!r.approved.length) L.push('None of the registered references are approved yet; treat them as provisional.');
    if (toolHint) L.push(toolHint);
    return L;
  };

  C.paletteText = (ch) => (ch.palette && ch.palette.length ? ch.palette.join(', ') : 'not specified');

  /** Full character continuity lock (used in every prompt that involves the character). */
  C.characterLock = function (ch, q) {
    const age = S.ageCategory(ch.ageCategory);
    const L = [];
    L.push('CHARACTER LOCK — ' + ch.name + ' [' + ch.id + ']');
    L.push('- Role: ' + (ch.role || 'unspecified') + '; age category: ' + age.label);
    if (ch.bodyProportions) L.push('- Body proportions: ' + ch.bodyProportions);
    if (ch.face) L.push('- Face: ' + ch.face);
    if (ch.hairstyle) L.push('- Hairstyle: ' + ch.hairstyle);
    if (ch.eyeColor) L.push('- Eye colour: ' + ch.eyeColor);
    if (ch.costume) L.push('- Costume: ' + ch.costume);
    if (ch.weapons) L.push('- Weapons / equipment: ' + ch.weapons);
    L.push('- Colour palette (hex): ' + C.paletteText(ch));
    if (ch.artStyle) L.push('- Art style: ' + ch.artStyle);
    if (q >= 2 && ch.abilities) L.push('- Abilities (for pose/effect context): ' + ch.abilities);
    if (q >= 2 && ch.personality) L.push('- Personality (for expression/acting): ' + ch.personality);
    L.push('- Allowed transformations: ' + (ch.allowedTransformations || 'none — the design must not change'));
    L.push('- FORBIDDEN changes: ' + (ch.forbiddenChanges || 'do not alter face, hair, eye colour, costume, palette or proportions'));
    C.minorSafety(ch).forEach((x) => L.push('- ' + x));
    return L;
  };

  C.minorSafety = function (ch) {
    if (!S.isMinor(ch)) return [];
    return ['Age-appropriate depiction: this character is a minor. Fully clothed, non-sexualised, no suggestive poses, framing or fan-service; modest costume as specified.'];
  };

  C.continuityRules = function (chars) {
    if (!chars.length) return [];
    return [
      'Reuse each character lock verbatim; never improvise new design details that contradict it.',
      'Keep silhouette, hairstyle, eye colour, costume layers, weapon design and palette identical across every image, view and pose.',
      'When a detail is not specified, keep it simple and consistent rather than inventing ornamentation.',
      'Do not merge or swap features between different characters.',
    ];
  };

  C.cleanArtRules = () => [
    'Clean art: no dialogue, no speech bubbles, no captions, no labels, no lettering, no watermarks, no signatures, no UI overlays, no logos.',
  ];

  C.selectedCharacters = function (project, ids) {
    return U.list(ids).map((id) => C.characterById(project, id)).filter(Boolean);
  };
})(globalThis.AGPS = globalThis.AGPS || {});

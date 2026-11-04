/* Built-in reusable prompt templates. {{path}} placeholders resolve against {project, profile, character, existing, date}. */
(function (A) {
  'use strict';
  const T = (A.templates = {});

  T.BUILTIN = [
    {
      id: 'tpl-bug-report', builtin: true, name: 'Quick bug fix request (coding assistant)', category: 'testing',
      body: [
        'You are maintaining "{{profile.title}}" ({{engineLabel}}).',
        'Bug: <describe the bug here>',
        'Steps to reproduce:',
        '1. ',
        'Expected: ',
        'Actual: ',
        '',
        'Rules: read the relevant files first; make the smallest fix for the root cause; add a test that fails before and passes after; do not refactor unrelated code; list files changed.',
      ].join('\n'),
    },
    {
      id: 'tpl-character-quick', builtin: true, name: 'Character quick portrait (any image tool)', category: 'image', needsCharacter: true,
      body: [
        'Anime character portrait of {{character.name}}, {{character.role}}.',
        'Hairstyle: {{character.hairstyle}}. Eye colour: {{character.eyeColor}}. Costume: {{character.costume}}.',
        'Palette: {{character.palette}}. Style: {{character.artStyle}}.',
        'Do not change: {{character.forbiddenChanges}}.',
        'Clean art: no text, no speech bubbles, no watermark.',
      ].join('\n'),
    },
    {
      id: 'tpl-devlog', builtin: true, name: 'Daily dev-log summary request', category: 'planning',
      body: [
        'Summarise today\'s work on "{{profile.title}}" ({{date}}) for my dev log.',
        'Changes made: <paste commit messages or notes>',
        'Format: 3–6 bullet points, then "Next up" with 3 tasks. Keep it under 150 words. Do not invent work that is not in the notes.',
      ].join('\n'),
    },
    {
      id: 'tpl-asset-manifest', builtin: true, name: 'Asset manifest update (routine metadata)', category: 'planning',
      body: [
        'Update the asset manifest of "{{profile.title}}" with the following new files. Keep the existing format and ordering; only add entries.',
        '<paste file list>',
        'Return only the updated manifest section.',
      ].join('\n'),
    },
    {
      id: 'tpl-playtest', builtin: true, name: 'Playtest feedback triage', category: 'testing',
      body: [
        'Triage this playtest feedback for "{{profile.title}}" ({{genreLabel}}, {{profile.renderMode}}).',
        '<paste feedback>',
        'Group into: bugs, balance, UX/controls, art/readability, performance. For each item: severity (1–3), likely cause, suggested minimal fix. Do not propose rewriting working systems.',
      ].join('\n'),
    },
    {
      id: 'tpl-store-listing', builtin: true, name: 'Store listing copy draft', category: 'android',
      body: [
        'Write a Google Play store listing for "{{profile.title}}".',
        'Logline: {{profile.logline}}',
        'Genre: {{genreLabel}}. Key features: <list 4–6>',
        'Output: short description (≤ 80 characters) and full description (≤ 4000 characters). No false claims, no keyword stuffing, no mention of other games.',
      ].join('\n'),
    },
  ];

  T.context = function (project, characterId) {
    const ch = (project.characters || []).find((c) => c.id === characterId) || null;
    return {
      project,
      profile: project.profile,
      existing: project.existing,
      character: ch ? Object.assign({}, ch, { palette: ch.palette.join(', ') }) : null,
      engineLabel: A.schema.engine(project.profile.engine).label,
      genreLabel: A.context.genreLabel(project.profile.genre),
      date: new Date().toISOString().slice(0, 10),
    };
  };

  T.render = (tpl, project, characterId) => A.util.renderTemplate(tpl.body, T.context(project, characterId));

  /** Turn a concrete prompt into a reusable template by replacing project-specific values with placeholders. */
  T.fromText = function (text, project) {
    let body = String(text || '');
    const p = project.profile;
    const subs = [[p.title, '{{profile.title}}'], [p.logline, '{{profile.logline}}']];
    subs.filter(([v]) => v && v.length > 2).forEach(([v, ph]) => { body = body.split(v).join(ph); });
    return body;
  };
})(globalThis.AGPS = globalThis.AGPS || {});

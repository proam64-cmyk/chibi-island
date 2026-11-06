/* Existing-project safety: preservation, audit, backup checkpoint, minimal plan, regression tests, rollback. */
(function (A) {
  'use strict';
  const U = A.util, C = A.context, S = A.schema;
  const E = (A.existing = {});

  E.FOCUS = [
    { id: 'full', label: 'Full safety package + change plan' },
    { id: 'audit', label: 'Audit only (no code changes)' },
    { id: 'bugfix', label: 'Bug fix with preservation' },
    { id: 'feature', label: 'Feature addition with preservation' },
    { id: 'art', label: 'Art/asset update with preservation' },
  ];

  E.build = function (project, options) {
    const o = Object.assign({ tool: 'claude', focus: 'full' }, options || {});
    const q = A.compiler.qLevel(o.quality);
    const tool = A.gameplay.codeTool(o.tool);
    const x = project.existing;
    const working = U.lines(x.workingSystems);
    const changes = U.lines(o.change || x.requestedChanges);
    const bugs = U.lines(x.knownBugs);
    const manifest = U.lines(x.sourceManifest);
    const art = U.lines(x.artReferences);
    const date = new Date().toISOString().slice(0, 10);
    const tag = 'pre-change-' + date;
    const git = x.versionControl !== 'none';
    const sec = { role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [], questions: [] };

    sec.role.push('Senior maintenance engineer for a shipped/working ' + S.engine(project.profile.engine).label + ' game. Your top priority is not breaking anything that already works.');
    sec.mission.push(o.focus === 'audit' ? 'Audit the existing project and report risks. Do NOT change code in this task.' : 'Apply the requested changes to the EXISTING game with the smallest safe modifications, preserving all working functionality and approved art.');
    sec.mission.push('Never replace, regenerate or restart a functioning game. Incremental changes only.');
    C.projectSummary(project, q).forEach((l) => sec.context.push(l));
    if (x.currentVersion) sec.context.push('Current version: ' + x.currentVersion);

    // source access honesty
    if (manifest.length) {
      sec.references.push('Source manifest provided by the developer (paths only; file contents are NOT included in this prompt):');
      manifest.slice(0, q >= 3 ? 400 : 120).forEach((m) => sec.references.push({ t: '`' + m + '`', q: 1 }));
      sec.references.push('Read the real files before editing. If you cannot access them, ask for the specific files — do not reconstruct or invent their contents.');
    } else {
      sec.references.push('No source files or manifest were provided. Do not assume file names, folder layout, frameworks or code structure. First ask for (or list, if you have repository access) the project structure.');
    }
    if (art.length) {
      sec.references.push('Existing approved art/character references (must be preserved, not restyled):');
      art.forEach((a) => sec.references.push('- ' + a));
    }
    project.assets.filter((a) => a.approval === 'approved').forEach((a) => sec.references.push({ t: 'Approved asset ' + a.id + ' "' + a.name + '" (' + a.role + (a.fileName ? ', ' + a.fileName : '') + ') — do not modify or replace.', q: 2 }));

    // preservation requirements
    sec.constraints.push({ sub: 'Preservation requirements', items: (working.length ? working.map((w) => 'MUST keep working exactly as before: ' + w) : ['The developer has not listed working systems yet. Before changing anything, inventory what currently works (run the game) and treat all of it as must-preserve.'])
      .concat([
        'Do not rename, move or delete files unless the change strictly requires it.',
        'Do not change save-file formats without a migration that loads existing saves.',
        'Do not modify approved art, character designs or audio.',
        'Do not upgrade engine/framework/dependency versions as a side effect.',
        'No drive-by refactors or formatting changes outside the touched lines.',
      ]) });
    if (U.has(x.constraints)) sec.constraints.push({ sub: 'Technical constraints from the developer', items: U.lines(x.constraints) });
    A.gameplay.toolFraming(tool.id, project).forEach((l) => sec.constraints.push(l));

    // backup checkpoint
    const backup = git ? [
      'Confirm a clean working tree: `git status` (commit or stash unrelated work first).',
      'Create a branch: `git switch -c change/' + date + '-' + U.slug(changes[0] || 'update').slice(0, 30) + '`',
      'Tag the known-good state: `git tag ' + tag + '`',
      { t: 'Push branch and tag if a remote exists: `git push -u origin HEAD --tags`', q: 2 },
      'Record the current build output (run the game once, note version/behaviour) as the baseline.',
    ] : [
      'Copy the entire project folder to a dated backup (e.g. `' + U.slug(project.profile.title || project.name) + '_backup_' + date + '.zip`) and verify the copy opens/runs.',
      'Strongly consider initialising git (`git init && git add -A && git commit -m "baseline"`) before changing anything.',
    ];

    const I = sec.instructions;
    I.push({ sub: 'Step 1 — Backup checkpoint (mandatory before any edit)', items: backup });
    I.push({ sub: 'Step 2 — Audit checklist', items: [
      'Map the project: entry point, game loop, scenes/levels, asset loading, save system, input, build configuration.',
      'Run the game and the existing tests; record results as the baseline.',
      'For each requested change, locate the exact files/functions involved and list them.',
      'Identify coupling: which other systems read/write the same data or listen to the same events.',
      { t: 'Note fragile areas (globals, singletons, timing-dependent code, magic numbers) that the change touches.', q: 2 },
      { t: 'Check asset references (paths, IDs) the change could break.', q: 2 },
      'Report the audit findings before editing' + (o.focus === 'audit' ? ' — and stop there.' : '.'),
    ] });
    if (o.focus !== 'audit') {
      I.push({ sub: 'Step 3 — Minimal implementation plan', items: (changes.length ? changes : ['(No specific change listed — ask the developer what to change.)']).map((c, i) => 'Change ' + (i + 1) + ': "' + c + '" → smallest set of files/functions to touch, new code isolated (new function/module/flag) where possible, how it is verified.')
        .concat([
          'Order changes from lowest to highest risk; one change per commit.',
          { t: 'Guard risky behaviour behind a config flag so it can be turned off without a code revert.', q: 2 },
        ]) });
      if (bugs.length) I.push({ sub: 'Known bugs (fix only if requested; never mask them)', items: bugs });
      I.push({ sub: 'Step 4 — Implement', items: ['Apply change 1, run the game and tests, commit; repeat per change.', 'If a change requires touching a must-preserve system, stop and explain why, with alternatives.'] });
    }

    I.push({ sub: 'Ultra-detail safeguards', q: 3, items: [
      'Impact matrix: for each requested change list affected files, systems, data formats and assets, rated low/medium/high risk.',
      'Commit convention: one change per commit with message "<area>: <change> (preserves: <systems>)".',
      'Feature flags named feature.<slug> default OFF in release builds until regression tests pass on device.',
      'Visual baseline: capture screenshots of key screens before changes; compare after each change to catch accidental art or layout changes.',
      'Save compatibility fixture: keep a save file from the current version and load it after every change.',
    ] });
    // regression tests
    sec.validation.push({ sub: 'Regression tests', items: (working.length ? working.map((w) => 'Verify still works: ' + w + ' (manual smoke test; automated test if feasible)') : ['Re-test every system inventoried in the audit.'])
      .concat(['Existing automated tests pass.', 'Load a save created before the change.', 'Build for the target platform(s) succeeds; test on an Android device if Android is a target.', 'Approved art renders unchanged (compare screenshots before/after).']) });
    changes.forEach((c) => sec.acceptance.push('Requested change works: ' + c));
    sec.acceptance.push('No regression in any must-preserve system.');
    sec.acceptance.push('Diff contains only lines required by the requested changes.');

    // rollback
    sec.recovery.push({ sub: 'Rollback instructions', items: git ? [
      'Undo a single bad commit: `git revert <commit>`',
      'Abandon the whole change: `git switch main && git branch -D change/...` (or reset the branch to the tag: `git reset --hard ' + tag + '` — only on your own unpushed branch).',
      'Restore one file: `git restore --source ' + tag + ' -- path/to/file`',
      'Rebuild and re-run the regression tests after rolling back.',
    ] : ['Restore the dated backup copy over the project folder.', 'Re-run the game and confirm the baseline behaviour returns.'] });
    sec.deliverables.push('Audit report (files involved, risks).');
    if (o.focus !== 'audit') sec.deliverables.push('Minimal diffs per change, each with its verification result.');
    sec.deliverables.push('Regression test results and rollback point (' + (git ? 'tag ' + tag : 'backup file') + ').');
    if (!working.length) sec.questions.push('Which systems currently work and must be preserved?');
    if (!manifest.length) sec.questions.push('Please provide the project file structure (or repository access).');
    if (!changes.length && o.focus !== 'audit') sec.questions.push('What exactly should change?');

    return {
      title: 'Existing game — ' + E.FOCUS.find((f) => f.id === o.focus).label,
      toolLabel: tool.label, stageLabel: 'Existing project safety', toolTokenLimit: tool.tokenLimit, sections: sec,
      meta: { category: 'existing', tool: tool.id, taskType: 'continuity-analysis', complexity: 55 + Math.min(30, changes.length * 5 + manifest.length / 20), routine: false, characterIds: [] },
    };
  };
})(globalThis.AGPS = globalThis.AGPS || {});

/* Gameplay engineering prompts: subsystem library, genre profiles, code-assistant adapters, planning and testing prompts. */
(function (A) {
  'use strict';
  const U = A.util, C = A.context, S = A.schema;
  const G = (A.gameplay = {});

  G.CODE_TOOLS = [
    { id: 'claude', label: 'Claude (Claude Code / claude.ai)', tokenLimit: 60000 },
    { id: 'codex', label: 'Codex', tokenLimit: 30000 },
    { id: 'gemini', label: 'Gemini', tokenLimit: 60000 },
    { id: 'generic', label: 'Other coding assistant', tokenLimit: 12000 },
  ];
  G.codeTool = (id) => G.CODE_TOOLS.find((t) => t.id === id) || G.CODE_TOOLS[0];

  /** Framing lines specific to each coding assistant (kept factual; no claims about hidden features). */
  G.toolFraming = function (toolId, project) {
    const existing = project.mode === 'existing';
    const common = existing
      ? ['Before changing anything, read the relevant files and summarise how the current implementation works.']
      : ['Start by proposing the file/module layout, then implement it.'];
    switch (toolId) {
      case 'claude': return common.concat([
        'If you are running in Claude Code with repository access: explore with search/read tools first, make focused edits, and run the project\'s tests/build after each step.',
        'If you are in a chat without file access: say so, ask for the specific files you need, and return complete file contents or unified diffs.',
      ]);
      case 'codex': return common.concat([
        'Follow any AGENTS.md instructions in the repository. Keep diffs small and scoped to this task.',
        'Run the existing test/lint/build commands and include their output summary in your final message.',
      ]);
      case 'gemini': return common.concat([
        'List the files you will touch before editing. Return complete updated files or unified diffs, one per file, with paths.',
        'If file contents were not provided to you, request them instead of reconstructing them.',
      ]);
      default: return common.concat(['Return complete files or unified diffs with paths. Ask for missing files instead of guessing.']);
    }
  };

  /* ---------------- Subsystem library ---------------- */
  const fixedStep = 'const STEP = 1/60; let acc = 0; function frame(dtReal){ acc += Math.min(dtReal, 0.25); while (acc >= STEP){ update(STEP); acc -= STEP; } render(acc / STEP); }';
  const intercept = [
    '// Predictive aim: find t > 0 with |(P + V t) - S| = s t',
    '// d = P - S; a = V·V - s²; b = 2 d·V; c = d·d',
    'function interceptTime(d, V, s){',
    '  const a = V.x*V.x + V.y*V.y - s*s, b = 2*(d.x*V.x + d.y*V.y), c = d.x*d.x + d.y*d.y;',
    '  if (Math.abs(a) < 1e-6) return b < 0 ? -c / b : null;      // equal speeds',
    '  const disc = b*b - 4*a*c; if (disc < 0) return null;       // unreachable -> fall back to direct aim',
    '  const r = Math.sqrt(disc), t1 = (-b - r) / (2*a), t2 = (-b + r) / (2*a);',
    '  const t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);',
    '  return t > 0 ? t : null;',
    '}',
  ].join('\n');

  G.SUBSYSTEMS = [
    { id: 'input', label: 'Input handling',
      functional: (c) => ['Abstract raw input into named actions (move, fire, jump, dash, confirm, pause) so gameplay never reads devices directly.', 'Support ' + (c.p.controls || 'touch (virtual stick + buttons), keyboard and gamepad') + '.', 'Buffer action presses for ' + (c.genre === 'fighting' ? '6–8 frames (motion inputs need a history buffer)' : '100–150 ms') + ' so early presses are not lost.', { t: 'Remappable bindings persisted in settings.', q: 2 }],
      constraints: ['Touch targets ≥ 48 dp; virtual controls must not cover critical play space.', 'Input sampled once per fixed update step; no gameplay logic in DOM/event callbacks.'],
      deps: ['Settings/save system for bindings', 'Pause/menu state machine'],
      edge: ['Multi-touch: stick + two buttons simultaneously.', 'Focus loss / app backgrounded while a key or touch is held → release all actions.', 'Gamepad connected/disconnected mid-game.'],
      failures: ['Stuck inputs after alt-tab or Android home button.', 'Ghost touches when the browser scrolls or zooms (disable with touch-action: none).'],
      acceptance: ['All actions work with each input device listed.', 'Releasing focus releases all held actions within one frame.'],
      regression: ['Unit-test the action mapper with synthetic events.', 'Manual: 2-finger + 3-finger touch test on a real phone.'] },
    { id: 'physics', label: 'Physics & collision',
      functional: (c) => [c.render === '3D' ? 'Use the engine physics or a capsule-vs-world collision layer; character controller handles slopes and steps.' : 'Axis-aligned or circle collision with spatial hashing/grid broad-phase.', 'Collision layers/masks: player, enemy, player-bullet, enemy-bullet, terrain, pickup, trigger.', c.genre === 'platformer' ? 'Platformer feel: coyote time (~100 ms), jump buffering, variable jump height, one-way platforms.' : 'Hitboxes separate from sprite bounds; ' + (c.genre === 'bullet-hell' || c.genre === 'shmup' ? 'player hitbox much smaller than the sprite (graze-friendly)' : 'hurtboxes per body part where combat needs it') + '.'],
      constraints: ['Physics runs in the fixed timestep, independent of render rate.', 'No allocations per collision check in hot loops (pool vectors/results).'],
      deps: ['Fixed-timestep loop', 'Entity/component registry'],
      edge: ['Fast projectiles tunnelling through thin walls → swept tests or sub-stepping.', 'Objects spawned overlapping a wall.', 'Simultaneous hits on the same frame.'],
      failures: ['Jitter at high refresh rates when render and physics are not interpolated.', 'Broad-phase degrades to O(n²) with many bullets.'],
      acceptance: ['No tunnelling at max projectile speed in a thin-wall test level.', '1,000 active bullets keep collision under 2 ms/frame on the reference device.'],
      regression: ['Deterministic unit tests for overlap/sweep functions.', 'Recorded-input replay produces identical positions after 600 steps.'] },
    { id: 'camera', label: 'Camera behaviour',
      functional: (c) => [c.render === '3D' ? 'Third-person/follow camera with collision avoidance, damped follow and look-ahead.' : (c.genre === 'shmup' || c.genre === 'bullet-hell' ? 'Fixed or auto-scrolling camera; the playfield is fully visible on all aspect ratios.' : 'Smooth follow with dead-zone and look-ahead in the movement direction.'), 'Screen shake with trauma model (decays over time, capped, can be disabled for accessibility).', 'Camera bounds clamp to level limits.'],
      constraints: ['Camera updates after gameplay update, before render, using interpolated positions.', 'Safe area / notch insets respected on Android.'],
      deps: ['Level bounds data', 'Settings (shake toggle)'],
      edge: ['Aspect ratios from 4:3 tablets to 21:9 phones.', 'Teleport/respawn → snap instead of slow pan.', 'Boss arenas that lock the camera.'],
      failures: ['Motion sickness from overshoot/oscillation.', 'UI hidden behind display cut-outs.'],
      acceptance: ['Playfield/HUD fully visible at 16:9, 19.5:9, 20:9 and 4:3.', 'Screen shake can be turned off and stays off after restart.'],
      regression: ['Screenshot tests at fixed aspect ratios.'] },
    { id: 'enemy-ai', label: 'Enemy decision-making',
      functional: (c) => ['Finite-state machine or behaviour tree per enemy archetype (e.g. patrol → notice → attack → recover → retreat).', 'Attack telegraphs: every damaging action has a readable wind-up (animation + sound + optional flash).', 'Aggression budget/token system so only N enemies attack the player at once' + (c.genre === 'tactical-rpg' ? '; for turn-based play use utility scoring of moves (damage, risk, objective value).' : '.')],
      constraints: ['AI thinks at a fixed rate (e.g. 10 Hz) separate from movement updates for performance.', 'All tuning values in data files, not hard-coded.'],
      deps: ['Physics/line-of-sight queries', 'Pathfinding or movement patterns', 'Health & damage'],
      edge: ['Player unreachable (on ledge/out of bounds).', 'Target dies mid-attack.', 'Many enemies stacking on one spot.'],
      failures: ['Enemies stuck on geometry.', 'AI unfair because attacks have no telegraph.'],
      acceptance: ['Each archetype demonstrably cycles through its states in a test arena.', 'No more than the configured number of simultaneous attackers.'],
      regression: ['Unit-test state transitions with mocked perception input.'] },
    { id: 'projectiles', label: 'Predictive projectiles',
      functional: () => ['Enemy aiming modes: direct, predictive (lead the target), spread, aimed burst, fixed pattern.', 'Predictive aim solves the intercept time between projectile speed and the player\'s current velocity (formula below).', 'Difficulty-scaled prediction accuracy: blend between direct and predictive aim (0–100%) and add angular error so it stays fair.', { code: intercept, lang: 'js', q: 2 }],
      constraints: ['Projectiles pooled; zero allocations while firing.', 'Never predictive-aim on the same frame the player dashes/teleports (use the last stable velocity).'],
      deps: ['Physics & collision', 'Object pool', 'Difficulty settings'],
      edge: ['Target faster than the projectile → no real solution; fall back to direct aim.', 'Target velocity zero.', 'Projectile spawned off-screen.'],
      failures: ['Unavoidable "perfect" shots that feel unfair.', 'NaN angles from a negative discriminant not handled.'],
      acceptance: ['Against a target moving at constant velocity, predictive shots hit ≥ 95% at prediction 100%.', 'No NaN positions in a 10-minute soak test.'],
      regression: ['Unit tests for interceptTime: stationary, perpendicular, unreachable, equal-speed cases.'] },
    { id: 'boss', label: 'Boss attack patterns',
      functional: (c) => ['Bosses defined as data: phases (HP thresholds), pattern lists, transitions, invulnerability windows.', (c.genre === 'shmup' || c.genre === 'bullet-hell') ? 'Bullet patterns built from emitters (ring, spiral, aimed fan, wall with gap) composed over time.' : 'Melee/ranged moves with wind-up, active and recovery frames; punish windows after big attacks.', 'Phase transitions clear dangerous projectiles and play a short readable cue.'],
      constraints: ['Every pattern must have a guaranteed safe path (validated by a test harness or manual checklist).', 'Pattern timings scale with difficulty, never pattern geometry gaps below the player hitbox × 3.'],
      deps: ['Enemy AI', 'Projectiles', 'Health & damage', 'Dialogue/cut-in for phase intros'],
      edge: ['Boss killed during a phase transition.', 'Player dies on the same frame the boss dies.', 'Pausing mid-pattern.'],
      failures: ['Softlock when a phase threshold is skipped by burst damage.', 'Pattern overlap creating unavoidable walls.'],
      acceptance: ['Each phase reachable and completable in a scripted test.', 'Burst damage past multiple thresholds triggers each phase entry correctly.'],
      regression: ['Data validation test: every phase has ≥ 1 pattern and a valid next phase.'] },
    { id: 'health', label: 'Health & damage',
      functional: (c) => ['Single damage pipeline: DamageEvent {source, target, amount, type, knockback} → modifiers (armour, resistances, buffs) → apply → events (hit flash, sound, UI).', 'Invulnerability frames after being hit (' + (c.genre === 'bullet-hell' ? 'with respawn shield' : 'about 0.5–1 s') + ').', 'Death → state change → respawn/continue/game-over flow.'],
      constraints: ['Damage numbers and formulas in data; one function owns HP mutation.', 'HP never negative; healing capped at max HP.'],
      deps: ['Equipment (modifiers)', 'Save system (persistent HP if applicable)', 'UI/HUD'],
      edge: ['Simultaneous lethal and healing events.', 'Damage while in i-frames.', 'Overkill and fractional damage rounding.'],
      failures: ['Double-death events granting double rewards.'],
      acceptance: ['Unit tests cover armour, resistances, crits, i-frames and death exactly once.'],
      regression: ['Golden-value tests for the damage formula table.'] },
    { id: 'equipment', label: 'Equipment',
      functional: (c) => ['Item definitions in data (id, slot, stats, rarity, icon asset ID, requirements).', c.p.title && /arcade|war/i.test(c.p.title) ? 'Ship loadouts: main weapon, sub-weapon, support module, with per-pilot restrictions.' : 'Equip/unequip with stat recalculation and UI comparison (+/−).', 'Equipment changes go through the same stat-modifier pipeline as buffs.'],
      constraints: ['Stats derived, never stored redundantly (recompute from base + modifiers).'],
      deps: ['Inventory', 'Health & damage', 'Save system'],
      edge: ['Unequipping an item that grants max HP when HP is above the new max.', 'Item removed from data in an update while present in old saves.'],
      failures: ['Stat stacking bugs from repeated equip events.'],
      acceptance: ['Equip/unequip cycles 100× leave stats unchanged.'],
      regression: ['Save files from previous versions load with unknown items handled gracefully.'] },
    { id: 'progression', label: 'Player progression',
      functional: (c) => ['XP/level or unlock-tree progression defined in data: ' + (c.p.progression || 'levels unlock abilities and stages') + '.', 'Unlocks emit events consumed by UI, save system and achievements.', { t: 'Progression curve documented as a table (level → XP required → expected play time).', q: 2 }],
      constraints: ['No progression state stored only in UI.'],
      deps: ['Save system', 'Economy'],
      edge: ['Level-up with leftover XP spanning multiple levels.', 'Unlocking content the save already contains.'],
      failures: ['Progress lost when the app is killed during level-up.'],
      acceptance: ['Granting enough XP for 3 levels at once applies all 3 and their unlocks.'],
      regression: ['Unit tests on the XP curve and unlock table.'] },
    { id: 'economy', label: 'In-game economy',
      functional: () => ['Currencies, sources (drops, rewards) and sinks (shop, upgrades) defined in data.', 'Shop transactions are atomic: check → deduct → grant → save.', { t: 'Economy simulation script: expected currency after N levels vs. upgrade costs.', q: 2 }],
      constraints: ['Integer currency values; no floating-point money.', 'No real-money purchases unless the project profile explicitly specifies monetisation.'],
      deps: ['Save system', 'Progression', 'UI'],
      edge: ['Buying with exactly enough currency.', 'Double-tap on Buy button.', 'App killed mid-transaction.'],
      failures: ['Duplicate purchases from repeated taps.', 'Negative balances.'],
      acceptance: ['Rapid double-tap purchases only one item.', 'Killing the app during purchase never loses or duplicates currency.'],
      regression: ['Unit-test transaction function with edge balances.'] },
    { id: 'save', label: 'Save / load',
      functional: (c) => ['Versioned save schema {version, timestamp, data} with migration functions per version.', 'Storage: ' + (S.engine(c.p.engine).family === 'html5' ? 'IndexedDB or localStorage for small saves (Capacitor Preferences/Filesystem on Android if needed)' : 'the engine\'s user data directory') + '.', 'Save points: ' + (c.p.saveSystem || 'autosave at checkpoints + manual save slots') + '.'],
      constraints: ['Write to a temp key/file then swap (atomic) to avoid corruption.', 'Validate on load; on corruption fall back to the previous backup and inform the player.'],
      deps: ['All persistent systems expose serialize()/deserialize()'],
      edge: ['Storage full / quota exceeded.', 'Save from a newer game version.', 'Android WebView data cleared by the user.'],
      failures: ['Silent corruption on app kill.', 'Breaking older saves after updates.'],
      acceptance: ['Round-trip test: serialize → deserialize equals original for a populated game state.', 'Saves from each previous schema version migrate correctly.'],
      regression: ['Keep fixture save files for each released version in the test suite.'] },
    { id: 'dialogue', label: 'Dialogue & story scenes',
      functional: (c) => ['Data-driven script format (JSON/YAML/Ink-style) with speaker IDs, portraits (character IDs from the studio), choices and flags.', c.p.title && /arcade/i.test(c.p.title) ? 'Manga-style story panels: panel layout data, speech text rendered by the engine (art is generated without text).' : 'Text box with typewriter effect, skip/auto/log.', 'Localisation-ready: all strings by key.'],
      constraints: ['Dialogue text never baked into images.', 'Gameplay paused or safe during scenes.'],
      deps: ['Input (advance/skip)', 'Save system (story flags)', 'Audio (voice/sfx)'],
      edge: ['Skipping during an animation transition.', 'Missing portrait asset → fallback silhouette, logged.', 'Very long translated strings.'],
      failures: ['Softlock when a choice references a missing node.'],
      acceptance: ['Script validator finds no dangling node references.', 'All scenes skippable without breaking flags.'],
      regression: ['Automated playthrough of the script graph visiting every node.'] },
    { id: 'audio', label: 'Audio integration',
      functional: () => ['Audio manager with buses (music, sfx, voice, ui) and volume settings persisted.', 'Music cross-fades between scenes; sfx with per-sound concurrency limits.', 'Mobile: audio unlocked on first user gesture (browser autoplay policies).'],
      constraints: ['Compressed formats (OGG/Opus or AAC/M4A for Safari/iOS); preload only what the scene needs.'],
      deps: ['Settings', 'Asset loader'],
      edge: ['App backgrounded → pause audio; resume on return.', 'Hundreds of hit sounds per second in bullet hell.'],
      failures: ['No sound on Android until a tap (expected) without UI hint.'],
      acceptance: ['Volume settings persist and apply immediately.', 'Audio pauses when the app goes to background.'],
      regression: ['Manual audio checklist per release.'] },
    { id: 'framerate', label: 'Frame-rate independence',
      functional: () => ['Fixed-timestep simulation with render interpolation.', { code: fixedStep, lang: 'js' }, 'All movement uses dt from the fixed step; timers in seconds, not frames (except deliberate frame data for fighting games).'],
      constraints: ['Clamp the real delta (e.g. 250 ms) to avoid spiral of death after tab switches.'],
      deps: ['Game loop'],
      edge: ['60 Hz vs 90/120 Hz phones.', 'Long frame after resume from background.'],
      failures: ['Game runs faster on 120 Hz screens.'],
      acceptance: ['Same input replay gives same results at 30, 60 and 120 Hz render rates.'],
      regression: ['Replay test with simulated render rates.'] },
    { id: 'performance', label: 'Performance optimisation',
      functional: (c) => ['Object pooling for bullets, particles, enemies.', 'Texture atlases; ' + (c.render === '3D' ? 'instancing, LODs and frustum culling' : 'sprite batching') + '; avoid per-frame allocations.', 'In-game performance overlay (FPS, frame time, draw calls, entities) behind a debug flag.'],
      constraints: (c) => ['Target ' + c.p.targetFps + ' FPS on a mid-range Android device; frame time budget ' + (1000 / c.p.targetFps).toFixed(1) + ' ms.', 'Memory: avoid loading all levels at once.'],
      deps: ['Asset loader', 'Renderer'],
      edge: ['Thermal throttling after 10+ minutes.', 'Low-memory kill on Android.'],
      failures: ['GC spikes causing stutter.'],
      acceptance: (c) => ['10-minute soak on device: no FPS drop below ' + Math.round(c.p.targetFps * 0.9) + ' in normal play, no memory growth.'],
      regression: ['Benchmark scene with recorded baseline numbers in the repo.'] },
  ];
  G.subsystem = (id) => G.SUBSYSTEMS.find((s) => s.id === id);

  G.GENRE_DEFAULTS = {
    shmup: ['input', 'physics', 'projectiles', 'boss', 'health', 'equipment', 'framerate', 'performance'],
    'bullet-hell': ['input', 'physics', 'projectiles', 'boss', 'health', 'framerate', 'performance'],
    'action-rpg': ['input', 'physics', 'camera', 'enemy-ai', 'health', 'equipment', 'progression', 'save'],
    'tactical-rpg': ['input', 'enemy-ai', 'health', 'equipment', 'progression', 'save', 'dialogue'],
    platformer: ['input', 'physics', 'camera', 'enemy-ai', 'health', 'save', 'framerate'],
    fighting: ['input', 'physics', 'health', 'framerate', 'audio'],
    arcade: ['input', 'physics', 'health', 'framerate', 'audio', 'performance'],
    exploration: ['input', 'physics', 'camera', 'dialogue', 'save', 'progression'],
    hybrid: ['input', 'physics', 'camera', 'enemy-ai', 'health', 'save', 'framerate'],
  };

  G.GENRE_NOTES = {
    shmup: ['Scrolling playfield with spawn waves defined in data (time/position → enemy + pattern).', 'Readability: enemy bullets high-contrast and distinct from player bullets and backgrounds.'],
    'bullet-hell': ['Hundreds to thousands of simultaneous bullets: pooled, batched, circle collision with a tiny player hitbox.', 'Graze/focus mode (slow movement shows the hitbox).'],
    'action-rpg': ['Combo/attack chains with cancel windows; stamina or cooldowns.', 'Lock-on or soft-targeting on touch.'],
    'tactical-rpg': ['Grid/turn system, initiative order, movement ranges, line of sight, undo of the last move before confirm.', 'AI turn simulation must be deterministic and fast (< 200 ms per unit on device).'],
    platformer: ['Tight movement feel: acceleration curves, coyote time, jump buffer, variable jump.', 'Level readability: hazards visually distinct.'],
    fighting: ['Frame data per move (startup/active/recovery), hit/hurtboxes per frame, input buffer with motion inputs, rollback-friendly deterministic simulation.'],
    arcade: ['Short sessions, score attack, instant restart, high-score table.'],
    exploration: ['World streaming/rooms, map discovery, interactable objects, gentle guidance.'],
    hybrid: ['Define clear mode boundaries (e.g. shooting stages ↔ adventure segments) and shared state between them.'],
  };

  function ctxOf(project) {
    return { p: project.profile, genre: project.profile.genre, render: project.profile.renderMode };
  }

  G.build = function (project, options) {
    const o = Object.assign({ tool: 'claude', genre: project.profile.genre, subsystems: null }, options || {});
    const q = A.compiler.qLevel(o.quality);
    const c = ctxOf(project);
    c.genre = o.genre || c.genre;
    const ids = U.list(o.subsystems).length ? U.list(o.subsystems) : (G.GENRE_DEFAULTS[c.genre] || G.GENRE_DEFAULTS.hybrid);
    const subs = ids.map(G.subsystem).filter(Boolean);
    if (!subs.length) throw new Error('Select at least one subsystem.');
    const tool = G.codeTool(o.tool);
    const eng = S.engine(project.profile.engine);
    const existing = project.mode === 'existing';
    const sec = { role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [], questions: [] };
    sec.role.push('Senior gameplay engineer and technical designer experienced with ' + eng.label + ', ' + C.genreLabel(c.genre).toLowerCase() + ' games and mobile performance.');
    sec.mission.push((existing ? 'Extend the EXISTING game' : 'Implement') + ' the following gameplay subsystems for "' + (project.profile.title || project.name) + '": ' + subs.map((s) => s.label).join(', ') + '.');
    if (o.extra) sec.mission.push(o.extra);
    C.projectSummary(project, q).forEach((l) => sec.context.push(l));
    (G.GENRE_NOTES[c.genre] || []).forEach((n) => sec.context.push({ t: 'Genre requirement: ' + n, q: 1 }));
    if (project.characters.length) sec.context.push({ t: 'Registered characters (IDs are canonical; use them in data files): ' + project.characters.map((x) => x.name + ' [' + x.id + ']' + (x.abilities ? ' — abilities: ' + x.abilities : '')).join('; '), q: 1 });
    if (project.assets.length) sec.references.push({ t: 'Asset registry (metadata only; file contents are not attached unless you were given them): ' + project.assets.map((a) => a.id + ' ' + a.name + ' (' + a.role + ', ' + (a.format || 'format n/a') + ', ' + a.approval + ')').join('; '), q: 2 });
    G.toolFraming(tool.id, project).forEach((l) => sec.constraints.push(l));
    sec.constraints.push('Engine/technology: ' + eng.label + '. Use idiomatic patterns for it; do not introduce a different engine or framework.');
    sec.constraints.push('Frame-rate independent simulation; target ' + project.profile.targetFps + ' FPS on mid-range Android.');
    sec.constraints.push('Gameplay tuning values live in data/config files, not scattered literals.');
    if (existing) {
      sec.constraints.push('EXISTING PROJECT: preserve all working systems; make the smallest change that satisfies each requirement; never rewrite working modules wholesale.');
      U.lines(project.existing.workingSystems).forEach((w) => sec.constraints.push({ t: 'Must keep working: ' + w, q: 1 }));
    }
    sec.specs.push({ t: 'Architecture: update order per fixed step — input → AI → physics → gameplay rules → events → camera; render interpolates.', q: 1 });
    sec.specs.push({ t: 'Event bus or signals for cross-system communication (damage, death, pickup, phase change) instead of direct coupling.', q: 2 });
    sec.specs.push({ t: 'Each subsystem is a module with an explicit public API and its own tests.', q: 2 });
    sec.specs.push({ t: 'Determinism: seeded RNG per run/stage so replays and bug reports reproduce exactly; never use unseeded random in simulation code.', q: 3 });
    sec.specs.push({ t: 'Memory discipline: pre-allocate pools at scene load, report pool high-water marks in the debug overlay, and assert on pool exhaustion in development builds.', q: 3 });
    sec.specs.push({ t: 'Profiling markers around each subsystem update so per-system cost appears in the browser/engine profiler.', q: 3 });

    const val = (x) => (typeof x === 'function' ? x(c) : x);
    subs.forEach((s0) => {
      const s = { label: s0.label, functional: s0.functional, constraints: val(s0.constraints), deps: val(s0.deps), edge: val(s0.edge), failures: val(s0.failures), acceptance: val(s0.acceptance), regression: val(s0.regression) };
      const items = [];
      items.push('Functional requirements:');
      s.functional(c).forEach((x) => items.push(typeof x === 'string' ? '  • ' + x : x));
      const flat = items.filter((x) => typeof x === 'string' || (x.q || 1) <= q).map((x) => (typeof x === 'string' ? x : x.code != null ? x : '  • ' + x.t));
      const block = flat.slice();
      if (q >= 1) block.push('Implementation constraints: ' + s.constraints.join(' '));
      block.push('Dependencies: ' + s.deps.join('; ') + '.');
      if (q >= 2) block.push('Edge cases: ' + s.edge.join(' | '));
      if (q >= 2) block.push('Failure scenarios to guard against: ' + s.failures.join(' | '));
      block.push('Acceptance criteria: ' + s.acceptance.join(' | '));
      block.push('Regression tests: ' + s.regression.join(' | '));
      if (q >= 3) {
        block.push('Data contract: document the config/data shape for this subsystem as a typed interface (field, type, unit, default, valid range) and validate it at load time with readable errors.');
        block.push('Debug hooks: a toggleable overlay or log channel for this subsystem (state names, counters, timings) that is compiled out or disabled in release builds.');
        block.push('Telemetry for tuning (local only unless the developer opts in): counters that help balance this subsystem during playtests.');
      }
      sec.instructions.push({ sub: s.label, items: block.map((b) => (typeof b === 'string' ? b.replace(/^ {2}• /, '• ') : b)) });
      s.acceptance.forEach((a) => sec.acceptance.push(s.label + ': ' + a));
    });

    sec.validation.push('Build/run passes with no new warnings; existing tests still pass.');
    sec.validation.push('Each subsystem has unit tests for its pure logic and a manual test scene/checklist.');
    sec.validation.push('Performance overlay shows frame time within budget on a mid-range Android device.');
    sec.validation.push({ t: 'Touch controls verified on a real phone (not only desktop emulation).', q: 1 });
    sec.recovery.push('If a requirement conflicts with existing code, stop and describe the conflict with options instead of forcing a rewrite.');
    sec.recovery.push('If tests fail after a change, revert that change, isolate the failing case, and fix forward in a smaller step.');
    sec.recovery.push({ t: 'If performance regresses, profile first (identify the top 3 costs) before optimising.', q: 2 });
    sec.deliverables.push('Source changes (complete files or diffs with paths).');
    sec.deliverables.push('Tests added/updated and the command to run them.');
    sec.deliverables.push('Short report: what was implemented, deviations, known limitations, next steps.');
    C.openQuestions(project).forEach((x) => sec.questions.push({ t: x, q: 2 }));

    const complexity = Math.min(100, 30 + subs.length * 7 + (existing ? 10 : 0) + (q - 1) * 5);
    return {
      title: 'Gameplay engineering — ' + subs.map((s) => s.label).join(', '),
      toolLabel: tool.label,
      stageLabel: 'Gameplay implementation (' + C.genreLabel(c.genre) + ')',
      toolTokenLimit: tool.tokenLimit,
      sections: sec,
      meta: { category: 'gameplay', tool: tool.id, taskType: subs.length > 2 ? 'multi-system' : 'single-system', complexity, routine: false, characterIds: [] },
    };
  };

  /* ---------------- Planning / technical design ---------------- */
  G.PLAN_KINDS = [
    { id: 'gdd', label: 'Game design document' },
    { id: 'tdd', label: 'Technical design / architecture' },
    { id: 'milestones', label: 'Milestone & production plan' },
    { id: 'full', label: 'Full planning package (GDD + TDD + milestones)' },
  ];
  G.buildPlanning = function (project, options) {
    const o = Object.assign({ tool: 'claude', kind: 'full' }, options || {});
    const q = A.compiler.qLevel(o.quality);
    const tool = G.codeTool(o.tool);
    const p = project.profile, eng = S.engine(p.engine);
    const sec = { role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [], questions: [] };
    sec.role.push('Principal game designer and technical director for a solo anime game developer shipping on ' + (p.platforms.join(', ') || 'Android and web') + '.');
    sec.mission.push('Write a practical ' + G.PLAN_KINDS.find((k) => k.id === o.kind).label.toLowerCase() + ' for "' + (p.title || project.name) + '" that a solo developer can execute with AI-assisted tools.');
    C.projectSummary(project, 3).forEach((l) => sec.context.push(l));
    project.characters.forEach((ch) => sec.context.push({ t: 'Character ' + ch.name + ' [' + ch.id + ']: ' + [ch.role, ch.abilities, ch.personality].filter(Boolean).join(' — '), q: 1 }));
    sec.constraints.push('Scope for a solo developer: prioritise a vertical slice; mark everything else as post-launch.');
    sec.constraints.push('Do not invent technical facts about engines or stores; flag anything that must be verified.');
    if (project.mode === 'existing') sec.constraints.push('This is an existing game: plan around the current working systems; do not propose restarting the project.');
    const I = sec.instructions;
    if (o.kind === 'gdd' || o.kind === 'full') I.push({ sub: 'Game design document', items: ['Pillars (3 max) and target player experience.', 'Core loop, meta loop and session length (mobile sessions 3–10 minutes).', 'Mechanics per system: ' + [p.combat && 'combat', p.abilities && 'abilities', p.progression && 'progression', 'controls', 'difficulty'].filter(Boolean).join(', ') + '.', 'Content list: levels/stages, enemies, bosses, characters, items — with counts for the vertical slice and for launch.', { t: 'Narrative structure and how story scenes are presented.', q: 2 }, { t: 'Accessibility: remappable controls, screen-shake toggle, colour-blind-safe bullet colours, text size.', q: 2 }] });
    if (o.kind === 'tdd' || o.kind === 'full') I.push({ sub: 'Technical design', items: ['Architecture for ' + eng.label + ': module list, update loop, scene management, data formats.', 'Asset pipeline: 2D (image tools → cleanup → atlas) and 3D (Meshy → Blender → ' + (p.renderMode === '3D' ? 'GLB/FBX' : 'pre-rendered or 2D') + ') with naming rules and the asset registry IDs.', 'Save system schema and migration approach.', 'Performance budgets: frame time, draw calls, memory, APK/AAB size.', { t: 'Build & release: ' + (eng.family === 'html5' ? 'web build → Capacitor Android project → debug APK → signed AAB.' : 'engine-native Android export → debug APK → signed AAB.'), q: 1 }, { t: 'Testing strategy: unit tests for pure logic, replay tests, device test matrix.', q: 2 }] });
    if (o.kind === 'milestones' || o.kind === 'full') I.push({ sub: 'Milestones', items: ['M0 prototype (core loop greybox) → M1 vertical slice → M2 content complete → M3 polish & Android release candidate.', 'For each milestone: goals, task list with estimates, exit criteria, risks.', { t: 'Which tasks to delegate to which AI tool (image, Meshy, coding assistant) and which need manual work.', q: 2 }] });
    I.push({ sub: 'Ultra-detail appendices', q: 3, items: [
      'Data schemas: example JSON for one character, one enemy, one level/wave definition and one save file (with version field).',
      'Performance budget table: frame time per system (input, AI, physics, render, UI) adding up to ' + (1000 / p.targetFps).toFixed(1) + ' ms, draw-call and memory budgets per scene.',
      'Risk register: top 8 risks (technical, art pipeline, scope, store review) with likelihood, impact and mitigation.',
      'Device test matrix: low-end / mid / high Android tiers with minimum specs and what is verified on each.',
      'Asset ID conventions matching the studio registry (CHR-/AST- IDs, file naming, versioning).',
    ] });
    sec.outputs.push('Markdown document with numbered headings and tables where useful.');
    sec.validation.push('Every system in the plan has an owner module and an acceptance criterion.');
    sec.validation.push('Vertical-slice scope is achievable by one person (state the estimate).');
    sec.acceptance.push('A developer can start implementing M0 from the document without further questions, except the listed open questions.');
    sec.recovery.push('If the brief is contradictory, list the contradiction and propose the simplest resolution.');
    sec.deliverables.push('The planning document.');
    sec.deliverables.push('A list of the next 10 concrete tasks.');
    C.openQuestions(project).forEach((x) => sec.questions.push(x));
    return {
      title: 'Planning — ' + G.PLAN_KINDS.find((k) => k.id === o.kind).label,
      toolLabel: tool.label, stageLabel: 'Game planning & technical design', toolTokenLimit: tool.tokenLimit, sections: sec,
      meta: { category: 'planning', tool: tool.id, taskType: o.kind === 'tdd' || o.kind === 'full' ? 'architecture' : 'design', complexity: o.kind === 'full' ? 75 : 55, routine: false, characterIds: [] },
    };
  };

  /* ---------------- Testing & debugging ---------------- */
  G.TEST_KINDS = [
    { id: 'test-plan', label: 'Test plan & automated tests' },
    { id: 'debug', label: 'Bug investigation & fix' },
    { id: 'performance', label: 'Performance profiling' },
    { id: 'android-failure', label: 'Android build / runtime failure investigation' },
  ];
  G.buildTesting = function (project, options) {
    const o = Object.assign({ tool: 'claude', kind: 'test-plan' }, options || {});
    const tool = G.codeTool(o.tool);
    const eng = S.engine(project.profile.engine);
    const sec = { role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [], questions: [] };
    const kind = G.TEST_KINDS.find((k) => k.id === o.kind) || G.TEST_KINDS[0];
    sec.role.push({ 'test-plan': 'QA engineer and test automation specialist for games', debug: 'Senior debugging engineer for ' + eng.label + ' games', performance: 'Mobile game performance engineer', 'android-failure': 'Android build and release engineer (Gradle, Android SDK, WebView/Capacitor and engine exporters)' }[kind.id] + '.');
    sec.mission.push(kind.label + ' for "' + (project.profile.title || project.name) + '".');
    C.projectSummary(project, 2).forEach((l) => sec.context.push(l));
    G.toolFraming(tool.id, project).forEach((l) => sec.constraints.push(l));
    sec.constraints.push('Do not guess at code you have not seen; request the relevant files or logs.');
    sec.constraints.push('Never delete or disable a failing test to make the suite pass.');
    if (project.mode === 'existing') sec.constraints.push('Existing project: fixes must be minimal and must not regress working systems.');
    const bug = o.bug || project.existing.knownBugs;
    if (kind.id === 'debug') {
      sec.context.push('Bug report: ' + (bug || 'not provided — ask the developer for steps to reproduce, expected and actual behaviour'));
      if (o.logs) sec.context.push({ t: 'Logs / stack trace provided:', q: 1 }), sec.specs.push({ code: String(o.logs).slice(0, 6000) });
      sec.instructions.push({ sub: 'Investigation', items: ['Restate the bug and the expected behaviour.', 'Reproduce it (write a failing test or a minimal reproduction scene first).', 'Form ranked hypotheses; check each against code and logs; record what you ruled out.', 'Identify the root cause, not just the symptom.'] });
      sec.instructions.push({ sub: 'Fix', items: ['Apply the smallest change that fixes the root cause.', 'Make the failing test pass; run the full suite.', 'Check related code paths for the same defect pattern.'] });
      sec.acceptance.push('The reproduction test fails before the fix and passes after it.');
    } else if (kind.id === 'performance') {
      sec.instructions.push({ sub: 'Measure', items: ['Capture a baseline on a real mid-range Android device: FPS, frame time p50/p95, draw calls, JS heap / memory, GC pauses.', eng.family === 'html5' ? 'Use Chrome remote debugging (chrome://inspect) Performance panel against the Android WebView/Chrome.' : 'Use the engine profiler connected to the device (Android Studio profiler for system-level data).'] });
      sec.instructions.push({ sub: 'Optimise', items: ['Rank the top 3 costs; fix one at a time and re-measure.', 'Typical wins: pooling, atlases, fewer draw calls, cheaper shaders, lower resolution render target on low-end, fewer active physics bodies.'] });
      sec.acceptance.push('Frame time p95 within ' + (1000 / project.profile.targetFps).toFixed(1) + ' ms on the reference device during the heaviest scene.');
    } else if (kind.id === 'android-failure') {
      sec.context.push('Failure description: ' + (bug || 'not provided'));
      if (o.logs) sec.specs.push({ code: String(o.logs).slice(0, 8000) });
      sec.instructions.push({ sub: 'Triage', items: ['Classify: Gradle/configuration, SDK/JDK version mismatch, signing, manifest merge, plugin/native, WebView runtime, or device-specific crash.', 'Collect: full Gradle output with --stacktrace, versions (JDK, Android Gradle Plugin, Gradle, compile/target SDK, Capacitor or engine export template), and adb logcat for runtime crashes.', 'Check the most common causes first: wrong JDK version, missing Android SDK platform/build-tools, outdated sync (npx cap sync), keystore path/password, minSdk conflicts from plugins.'] });
      sec.instructions.push({ sub: 'Fix & verify', items: ['Change one variable at a time; rebuild with a clean build (./gradlew clean) when caches may be stale.', 'Verify the debug APK installs and launches (adb install -r) before attempting release builds.'] });
      sec.acceptance.push('Clean build succeeds from a fresh clone using documented commands.');
    } else {
      sec.instructions.push({ sub: 'Test plan', items: ['Inventory systems and risks; prioritise by player impact.', 'Unit tests for pure logic (damage, economy, save migration, AI decisions, pattern data validation).', 'Replay/integration tests using recorded inputs.', 'Manual device checklist: touch controls, orientation, pause/resume, background/foreground, low battery mode, different aspect ratios.'] });
      sec.instructions.push({ sub: 'Automation', items: ['Set up or extend the project\'s test runner; add a single command to run all tests.', 'Add CI steps (optional) that run tests on every push.'] });
      sec.acceptance.push('Test command runs green locally; the manual checklist is written and versioned.');
    }
    sec.instructions.push({ sub: 'Ultra-detail requirements', q: 3, items: [
      'Record environment details for every finding: device model, Android version, WebView/engine version, build hash, settings.',
      'Attach evidence: exact log excerpt with timestamps, profiler capture or screenshot for each conclusion.',
      'Classify each issue by severity (crash/blocker/major/minor) and reproduction rate (always/often/rare).',
      'Propose a regression test or monitoring check that would have caught the issue earlier.',
    ] });
    sec.validation.push('All existing tests pass; new tests cover the change.');
    sec.validation.push('Findings documented with evidence (logs, measurements, screenshots).');
    sec.recovery.push('If you cannot reproduce: list what you tried and what information is needed.');
    sec.deliverables.push('Root cause / findings report, code changes (if any) and test results.');
    return {
      title: 'Testing & debugging — ' + kind.label,
      toolLabel: tool.label, stageLabel: kind.label, toolTokenLimit: tool.tokenLimit, sections: sec,
      meta: { category: 'testing', tool: tool.id, taskType: kind.id === 'test-plan' ? 'testing' : kind.id === 'android-failure' ? 'android-failure' : 'debugging', complexity: kind.id === 'test-plan' ? 45 : 70, routine: false, characterIds: [] },
    };
  };
})(globalThis.AGPS = globalThis.AGPS || {});

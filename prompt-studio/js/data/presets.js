/* Sample project profiles. These are configurable examples — no real source files are included. */
(function (A) {
  'use strict';
  const PR = (A.presets = {});

  PR.LIST = [
    {
      presetId: 'anime-war-arcade',
      label: 'Anime War Arcade',
      summary: 'Four anime pilots, space shooting, bosses, manga story scenes, predictive enemy fire.',
      make: () => ({
        name: 'Anime War Arcade',
        mode: 'new',
        isSample: true,
        sampleNotice: 'Sample profile. No source files, art or audio for Anime War Arcade are included; register your own assets in the Asset Registry.',
        profile: {
          title: 'Anime War Arcade',
          logline: 'Four rookie pilots defend the Tsukuyomi orbital colony against the Hollow Armada.',
          story: 'The Hollow Armada, a machine fleet that strips stars of their light, reaches the Tsukuyomi colony. Four pilots of Squadron Kirin — each with a distinct spacecraft — fight through asteroid belts, a derelict battleship and the Armada mothership. Between stages, manga-style panels tell the squad\'s story; optional tactical adventure segments let the player explore the carrier and plan sorties.',
          genre: 'shmup',
          subgenres: ['bullet-hell', 'tactical adventure segments (optional)'],
          renderMode: '2D',
          platforms: ['android', 'web'],
          engine: 'phaser',
          targetFps: 60,
          orientation: 'portrait',
          combat: 'Vertical scrolling shooter. Main shot + charge shot + per-pilot special; small hitbox; graze meter fills the special. Enemies use direct, predictive (lead) and pattern fire; difficulty scales prediction accuracy.',
          abilities: 'Pilot specials: Kaede — Crimson Rush (piercing dash), Ren — Azure Lance (charged sniper beam), Mio — Honeycomb Drones (homing support drones), Sora — Nightbreaker Barrage (screen-wide missile volley).',
          world: 'Orbital colony, asteroid belts, nebula clouds, derelict battleship interiors, the Hollow Armada mothership.',
          progression: 'Stage clear unlocks next stage and equipment; credits buy ship modules; pilots gain bond levels that unlock story panels.',
          artDirection: 'Bright modern anime, clean lineart, cel shading, saturated neon accents on dark space backgrounds; ships are sleek mecha-inspired designs.',
          animation: 'Sprite-based ships with banking frames; pilot portraits with expression sets for story panels; boss parts animated separately.',
          saveSystem: 'Autosave after each stage; 3 manual slots; settings saved separately.',
          controls: 'Touch: relative drag to move, auto-fire toggle, special button. Keyboard/gamepad on web.',
          difficulty: 'Easy / Normal / Hard / Lunatic; affects bullet density, speed and enemy prediction accuracy (0% / 40% / 75% / 95%).',
          audio: 'Synthwave/J-rock soundtrack per stage; boss themes; pilot voice barks optional.',
          monetization: 'none',
          notes: 'Keep each pilot\'s ship and equipment distinct; boss fights are the highlight of each stage.',
        },
        characters: [
          { id: 'AWA-KAEDE', name: 'Kaede Hoshino', role: 'Squad leader pilot (protagonist)', ageCategory: 'young-adult', bodyProportions: 'athletic, 7 heads tall, 170 cm', face: 'sharp determined eyes, small beauty mark under left eye', hairstyle: 'crimson red high ponytail with long side bangs', eyeColor: 'amber', costume: 'white-and-crimson flight suit with gold trim, short cropped bomber jacket, black fingerless gloves, Kirin squadron patch on left shoulder', weapons: 'spacecraft "Crimson Sparrow" (red interceptor with forward-swept wings); sidearm: compact plasma pistol', abilities: 'Crimson Rush piercing dash', palette: ['#D7263D', '#FFFFFF', '#F2C14E', '#1B1B1E'], allowedTransformations: 'helmet on/off; jacket removed in hangar scenes', artStyle: 'modern anime, clean lineart, cel shading', personality: 'brave, impulsive, protective of the squad', forbiddenChanges: 'never change hair colour, ponytail, amber eyes, beauty mark or squadron patch; no different outfit colours' },
          { id: 'AWA-REN', name: 'Ren Takamine', role: 'Sniper pilot', ageCategory: 'adult', bodyProportions: 'tall and lean, 7.5 heads, 182 cm', face: 'calm narrow eyes, thin rectangular glasses', hairstyle: 'short dark-navy hair with one silver streak', eyeColor: 'ice blue', costume: 'navy flight suit with light-blue panels, long open coat with high collar', weapons: 'spacecraft "Azure Lance" (long-nosed sniper craft with a rail cannon)', abilities: 'Azure Lance charged beam', palette: ['#1F3A93', '#7FB7E6', '#C0C5CE', '#0B0F1A'], allowedTransformations: 'glasses removed only in specific story panels', artStyle: 'modern anime, clean lineart, cel shading', personality: 'analytical, dry humour', forbiddenChanges: 'keep glasses, silver streak and coat; never warm colours on his suit' },
          { id: 'AWA-MIO', name: 'Mio Arakawa', role: 'Engineer / support pilot', ageCategory: 'young-adult', bodyProportions: 'petite, 6.5 heads, 155 cm', face: 'round cheerful face, freckles', hairstyle: 'short wavy honey-blonde bob with goggles on head', eyeColor: 'green', costume: 'yellow-and-olive mechanic flight suit with many pockets, tool belt, oversized work gloves', weapons: 'spacecraft "Honeycomb" (hexagonal support ship deploying drones)', abilities: 'Honeycomb homing drones; repairs allies', palette: ['#F4C430', '#556B2F', '#FFF8DC', '#3B2F2F'], allowedTransformations: 'goggles worn over eyes in cockpit', artStyle: 'modern anime, clean lineart, cel shading', personality: 'cheerful inventor, talks fast', forbiddenChanges: 'always goggles, freckles and tool belt; hair stays short' },
          { id: 'AWA-SORA', name: 'Sora Valen', role: 'Heavy gunner pilot', ageCategory: 'adult', bodyProportions: 'muscular, broad shoulders, 7.5 heads, 188 cm', face: 'scar across right eyebrow, confident grin', hairstyle: 'spiky black hair with purple tips, undercut', eyeColor: 'violet', costume: 'black heavy flight armour with purple accents, shoulder plates', weapons: 'spacecraft "Nightbreaker" (bulky missile gunship)', abilities: 'Nightbreaker Barrage missile volley', palette: ['#2E1A47', '#8E44AD', '#111111', '#B0B0B0'], allowedTransformations: 'armour damage states after boss fights', artStyle: 'modern anime, clean lineart, cel shading', personality: 'loud, loyal, secretly gentle', forbiddenChanges: 'keep eyebrow scar, purple hair tips and shoulder plates' },
        ],
        existing: {},
      }),
    },
    {
      presetId: 'kodama-last-branch',
      label: 'KODAMA: The Last Branch',
      summary: 'Wooden forest spirit protects the ancestral tree with wind-based traversal. Existing-game mode with art preservation.',
      make: () => ({
        name: 'KODAMA: The Last Branch',
        mode: 'existing',
        isSample: true,
        sampleNotice: 'Sample profile in EXISTING-GAME mode. The manifest and working-systems lists are example text — replace them with your real project data. No source files are attached.',
        profile: {
          title: 'KODAMA: The Last Branch',
          logline: 'A small wooden spirit rides the wind to save the dying ancestral tree of a magical forest.',
          story: 'A creeping blight is turning the Ancestral Tree to ash. Kodama, a spirit carved from its last living branch, awakens and must restore the tree\'s roots across four forest realms, learning new wind abilities and growing stronger — and taller — as each root is healed.',
          genre: 'platformer',
          subgenres: ['exploration', 'metroidvania-lite'],
          renderMode: '2.5D',
          platforms: ['android', 'windows'],
          engine: 'godot',
          targetFps: 60,
          orientation: 'landscape',
          combat: 'Light combat: wind gust pushes enemies and projectiles; blight creatures are cleansed rather than killed.',
          abilities: 'Gust dash, updraft glide, leaf-sail double jump, root grapple (late game).',
          world: 'Four forest realms: Mossy Hollows, Lantern Canopy, Misty Marsh, Ashen Heartwood around the Ancestral Tree.',
          progression: 'Healing each root grants a new wind ability and a visible growth stage for Kodama (sapling → young tree spirit).',
          artDirection: 'Soft painterly anime forest with hand-painted backgrounds, warm light shafts, muted greens and golds; blight in desaturated purple-grey.',
          animation: 'Rigged 2.5D character with squash-and-stretch; wind particles; leaf trails.',
          saveSystem: 'Checkpoint shrines autosave; one save slot per profile.',
          controls: 'Touch: left virtual stick, jump, gust buttons; gamepad on PC.',
          difficulty: 'Assist mode (extra glide time, no fall damage) and Normal.',
          audio: 'Acoustic ambient score, wind and wood foley.',
          monetization: 'none',
          notes: 'Existing art must be preserved; new content must match the current painted style.',
        },
        existing: {
          sourceManifest: 'project.godot\nscenes/main.tscn\nscenes/player/kodama.tscn\nscripts/player/kodama_controller.gd\nscripts/player/wind_abilities.gd\nscripts/world/checkpoint_shrine.gd\nscripts/save/save_manager.gd\nassets/art/kodama/\nassets/art/realm1_mossy_hollows/',
          workingSystems: 'Player movement and jump in Mossy Hollows\nGust dash ability\nCheckpoint shrines and autosave\nRealm 1 levels 1–3 playable start to finish\nMain menu and settings',
          requestedChanges: 'Add updraft glide ability triggered by holding jump in wind zones\nAdd wind-zone areas to Realm 1 level 3',
          knownBugs: 'Kodama sometimes clips through thin platforms after a gust dash',
          artReferences: 'assets/art/kodama/kodama_master_v3.png (approved master)\nassets/art/realm1_mossy_hollows/ (approved environment art)',
          constraints: 'Godot 4 project; must keep 60 FPS on mid-range Android; do not change save format without migration.',
          versionControl: 'git',
          currentVersion: '0.4.2',
        },
        characters: [
          { id: 'KDM-KODAMA', name: 'Kodama', role: 'Protagonist — wooden forest spirit', ageCategory: 'ageless-spirit', bodyProportions: 'small, 3 heads tall chibi-like proportions, 60 cm; grows to 4 heads at final stage', face: 'smooth carved-wood face mask with two round glowing eye holes, no mouth', hairstyle: 'no hair; three young leaf sprouts on top of the head', eyeColor: 'soft glowing jade green', costume: 'body of pale birch wood with visible grain, moss scarf, tiny bark bracers', weapons: 'none — uses wind', abilities: 'gust dash, updraft glide, leaf-sail double jump, root grapple', palette: ['#E8DCC4', '#7A9E3F', '#4E6B2A', '#A7F3D0', '#5C4033'], allowedTransformations: 'growth stages (sapling → young tree spirit) adding more leaves and slightly longer limbs', artStyle: 'soft painterly anime, warm light', personality: 'curious, quiet, brave', forbiddenChanges: 'no mouth, no human hair, no clothing beyond moss scarf and bracers; keep glowing jade eyes and leaf sprouts' },
          { id: 'KDM-ELDER', name: 'Grandmother Hinoki', role: 'The Ancestral Tree (guide NPC)', ageCategory: 'elder', bodyProportions: 'colossal tree with a serene face formed in the bark', face: 'closed eyes, gentle expression in bark', hairstyle: 'canopy of gold-green leaves', eyeColor: 'amber light when eyes open', costume: 'shimenawa rope with paper charms around the trunk', weapons: 'none', palette: ['#6B4F2A', '#C9B458', '#3E5C2F'], allowedTransformations: 'blighted state (grey-purple patches) receding as roots heal', artStyle: 'soft painterly anime', forbiddenChanges: 'never a humanoid body; face only in the bark' },
          { id: 'KDM-BLIGHT', name: 'Ash Moth Matriarch', role: 'Final boss — source of the blight', ageCategory: 'non-human', bodyProportions: 'giant moth, wingspan 12 m', face: 'mask-like face with six dim eyes', hairstyle: 'fur collar of ash', eyeColor: 'dull violet', costume: 'tattered wings patterned like burnt paper', weapons: 'ash spores, wind-cancelling wing beats', palette: ['#4B3F57', '#8B7F9A', '#2B2530', '#C2B8D0'], allowedTransformations: 'three phases with increasing wing damage', artStyle: 'soft painterly anime, eerie', forbiddenChanges: 'keep six eyes and burnt-paper wing pattern' },
        ],
      }),
    },
  ];

  PR.create = function (presetId) {
    const pr = PR.LIST.find((p) => p.presetId === presetId);
    if (!pr) throw new Error('Unknown preset ' + presetId);
    const data = pr.make();
    const project = A.schema.createProject(data.mode, data);
    project.presetId = presetId;
    return project;
  };
})(globalThis.AGPS = globalThis.AGPS || {});

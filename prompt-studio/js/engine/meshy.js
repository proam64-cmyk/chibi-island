/* Meshy 3D Studio: text-to-3D, image-to-3D, multi-view, refinement, retopo, UV/PBR, rigging, animation, export, integration. */
(function (A) {
  'use strict';
  const U = A.util, C = A.context, S = A.schema;
  const M = (A.meshy = {});

  M.MODES = [
    { id: 'text-to-3d', label: 'Text-to-3D' },
    { id: 'image-to-3d', label: 'Image-to-3D (single reference)' },
    { id: 'multi-view', label: 'Multi-view image-to-3D' },
  ];
  M.STAGES = [
    { id: 'full', label: 'Full pipeline (all steps)' },
    { id: 'creation', label: '1–3. Creation & reference preparation' },
    { id: 'refine', label: '4. Mesh refinement' },
    { id: 'retopo', label: '5. Retopology & polygon reduction' },
    { id: 'uv', label: '6. UV mapping & textures' },
    { id: 'pbr', label: '7. PBR / toon material preparation' },
    { id: 'rig', label: '8. Character rigging' },
    { id: 'anim', label: '9. Animation preparation' },
    { id: 'export', label: '10. Export & game integration' },
  ];
  M.SUBJECTS = ['character', 'creature', 'vehicle', 'prop', 'weapon', 'environment-piece'];
  M.PLATFORM_TIERS = [
    { id: 'android-low', label: 'Android low-end' },
    { id: 'android-mid', label: 'Android mid-range' },
    { id: 'android-high', label: 'Android high-end / tablets' },
    { id: 'desktop-web', label: 'Desktop / WebGL desktop' },
  ];
  /** Export formats with verified, conservative usage notes. */
  M.FORMATS = [
    { id: 'glb', label: 'GLB (glTF 2.0 binary)', note: 'Best for Three.js, Babylon.js, PlayCanvas and Godot 4; embeds meshes, PBR materials, skin and animations in one file.' },
    { id: 'fbx', label: 'FBX', note: 'Common for Unity and Unreal; check scale (cm vs m) and axis conversion on import.' },
    { id: 'obj', label: 'OBJ (+MTL)', note: 'Static meshes only; no rig or animation. Useful for sculpt/retopo round-trips.' },
    { id: 'usdz', label: 'USDZ', note: 'Apple AR Quick Look; not a typical game-engine import format.' },
    { id: 'stl', label: 'STL', note: '3D printing only; no UVs or materials — not suitable for games.' },
  ];

  /** Conservative triangle budgets (single on-screen hero; scale down for crowds). */
  const BUDGET = {
    character: { 'android-low': [3000, 6000], 'android-mid': [6000, 12000], 'android-high': [12000, 20000], 'desktop-web': [20000, 40000] },
    creature: { 'android-low': [2500, 6000], 'android-mid': [5000, 10000], 'android-high': [10000, 18000], 'desktop-web': [18000, 35000] },
    vehicle: { 'android-low': [1500, 4000], 'android-mid': [3000, 8000], 'android-high': [6000, 12000], 'desktop-web': [12000, 30000] },
    prop: { 'android-low': [200, 1000], 'android-mid': [500, 2000], 'android-high': [1000, 4000], 'desktop-web': [2000, 8000] },
    weapon: { 'android-low': [300, 1200], 'android-mid': [600, 2500], 'android-high': [1000, 4000], 'desktop-web': [2000, 8000] },
    'environment-piece': { 'android-low': [500, 3000], 'android-mid': [1000, 5000], 'android-high': [2000, 8000], 'desktop-web': [4000, 15000] },
  };
  const TEX = { 'android-low': 512, 'android-mid': 1024, 'android-high': 2048, 'desktop-web': 2048 };
  M.recommend = function (subjectType, tier) {
    const b = (BUDGET[subjectType] || BUDGET.prop)[tier] || [5000, 10000];
    return { trisMin: b[0], trisMax: b[1], texture: TEX[tier] || 1024, lods: tier.startsWith('android') ? 2 : 3 };
  };

  M.MESHY_PROMPT_LIMIT = 600; // Meshy text prompt length limit (verify in current Meshy UI/API)

  function meshyPrompt(project, ch, o) {
    const parts = [];
    if (ch) {
      parts.push((o.style === 'toon' ? 'stylized anime toon ' : '') + (ch.role || 'game') + ' character ' + ch.name);
      if (ch.bodyProportions) parts.push(ch.bodyProportions);
      if (ch.hairstyle) parts.push(ch.hairstyle);
      if (ch.costume) parts.push(ch.costume);
      if (ch.weapons && o.includeWeapon) parts.push('holding ' + ch.weapons);
      if (ch.palette.length) parts.push('colors ' + ch.palette.slice(0, 5).join(' '));
    } else parts.push((o.style === 'toon' ? 'stylized anime toon ' : '') + (o.description || o.subjectType));
    if (o.subjectType === 'character' || o.subjectType === 'creature') parts.push(o.pose === 't-pose' ? 'T-pose' : 'A-pose, arms 45 degrees from body', 'symmetrical', 'full body', 'game-ready');
    else parts.push('clean hard surfaces', 'game asset');
    if (o.description && ch) parts.push(o.description);
    let s = parts.filter(Boolean).join(', ');
    if (s.length > M.MESHY_PROMPT_LIMIT) s = s.slice(0, M.MESHY_PROMPT_LIMIT).replace(/,[^,]*$/, '');
    return s;
  }

  const ENGINE_IMPORT = {
    html5: (f) => 'Load with the engine\'s glTF loader (Three.js GLTFLoader / Babylon SceneLoader). Enable KHR_mesh_quantization/Draco or meshopt only if the loader is configured for it. Dispose geometries/textures on scene exit.',
    godot: () => 'Import the GLB into Godot 4 (res://assets/...). In the Import dock set the root type, enable "Generate LODs" if needed, and save materials externally if they will be edited. Use a Skeleton3D + AnimationPlayer from the imported scene.',
    unity: () => 'Import FBX/GLB (GLB needs a glTF importer package such as glTFast). Set Rig to Humanoid for bipeds, verify the avatar mapping, set Scale Factor so 1 unit = 1 m, and enable mesh compression on Android.',
    unreal: () => 'Import FBX (or glTF via the Interchange importer), select a Skeleton, set import uniform scale so the character matches the UE mannequin height, and generate LODs in the Static/Skeletal Mesh editor.',
    defold: () => 'Defold imports glTF/Collada models; verify skinning support for your Defold version and keep bone count low.',
    gamemaker: () => 'GameMaker has no built-in 3D model importer; convert to vertex buffers with a community tool or pre-render sprites from the model.',
    other: () => 'Confirm which formats the engine imports before exporting.',
  };

  M.build = function (project, options) {
    const o = Object.assign({ mode: 'text-to-3d', stage: 'full', subjectType: 'character', tier: 'android-mid', format: 'glb', style: 'toon', rig: 'humanoid', animations: 'idle, walk, run, attack, hit, death', pose: 'a-pose', integrationTool: 'claude', includeWeapon: false }, options || {});
    const q = A.compiler.qLevel(o.quality);
    const ch = o.characterId ? C.characterById(project, o.characterId) : null;
    if ((o.subjectType === 'character') && !ch && !U.has(o.description)) throw new Error('Select a registered character or enter a text description of the subject.');
    const rec = M.recommend(o.subjectType, o.tier);
    const tris = parseInt(o.polyTarget, 10) || rec.trisMax;
    const tex = parseInt(o.texture, 10) || rec.texture;
    const lods = o.lods != null && o.lods !== '' ? parseInt(o.lods, 10) : rec.lods;
    const fmt = M.FORMATS.find((f) => f.id === o.format) || M.FORMATS[0];
    const fam = S.engine(project.profile.engine).family;
    const refs = ch ? C.referenceStatus(project, ch) : { all: [], approved: [] };
    const rigged = (o.subjectType === 'character' || o.subjectType === 'creature') && o.rig !== 'none';
    const name = ch ? ch.name : (o.description || o.subjectType);
    const stage = o.stage;
    const show = (id) => stage === 'full' || stage === id;
    const sec = { paste: [], role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [], questions: [] };

    // paste: Meshy creation prompt
    if (show('creation')) {
      if (o.mode === 'text-to-3d') {
        sec.paste.push({ sub: 'Meshy Text-to-3D prompt (≤ ' + M.MESHY_PROMPT_LIMIT + ' characters)', items: [{ code: meshyPrompt(project, ch, o) }] });
      } else {
        sec.paste.push({ sub: 'Meshy ' + (o.mode === 'multi-view' ? 'Multi-view' : 'Image') + '-to-3D', items: ['Upload the prepared reference image(s) described in "Approved visual references". Optional texture/description text:', { code: meshyPrompt(project, ch, o) }] });
      }
      sec.paste.push('Suggested Meshy settings (names vary by version — verify in the current Meshy UI/API): topology ' + (o.topology || 'quad') + ', target polycount ≈ ' + tris.toLocaleString('en-US') + ', symmetry on' + (o.subjectType === 'character' ? ', A-pose' : '') + ', PBR maps ' + (o.style === 'toon' ? 'off or base colour only (toon shading is done in-engine)' : 'on') + '.');
    }

    sec.role.push('Senior 3D technical artist and game asset pipeline engineer specialising in ' + (o.style === 'toon' ? 'stylised anime/toon' : 'PBR') + ' assets for ' + (o.tier.startsWith('android') ? 'Android mobile games' : 'desktop/WebGL games') + ', using Meshy for initial generation.');
    sec.mission.push('Produce a game-ready ' + o.subjectType + ' asset "' + name + '" for "' + (project.profile.title || project.name) + '" (' + S.engine(project.profile.engine).label + '), starting from Meshy ' + M.MODES.find((m) => m.id === o.mode).label + ' and finishing with verified topology, UVs, materials' + (rigged ? ', rig and animations' : '') + ' and a clean ' + fmt.label + ' export.');
    sec.mission.push('Meshy output is a starting mesh, not a finished game asset. Nothing is considered usable until it passes the inspection checklist below.');
    C.projectSummary(project, q).slice(0, q >= 2 ? 99 : 5).forEach((l) => sec.context.push(l));

    // references
    if (o.mode === 'text-to-3d') sec.references.push('Text-to-3D: no image reference is used. Shape and colour come only from the prompt and the specification below.');
    else if (ch) {
      C.referenceLines(project, ch).forEach((l) => sec.references.push(l));
      sec.references.push(o.mode === 'multi-view'
        ? 'Required reference set: front, side (profile) and back orthographic views of the SAME approved design, identical scale, A-pose, neutral background, flat lighting, no cast shadows, no perspective. Generate them with the Image Studio "Single orthographic view" asset type if missing.'
        : 'Required reference: one clean full-body front or three-quarter view, A-pose, plain background, entire body visible including feet, no motion effects, no overlapping props.');
      if (!refs.approved.length) sec.references.push('No approved reference image is registered. Create and approve the reference views first; image-to-3D on an unapproved or off-model image produces an off-model mesh.');
    } else sec.references.push('Prepare clean reference image(s) of the ' + o.subjectType + ' on a plain background, no perspective distortion, whole object visible.');

    if (ch) C.characterLock(ch, q).forEach((l) => sec.constraints.push(l));
    sec.constraints.push('Triangle budget: ≤ ' + tris.toLocaleString('en-US') + ' triangles for LOD0 (recommended range for this subject on ' + o.tier + ': ' + rec.trisMin.toLocaleString('en-US') + '–' + rec.trisMax.toLocaleString('en-US') + '). Do not ship Meshy\'s raw high-poly output on Android.');
    sec.constraints.push('Texture size: ' + tex + ' × ' + tex + ' max per map' + (o.tier.startsWith('android') ? '; prefer one material / one texture set per character to minimise draw calls' : '') + '.');
    sec.constraints.push('Scale: 1 unit = 1 metre; character height ' + (o.height || '1.7') + ' m; pivot at the feet (ground centre); +Y up' + (fam === 'unreal' ? ' (Unreal: Z up, centimetres — convert on import)' : '') + '; facing ' + (fam === 'godot' ? '-Z (Godot forward)' : fam === 'unity' ? '+Z (Unity forward)' : '+Z (glTF convention: model faces +Z)') + '.');
    if (rigged) sec.constraints.push('Rig: ' + (o.rig === 'humanoid' ? 'humanoid biped skeleton with standard bone naming, ≤ 60 bones on mobile, max 4 bone influences per vertex' : 'custom rig, ≤ 60 bones on mobile, max 4 influences per vertex') + '.');
    sec.constraints.push({ t: 'Do not claim the asset is rigged, animated or game-ready until each was verified in a DCC tool (e.g. Blender) and in the target engine.', q: 1 });

    sec.specs.push('Subject type: ' + o.subjectType + '; style: ' + (o.style === 'toon' ? 'anime toon (cel-shaded in engine, flat base colour textures, optional outline pass)' : 'PBR metallic-roughness') + '.');
    sec.specs.push('Export format: ' + fmt.label + ' — ' + fmt.note);
    sec.specs.push('LOD strategy: LOD0 = ' + tris.toLocaleString('en-US') + ' tris' + (lods > 0 ? Array.from({ length: lods }, (_, i) => '; LOD' + (i + 1) + ' ≈ ' + Math.round(tris / Math.pow(2, i + 1)).toLocaleString('en-US') + ' tris') .join('') : '; no LODs') + '.');
    if (rigged) sec.specs.push('Animations required: ' + o.animations + '. In-place (root motion off) unless the engine controller expects root motion.');
    sec.specs.push({ t: 'Materials: ' + (o.style === 'toon' ? 'base colour map (sRGB); optional emission mask; normal map only if it reads at mobile size' : 'base colour (sRGB), normal (linear, OpenGL +Y unless the engine expects DirectX), packed ORM (occlusion/roughness/metallic, linear)') + '.', q: 2 });
    sec.specs.push({ t: 'Texel density: ~' + (o.tier === 'android-low' ? 256 : o.tier.startsWith('android') ? 512 : 1024) + ' px per metre for the body, up to 2× on the face; keep it consistent between characters that appear together.', q: 3 });
    sec.specs.push({ t: 'Textures: power-of-two, mipmaps on, KTX2 (Basis/ASTC) for WebGL/Android where the loader supports it; base colour in sRGB, data maps linear.', q: 3 });
    sec.specs.push({ t: 'Collision proxy: separate simplified capsule/box colliders (not the render mesh); bounding box recorded in the asset notes (width × height × depth in metres).', q: 3 });
    if (rigged) sec.specs.push({ t: 'Bone naming: consistent left/right suffixes (.L/.R or _l/_r), root bone at origin, no scale keys on bones unless required.', q: 3 });
    sec.specs.push({ t: 'Mobile performance: target ≤ ' + (o.tier === 'android-low' ? '50' : '100') + ' draw calls per frame for the whole scene; GPU-skin only on-screen characters; compress textures (ASTC/ETC2 via KTX2 where supported).', q: 2 });

    const I = sec.instructions;
    if (show('creation')) I.push({ sub: '1–3. Creation & reference preparation', items: [
      o.mode === 'text-to-3d' ? 'Paste the Meshy prompt above; generate several previews and pick the one closest to the character lock (silhouette first, details second).' : 'Upload the prepared reference(s); crop to the subject with small margins; remove background; keep the A-pose.',
      o.mode === 'multi-view' ? 'Make sure all views share identical proportions; if they disagree, fix the drawings first — Meshy cannot resolve contradictory views.' : 'Prefer a front or three-quarter view with clear limb separation.',
      'Download the best candidate as GLB/FBX for inspection. Record the Meshy task/version in the Asset Registry (role: mesh, source tool: Meshy).',
    ] });
    if (show('refine')) I.push({ sub: '4. Mesh refinement', items: [
      'Open in Blender (or your DCC). Check scale, orientation and pivot first; apply transforms.',
      'Remove floating fragments, internal faces and non-manifold geometry; fill holes; merge by distance.',
      'Fix symmetry problems and clean up hands, face and hair — these are the usual failure areas for generated meshes.',
      { t: 'Re-sculpt only where silhouette or face deviates from the character lock; keep it stylised.', q: 2 },
    ] });
    if (show('retopo')) I.push({ sub: '5. Retopology & polygon reduction', items: [
      'Retopologise to quads with edge loops around eyes, mouth, shoulders, elbows, wrists, hips, knees and ankles' + (rigged ? ' (deformation areas need 2–3 loops)' : '') + '.',
      'Reduce to ≤ ' + tris.toLocaleString('en-US') + ' triangles; spend polygons on silhouette and face, not on flat areas.',
      'Generate LODs by decimation from the retopologised mesh (not from Meshy\'s raw output).',
      { t: 'Bake high-poly detail into a normal map only if it is visible at gameplay camera distance.', q: 2 },
    ] });
    if (show('uv')) I.push({ sub: '6. UV mapping & texture creation', items: [
      'Unwrap with minimal stretching; straighten UV islands where possible; 4–8 px padding at ' + tex + ' px.',
      'Give the face and front-facing areas more texel density.',
      'Re-project or re-paint Meshy\'s texture onto the new UVs; correct colours to the exact palette hex values.',
    ] });
    if (show('pbr')) I.push({ sub: '7. Material preparation', items: o.style === 'toon' ? [
      'Use flat base colour textures; shading and outline are done by the engine toon shader.',
      'Keep shadows out of the base colour (no baked lighting) so in-engine lighting stays consistent.',
      'Create an optional emission mask for glowing parts (eyes, weapon energy).',
    ] : [
      'Create base colour (no lighting baked), normal, and packed ORM maps.',
      'Check metallic values are 0 or 1 for most surfaces; roughness varies by material.',
      'Verify colour spaces: base colour sRGB; normal/ORM linear.',
    ] });
    if (show('rig') && rigged) I.push({ sub: '8. Character rigging', items: [
      'Rig with ' + (o.rig === 'humanoid' ? 'a humanoid skeleton (Meshy auto-rigging, Mixamo-style auto-rigger, or manual Rigify)' : 'a custom skeleton') + '. Auto-rigging results must be inspected.',
      'Weight paint: test extreme poses (arms up, deep crouch, twist) and fix shoulder, elbow, hip and knee collapse.',
      'Limit to 4 influences per vertex and normalise weights before export.',
      { t: 'Hair, cloth or accessories: use a few extra bones or engine-side spring/physics bones, not hundreds.', q: 2 },
    ] });
    if (show('anim') && rigged) I.push({ sub: '9. Animation preparation', items: [
      'Create or retarget clips: ' + o.animations + '.',
      'Name clips consistently (e.g. ' + U.slug(name) + '_idle) and make loops seamless (first frame = last frame).',
      'Mark gameplay events (footsteps, hit frames, projectile spawn) with timestamps for the integration prompt.',
      { t: 'Keep animation at 30 fps sampling unless the engine needs more; remove redundant keys.', q: 2 },
    ] });
    if (show('export')) I.push({ sub: '10. Export & game integration', items: [
      'Export ' + fmt.label + ' with applied transforms, +Y up (engine converts as needed), embedded or packed textures, ' + (rigged ? 'skin and all animation clips' : 'no armature') + '.',
      'Re-import the exported file into a clean scene to verify it before handing it to the engine.',
      ENGINE_IMPORT[fam] ? ENGINE_IMPORT[fam](fmt) : ENGINE_IMPORT.other(),
      'Register the final file in the Asset Registry (role: mesh' + (rigged ? '; animations as role: animation' : '') + '), with dependencies on its reference images and textures.',
    ] });

    sec.outputs.push('Mesh: ' + (ch ? ch.id : U.slug(name)) + '_mesh_v01.' + fmt.id + (lods > 0 ? ' (+ _lod1…_lod' + lods + ')' : ''));
    sec.outputs.push('Textures: ' + (ch ? ch.id : U.slug(name)) + '_basecolor_' + tex + '.png' + (o.style === 'toon' ? '' : ', _normal, _orm'));
    if (rigged) sec.outputs.push('Animation clips embedded in the ' + fmt.id.toUpperCase() + ' or exported per clip, named consistently.');

    // QA checklist
    sec.validation.push({ sub: 'Quality inspection checklist', items: [
      'Topology: quads in deformation areas, no n-gons on deforming parts, no non-manifold edges, no internal faces.',
      'Triangle count ≤ ' + tris.toLocaleString('en-US') + ' (LOD0) — read it from the DCC statistics, not from Meshy.',
      'Scale and orientation: stands on the ground at origin, correct height, faces forward in the engine.',
      'Normals: consistent outward normals, no shading seams; smooth/hard edges intentional.',
      'UVs: no overlaps (unless mirrored intentionally), no heavy stretching, padding present.',
      'Materials: correct colour spaces, palette matches the character lock, no baked lighting on toon assets.',
      rigged ? 'Deformation: extreme poses show no collapsing joints, candy-wrapper twists or detached geometry.' : 'Static asset: no armature, transforms applied.',
      'Engine compatibility: imports without warnings; materials, skin and animations work in a test scene.',
    ] });
    sec.validation.push({ sub: 'Export checklist', items: [
      'Transforms applied; pivot correct; units = metres.',
      'Only required objects exported (no cameras, lights or helper meshes).',
      'Textures within ' + tex + ' px and power-of-two dimensions.',
      rigged ? 'All animation clips present, looping clips seamless, root bone at origin.' : 'No empty animation tracks.',
      'File re-imported successfully in a clean scene.',
    ] });
    sec.acceptance.push('The asset renders in the target engine on a mid-range Android device (or equivalent emulator profile) without frame-time spikes when 3 instances are visible.');
    sec.acceptance.push('Side-by-side with the approved 2D master, the model is recognisably the same design (silhouette, hair, costume, palette).');
    if (rigged) sec.acceptance.push('Every required clip plays in-engine; hit/footstep events fire at the documented frames.');
    sec.recovery.push('Meshy result is off-model → improve/approve the reference views first, then regenerate; do not "fix in retopo" a wrong design.');
    sec.recovery.push('Mesh too dense or messy → retopologise manually or with a remesher; never ship the raw mesh.');
    sec.recovery.push('Auto-rig fails or deforms badly → re-rig manually (e.g. Rigify) after cleaning topology around joints.');
    sec.recovery.push('Import errors → re-export with transforms applied, triangulate on export if the engine requires it, check the axis/scale settings.');

    // integration prompt for code AI
    const toolName = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }[o.integrationTool] || 'the coding assistant';
    sec.deliverables.push('Validated ' + fmt.label + ' file(s) + textures registered in the Asset Registry with approval status.');
    sec.deliverables.push({ sub: 'Game integration prompt for ' + toolName, items: [{ code: [
      'You are integrating a 3D asset into an existing ' + S.engine(project.profile.engine).label + ' project ("' + (project.profile.title || project.name) + '").',
      'Asset: ' + (ch ? ch.id : U.slug(name)) + '_mesh_v01.' + fmt.id + ' (' + name + '), ' + tris + ' tris LOD0, ' + tex + ' px textures' + (rigged ? ', clips: ' + o.animations : '') + '.',
      'Tasks:',
      '1. Load the asset with the project\'s existing loading/asset-manifest system (inspect the code first; do not add a second loader).',
      '2. Apply the project\'s existing ' + (o.style === 'toon' ? 'toon/outline material' : 'PBR material setup') + '; do not change other materials.',
      rigged ? '3. Wire animation clips to the character state machine (idle/walk/run/attack/hit/death) with cross-fades of 0.1–0.2 s.' : '3. Place the asset with correct scale (1 unit = 1 m) and collision.',
      '4. Add LOD switching if the engine supports it; dispose resources when the scene unloads.',
      '5. Report draw calls and frame time before/after on the test scene.',
      'Constraints: do not modify unrelated systems; keep the change minimal; if a file you need is not available to you, ask for it instead of guessing.',
    ].join('\n') }] });
    sec.questions = [];
    if (fam === 'gamemaker') sec.questions.push('GameMaker has limited 3D support — confirm whether to pre-render sprites instead of importing a mesh.');
    if (!ch && o.subjectType === 'character') sec.questions.push('Register this character in Characters so continuity data is reused.');

    return {
      title: 'Meshy 3D — ' + name + ' (' + M.STAGES.find((s) => s.id === stage).label + ')',
      toolLabel: 'Meshy + ' + toolName,
      stageLabel: M.STAGES.find((s) => s.id === stage).label,
      sections: sec,
      meta: { category: 'meshy', tool: 'meshy', characterIds: ch ? [ch.id] : [], taskType: stage === 'full' ? 'asset-pipeline' : 'asset-step', routine: false, complexity: stage === 'full' ? 60 : 35, maxChars: M.MESHY_PROMPT_LIMIT },
    };
  };
})(globalThis.AGPS = globalThis.AGPS || {});

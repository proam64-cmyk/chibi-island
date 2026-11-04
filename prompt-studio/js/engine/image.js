/* Professional anime image prompt engine with one adapter per provider. */
(function (A) {
  'use strict';
  const U = A.util, C = A.context;
  const I = (A.image = {});

  const DEFAULT_STYLE = 'high-quality modern anime game art, clean confident lineart, cel shading with crisp two-tone shadows';

  /* ---------- Asset types ---------- */
  I.ASSET_TYPES = [
    { id: 'concept', label: 'Character concept art', aspect: '2:3', needsChar: true, stage: 'concept' },
    { id: 'master-sheet', label: 'Full-body character master sheet', aspect: '16:9', needsChar: true, stage: 'master-sheet' },
    { id: 'turnaround', label: 'Single orthographic view (front / side / back)', aspect: '2:3', needsChar: true, stage: '3d-reference' },
    { id: 'expressions', label: 'Facial expression sheet', aspect: '1:1', needsChar: true, stage: '2d-asset' },
    { id: 'combat-poses', label: 'Combat pose sheet', aspect: '16:9', needsChar: true, stage: '2d-asset' },
    { id: 'outfit-weapon', label: 'Clothing & weapon sheet', aspect: '16:9', needsChar: true, stage: '2d-asset' },
    { id: 'sprite-sheet', label: 'Sprite sheet (animation keyframes)', aspect: '16:9', needsChar: true, stage: '2d-asset' },
    { id: 'background', label: '2D background scene', aspect: '16:9', needsChar: false },
    { id: 'parallax', label: 'Parallax background layers', aspect: '16:9', needsChar: false },
    { id: 'enemy', label: 'Enemy design', aspect: '1:1', needsChar: false },
    { id: 'boss', label: 'Boss design', aspect: '1:1', needsChar: false },
    { id: 'ui-icons', label: 'Game UI & icon set', aspect: '1:1', needsChar: false },
    { id: 'tileset', label: 'Tileset', aspect: '1:1', needsChar: false },
    { id: 'loading-screen', label: 'Loading screen art', aspect: '16:9', needsChar: false },
    { id: 'title-screen', label: 'Title screen key art', aspect: '16:9', needsChar: false },
    { id: 'marketing', label: 'Marketing / store promotional art', aspect: '2:1', needsChar: false },
  ];
  I.assetType = (id) => I.ASSET_TYPES.find((t) => t.id === id) || I.ASSET_TYPES[0];

  /* ---------- Providers ---------- */
  I.PROVIDERS = [
    { id: 'chatgpt-image', label: 'ChatGPT Image', style: 'prose', negative: 'inline', refs: 'attach', maxChars: 4000,
      sizes: { '1:1': '1024×1024', '2:3': '1024×1536', '3:2': '1536×1024' } },
    { id: 'gemini-image', label: 'Gemini image generation', style: 'prose', negative: 'inline', refs: 'attach-multi', maxChars: 4000 },
    { id: 'midjourney', label: 'Midjourney', style: 'tags', negative: 'mj', refs: 'url', maxChars: 1500 },
    { id: 'leonardo', label: 'Leonardo AI', style: 'tags', negative: 'field', refs: 'upload-guidance', maxChars: 1000 },
  ];
  I.provider = function (id, settings) {
    const custom = ((settings && settings.customProviders) || []).map((c) => Object.assign({ custom: true, style: 'prose', negative: 'inline', refs: 'none', maxChars: 2000 }, c));
    return I.PROVIDERS.concat(custom).find((p) => p.id === id) || I.PROVIDERS[0];
  };
  I.allProviders = (settings) => I.PROVIDERS.concat(((settings && settings.customProviders) || []).map((c) => Object.assign({ custom: true }, c)));

  function ratio(ar) { const m = String(ar).split(':').map(Number); return m[0] && m[1] ? m[0] / m[1] : 1; }
  function nearestSize(prov, ar) {
    const target = ratio(ar);
    let best = null;
    Object.keys(prov.sizes || {}).forEach((k) => { if (!best || Math.abs(ratio(k) - target) < Math.abs(ratio(best) - target)) best = k; });
    return best;
  }
  function pixelDims(ar, longSide) {
    const r = ratio(ar); longSide = longSide || 1536;
    let w, h;
    if (r >= 1) { w = longSide; h = Math.round(longSide / r); } else { h = longSide; w = Math.round(longSide * r); }
    return { w: Math.round(w / 8) * 8, h: Math.round(h / 8) * 8 };
  }

  /* ---------- Subject descriptions ---------- */
  function charLook(ch, q) {
    const bits = [];
    if (ch.ageCategory) bits.push(A.schema.ageCategory(ch.ageCategory).label.replace(/\s*\(.*\)/, '').toLowerCase());
    if (ch.bodyProportions) bits.push(ch.bodyProportions);
    if (ch.hairstyle) bits.push(ch.hairstyle);
    if (ch.eyeColor) bits.push(ch.eyeColor + ' eyes');
    if (ch.face && q >= 2) bits.push(ch.face);
    if (ch.costume) bits.push('wearing ' + ch.costume);
    if (ch.weapons) bits.push('equipment: ' + ch.weapons);
    if (q >= 3 && ch.palette.length) bits.push('exact palette ' + ch.palette.join(' '));
    return bits;
  }

  function subject(type, ctx) {
    const { ch, project, opts, q } = ctx;
    const p = project.profile;
    const name = ch ? ch.name : '';
    const world = opts.scene || p.world || 'the game world';
    switch (type.id) {
      case 'concept': return { what: 'anime character concept art of ' + name + ', ' + (ch.role || 'game character'), comp: ['full body, head to toe visible', 'confident readable standing pose that shows the silhouette', 'plain light-grey background'] };
      case 'master-sheet': return { what: 'character model sheet (turnaround) of ' + name, comp: ['four full-body views side by side: front, three-quarter, side profile, back', 'identical scale, all feet on one shared ground line, relaxed A-pose with arms slightly away from body', 'flat even lighting, neutral grey background', q >= 2 ? 'a row of flat colour swatches matching the palette below the figures' : ''] };
      case 'turnaround': { const v = opts.view || 'front'; return { what: v + ' view of ' + name + ', orthographic character reference', comp: ['single full-body figure, ' + v + ' view only, centred', 'relaxed A-pose, arms 30 degrees from body, legs slightly apart (clean for 3D modelling)', 'no perspective distortion, flat even lighting, no cast shadows, plain neutral background'] }; }
      case 'expressions': return { what: 'facial expression sheet of ' + name, comp: ['3×3 grid of head-and-shoulders portraits, same angle, same lighting, same scale', 'expressions: ' + (opts.expressions || 'neutral, happy, angry, sad, surprised, determined, embarrassed, hurt, smug')] };
      case 'combat-poses': return { what: 'combat pose sheet of ' + name, comp: ['4 to 6 full-body dynamic action poses side by side', 'poses use the specified weapons and abilities: ' + (ch.weapons || ch.abilities || 'unarmed'), 'clear readable silhouettes; effects never cover the face', 'plain background'] };
      case 'outfit-weapon': return { what: 'costume and equipment breakdown sheet for ' + name, comp: ['costume pieces laid out flat and separated (top, bottom, footwear, accessories)', 'each weapon shown in orthographic front and side view', 'consistent scale, neutral background'] };
      case 'sprite-sheet': return { what: 'sprite sheet of ' + name + ', ' + (opts.animation || 'idle loop') + ' animation keyframes', comp: [(opts.frames || 6) + ' evenly spaced frames in a single horizontal row', 'side view facing right, identical character scale in every frame', 'flat solid ' + (opts.chroma || 'pure green #00FF00') + ' background for keying', 'no motion blur, no frame overlap'] };
      case 'background': return { what: '2D game background, ' + world, comp: ['wide establishing composition designed for gameplay', 'clear readable play area with lower detail and contrast where characters move', 'no characters'] };
      case 'parallax': return { what: 'parallax background layers for ' + world, comp: ['generate each layer as a separate image with the same lighting and palette', 'layers: far sky, distant scenery, mid-ground, near foreground', 'horizontally tileable left and right edges', 'areas that must be transparent filled with flat ' + (opts.chroma || 'pure green #00FF00') + ' for keying'] };
      case 'enemy': return { what: 'enemy design for ' + (p.title || 'the game') + ': ' + (opts.subject || 'a common enemy that fits ' + world), comp: ['full body, three-quarter view', 'silhouette clearly distinct from the player characters', 'hostile colour coding that reads instantly on mobile screens', 'plain background'] };
      case 'boss': return { what: 'boss design: ' + (opts.subject || 'a multi-phase boss that fits ' + world), comp: ['full body, imposing low camera angle', 'visible weak points and readable attack telegraph parts', q >= 2 ? 'scale reference: a small human silhouette beside it' : '', 'plain background'] };
      case 'ui-icons': return { what: 'game UI icon set: ' + (opts.subject || 'health potion, shield, coin, gem, settings gear, pause, map, inventory bag, skill star'), comp: ['icons arranged on an even grid, one icon per cell', 'consistent outline weight, lighting direction and perspective', 'readable at 48 px, flat plain background'] };
      case 'tileset': return { what: (opts.subject || 'ground and platform') + ' tileset for ' + world, comp: [(opts.view || 'side view') + ' tiles on a strict square grid', 'seamless edges between neighbouring tiles', 'consistent top-left lighting'] };
      case 'loading-screen': return { what: 'loading screen illustration for ' + (p.title || 'the game') + ', ' + (opts.subject || world), comp: ['strong focal point in the upper two thirds', 'calm empty band along the bottom 20% reserved for the loading bar (leave it empty)'] };
      case 'title-screen': return { what: 'title screen key art for ' + (p.title || 'the game'), comp: [opts.subject || 'the main cast in a dramatic group composition', 'empty negative space in the upper third reserved for the logo, which is added later in the engine'] };
      case 'marketing': return { what: 'promotional key art for ' + (p.title || 'the game'), comp: [opts.subject || 'heroic cast composition with the world behind them', 'cinematic lighting, high energy', 'central subject kept inside a safe area for cropping to store graphics'] };
      default: return { what: type.label, comp: [] };
    }
  }

  function styleLines(ctx) {
    const { ch, project, q } = ctx;
    const base = (ch && ch.artStyle) || project.profile.artDirection || DEFAULT_STYLE;
    const L = [base];
    if (q >= 2) L.push('consistent line weight', 'controlled saturation', 'clean shapes suitable for a game asset pipeline');
    if (q >= 3) L.push('lighting from upper left', 'no painterly texture noise', 'sharp edges at native resolution');
    return L;
  }

  function negatives(ctx) {
    const { ch, opts, type } = ctx;
    const n = ['blurry', 'low resolution', 'jpeg artifacts', 'extra fingers', 'malformed hands', 'extra limbs', 'distorted face', 'nsfw'];
    if (type.needsChar) n.push('off-model costume', 'palette drift', 'inconsistent eye colour', 'different hairstyle');
    if (['concept', 'master-sheet', 'turnaround'].includes(type.id)) n.push('cropped feet', 'cropped head');
    if (opts.cleanArt !== false) n.push('text', 'letters', 'speech bubble', 'caption', 'label', 'watermark', 'signature', 'logo');
    if (ch && A.schema.isMinor(ch)) n.push('suggestive pose', 'revealing clothing', 'sexualised framing');
    if (opts.negative) U.list(opts.negative).forEach((x) => n.push(x));
    return U.uniq(n);
  }

  /* ---------- Adapter renderers (copy-ready block) ---------- */
  function proseBlock(ctx, prov) {
    const { ch, q, type, opts } = ctx;
    const s = subject(type, ctx);
    const out = [];
    out.push('Create a ' + s.what + '.');
    if (ch) out.push('Character design (must match exactly): ' + charLook(ch, Math.max(q, 2)).join('; ') + '.');
    if (ch && ch.forbiddenChanges) out.push('Do not change: ' + ch.forbiddenChanges + '.');
    out.push('Composition: ' + s.comp.filter(Boolean).join('; ') + '.');
    out.push('Style: ' + styleLines(ctx).join(', ') + '.');
    if (opts.extra) out.push(opts.extra.trim());
    if (ch && A.schema.isMinor(ch)) out.push('This character is a minor: fully clothed, age-appropriate, non-sexualised pose and framing.');
    if (opts.cleanArt !== false) out.push('Clean art only: no dialogue, no speech bubbles, no text, no labels, no watermark.');
    const ar = opts.aspect || type.aspect;
    if (prov.id === 'chatgpt-image') {
      const sz = nearestSize(prov, ar);
      out.push('Format: ' + (sz === ar ? ar : sz + ' (closest supported to ' + ar + ', crop afterwards)') + ' at ' + prov.sizes[sz] + (opts.transparent ? ', transparent background if available' : '') + '.');
    } else out.push('Aspect ratio: ' + ar + '.');
    out.push('Avoid: ' + negatives(ctx).join(', ') + '.');
    return out.join('\n\n');
  }

  function tagParts(ctx) {
    const { ch, q, type, opts } = ctx;
    const s = subject(type, ctx);
    const parts = [s.what];
    if (ch) charLook(ch, q).forEach((x) => parts.push(x));
    s.comp.filter(Boolean).forEach((x) => parts.push(x));
    styleLines(ctx).forEach((x) => parts.push(x));
    if (opts.extra) parts.push(opts.extra.trim());
    if (ch && A.schema.isMinor(ch)) parts.push('age-appropriate, fully clothed');
    return parts;
  }

  function midjourneyBlock(ctx, refs) {
    const { opts, type } = ctx;
    const mj = opts.mjModel || 'niji 6';
    const parts = tagParts(ctx);
    const params = [];
    params.push('--ar ' + (opts.aspect || type.aspect));
    params.push(mj.startsWith('niji') ? '--niji ' + (mj.split(' ')[1] || '6') : '--v ' + (mj.split(' ')[1] || '7'));
    params.push('--stylize ' + (opts.stylize != null ? opts.stylize : 100));
    if (opts.seed) params.push('--seed ' + opts.seed);
    if (type.id === 'tileset' && opts.seamless !== false) params.push('--tile');
    if (refs.length) {
      const omni = /^v\s?7/.test(mj.replace('--', ''));
      params.push((omni ? '--oref ' : '--cref ') + refs[0].publicUrl);
      params.push((omni ? '--ow ' : '--cw ') + (opts.refWeight || 100));
    }
    if (opts.styleRefUrl && /^https:\/\//.test(opts.styleRefUrl)) params.push('--sref ' + opts.styleRefUrl);
    params.push('--no ' + negatives(ctx).join(', '));
    return parts.join(', ') + ' ' + params.join(' ');
  }

  function leonardoBlocks(ctx, prov) {
    const prompt = tagParts(ctx).join(', ');
    return { prompt: prompt.length > prov.maxChars ? prompt.slice(0, prov.maxChars - 1).replace(/,[^,]*$/, '') : prompt, negative: negatives(ctx).join(', '), trimmed: prompt.length > prov.maxChars };
  }

  function customBlock(ctx, prov) {
    const { opts, type } = ctx;
    const ar = opts.aspect || type.aspect;
    let main = prov.style === 'tags' ? tagParts(ctx).join(', ') : proseBlock(ctx, Object.assign({}, prov, { id: 'custom' })).split('\n\nAvoid:')[0];
    if (prov.aspectSyntax) { const [w, h] = ar.split(':'); main += ' ' + prov.aspectSyntax.replace('{w}', w).replace('{h}', h); }
    const neg = negatives(ctx).join(', ');
    if (prov.negative === 'inline') main += (prov.style === 'tags' ? ', ' : '\n\n') + (prov.negativePrefix || 'Avoid: ') + neg;
    return { main, negative: prov.negative === 'field' ? neg : '' };
  }

  /* ---------- Spec builder ---------- */
  I.build = function (project, options, settings) {
    const opts = Object.assign({ assetType: 'concept', provider: 'chatgpt-image', cleanArt: true }, options || {});
    const q = A.compiler.qLevel(opts.quality);
    const type = I.assetType(opts.assetType);
    const prov = I.provider(opts.provider, settings);
    const ch = opts.characterId ? C.characterById(project, opts.characterId) : null;
    if (type.needsChar && !ch) throw new Error('"' + type.label + '" needs a registered character. Add one in Characters, then select it.');
    const ctx = { project, opts, q, type, ch, prov };
    const refStatus = ch ? C.referenceStatus(project, ch) : { all: [], approved: [], withUrl: [] };
    const sec = { paste: [], role: [], mission: [], context: [], references: [], constraints: [], specs: [], instructions: [], outputs: [], validation: [], acceptance: [], recovery: [], deliverables: [] };
    const ar = opts.aspect || type.aspect;

    // --- copy-ready block(s)
    if (prov.id === 'midjourney') {
      const refs = refStatus.withUrl;
      if (type.id === 'parallax') {
        ['far sky layer', 'distant scenery layer', 'mid-ground layer', 'near foreground layer'].forEach((layer) => {
          sec.paste.push({ sub: 'Layer: ' + layer, items: [{ code: midjourneyBlock(Object.assign({}, ctx, { opts: Object.assign({}, opts, { extra: (opts.extra ? opts.extra + ', ' : '') + layer + ' only' }) }), refs) }] });
        });
      } else sec.paste.push({ code: midjourneyBlock(ctx, refs) });
      sec.paste.push('Paste into Midjourney (/imagine or the web prompt bar). Model: ' + (opts.mjModel || 'niji 6') + ' — Niji models are tuned for anime; verify parameter support in your Midjourney version.');
    } else if (prov.id === 'leonardo') {
      const b = leonardoBlocks(ctx, prov);
      sec.paste.push({ sub: 'Prompt field', items: [{ code: b.prompt }] });
      sec.paste.push({ sub: 'Negative prompt field', items: [{ code: b.negative }] });
      const d = pixelDims(ar, 1536);
      sec.paste.push('Dimensions: ' + d.w + ' × ' + d.h + ' px (aspect ' + ar + '); reduce if your Leonardo plan/model caps the size.');
      if (b.trimmed) sec.paste.push('Note: prompt trimmed to ' + prov.maxChars + ' characters for the Leonardo prompt field; the full continuity lock is in the sections below.');
    } else if (prov.custom) {
      const b = customBlock(ctx, prov);
      sec.paste.push({ code: b.main });
      if (b.negative) sec.paste.push({ sub: 'Negative prompt', items: [{ code: b.negative }] });
    } else {
      if (type.id === 'parallax') {
        ['far sky', 'distant scenery', 'mid-ground', 'near foreground'].forEach((layer) => {
          sec.paste.push({ sub: 'Layer: ' + layer, items: [{ code: proseBlock(Object.assign({}, ctx, { opts: Object.assign({}, opts, { extra: 'Draw ONLY the ' + layer + ' layer. ' + (opts.extra || '') }) }), prov) }] });
        });
      } else sec.paste.push({ code: proseBlock(ctx, prov) });
    }

    // --- references
    if (ch) {
      let hint = '';
      if (refStatus.approved.length) {
        if (prov.refs === 'attach') hint = 'Attach the approved master image(s) in the same ChatGPT message and add: "Use the attached image as the exact design reference for ' + ch.name + '. Preserve face, hair, eye colour, costume and palette."';
        else if (prov.refs === 'attach-multi') hint = 'Attach the approved master and any approved turnaround views together (Gemini accepts multiple reference images) and ask it to keep ' + ch.name + ' identical to them.';
        else if (prov.refs === 'url') hint = refStatus.withUrl.length ? 'Character reference parameter uses the approved public URL from the registry.' : 'Midjourney needs a public https URL for character references. Add one to the approved asset in the registry (Assets → Public URL) to include --oref/--cref automatically.';
        else if (prov.refs === 'upload-guidance') hint = 'Upload the approved master as an image/character reference in Leonardo (feature availability depends on the selected model and plan).';
        else hint = prov.referenceNote || 'Attach the approved reference if this tool supports image references.';
      }
      C.referenceLines(project, ch, hint).forEach((l) => sec.references.push(l));
    } else sec.references.push({ t: 'No character reference is used for this asset type.', q: 2 });

    // --- role / mission / context
    sec.role.push('Anime game art director preparing production-ready ' + type.label.toLowerCase() + ' for ' + prov.label + '.');
    sec.mission.push('Produce ' + type.label.toLowerCase() + (ch ? ' of ' + ch.name + ' (' + ch.id + ')' : '') + ' for "' + (project.profile.title || project.name) + '" that matches the project art direction and stays on-model.');
    sec.context.push('Game: ' + (project.profile.title || project.name) + ' — ' + C.genreLabel(project.profile.genre) + ', ' + project.profile.renderMode + ', ' + A.schema.engine(project.profile.engine).label + '.');
    if (project.profile.artDirection) sec.context.push('Art direction: ' + project.profile.artDirection);
    if (project.profile.world && !type.needsChar) sec.context.push({ t: 'World: ' + project.profile.world, q: 2 });
    if (type.stage) sec.context.push({ t: 'Pipeline stage: ' + type.stage + ' (Character concept → Master sheet → 2D asset → 3D reference → Meshy → Refinement → Game integration).', q: 2 });

    // --- constraints
    if (ch) C.characterLock(ch, q).forEach((l) => sec.constraints.push(l));
    C.continuityRules(ch ? [ch] : []).forEach((l) => sec.constraints.push({ t: l, q: 2 }));
    if (opts.cleanArt !== false) C.cleanArtRules().forEach((l) => sec.constraints.push(l));
    if (prov.id === 'midjourney') sec.constraints.push({ t: 'Negative constraints are expressed through the --no parameter (Midjourney does not use a separate negative field).', q: 2 });
    else if (prov.negative === 'field') sec.constraints.push({ t: 'Negative constraints go in the dedicated negative-prompt field, not in the main prompt.', q: 2 });
    else sec.constraints.push({ t: prov.label + ' has no separate negative-prompt field; negatives are phrased as an "Avoid:" sentence.', q: 2 });

    // --- specs
    sec.specs.push('Aspect ratio: ' + ar + (prov.id === 'chatgpt-image' ? ' (ChatGPT Image supports square, portrait 2:3 and landscape 3:2; other ratios are cropped afterwards)' : ''));
    if (type.id === 'sprite-sheet') {
      sec.specs.push('Animation: ' + (opts.animation || 'idle loop') + ', ' + (opts.frames || 6) + ' frames; target frame cell ' + (opts.cell || '256×256') + ' px after slicing.');
      sec.specs.push('Image generators do not reliably produce exact frame grids or perfectly consistent in-betweens: plan to slice, align and clean frames manually (e.g. in Aseprite or Krita) or use these as keyframes for hand/rig animation.');
    }
    if (type.id === 'parallax') sec.specs.push('Each layer is generated separately; most generators cannot output real transparency, so key out the flat chroma colour afterwards.');
    if (type.id === 'tileset') sec.specs.push('Target tile size: ' + (opts.cell || '64×64') + ' px; verify seams in the engine with a 3×3 repeat test.');
    if (type.id === 'marketing') sec.specs.push({ t: 'Google Play feature graphic is 1024 × 500 px; store screenshots must come from real gameplay, not generated art.', q: 1 });
    if (type.id === 'title-screen' || type.id === 'loading-screen') sec.specs.push('Text, logos and progress bars are rendered by the game engine, never baked into the image.');
    sec.specs.push({ t: 'Deliver at the highest resolution the tool offers; upscale only with an anime-aware upscaler and re-check line quality.', q: 2 });

    // --- instructions
    sec.instructions.push('Generate ' + (opts.variants || 4) + ' variations from the copy-ready prompt.');
    sec.instructions.push('Compare each variation against the character lock / constraints and discard anything off-model.');
    if (ch && !refStatus.approved.length && type.id !== 'concept' && type.id !== 'master-sheet')
      sec.instructions.push('No approved master exists yet: consider producing and approving a master sheet first; downstream assets drift without one.');
    sec.instructions.push({ t: 'If one variation is close, iterate on it (vary/region edit/inpaint) instead of re-rolling a completely new batch.', q: 2 });
    sec.instructions.push({ t: 'Fix small defects (hands, buckles, eye highlights) with inpainting or manual paint-over before approval.', q: 3 });

    // --- outputs / validation / acceptance / recovery / deliverables
    const fname = (ch ? ch.id : U.slug(project.profile.title || project.name)) + '_' + type.id + '_v01.png';
    sec.outputs.push('File name: ' + fname + ' (increment the version for revisions).');
    sec.outputs.push('PNG, sRGB, no compression artifacts.');
    sec.outputs.push({ t: 'Register the chosen image in the studio Asset Registry with role, source tool (' + prov.label + '), version and approval status.', q: 1 });
    if (ch) {
      sec.validation.push('Hair, eye colour (' + (ch.eyeColor || 'as specified') + '), costume and weapons match the character lock.');
      sec.validation.push('Palette matches: ' + C.paletteText(ch) + '.');
      sec.validation.push('Proportions match: ' + (ch.bodyProportions || 'as specified') + '.');
    }
    if (opts.cleanArt !== false) sec.validation.push('No text, bubbles, labels, watermark or signature anywhere in the image.');
    sec.validation.push('Anatomy: correct hands/fingers, limbs, joints; no fused objects.');
    sec.validation.push({ t: 'Silhouette reads clearly at small mobile size (view at 25% zoom).', q: 2 });
    sec.acceptance.push('A second person (or a fresh look next day) identifies the character / asset correctly from the image alone.');
    sec.acceptance.push('Placed next to previously approved assets, nothing looks off-model.');
    sec.recovery.push('Design drift → attach the approved master again, lower stylisation/creativity, and restate the forbidden changes.');
    sec.recovery.push('Wrong colours → state hex values explicitly or correct with a hue/colour-balance pass.');
    sec.recovery.push('Unwanted text → regenerate with stronger negatives, or remove via inpainting.');
    sec.recovery.push({ t: 'Persistent anatomy errors → simplify the pose, then reintroduce complexity once the base is correct.', q: 2 });
    sec.deliverables.push('Approved image file(s) named as above, registered in the Asset Registry with approval status.');
    if (type.id === 'master-sheet') sec.deliverables.push('Once approved, link it to the character as its master reference so every later prompt reuses it.');

    return {
      title: type.label + (ch ? ' — ' + ch.name : '') + ' (' + prov.label + ')',
      toolLabel: prov.label,
      stageLabel: type.label,
      sections: sec,
      meta: { category: 'image', tool: prov.id, aspect: ar, maxChars: prov.maxChars, cleanArt: opts.cleanArt !== false, characterIds: ch ? [ch.id] : [], taskType: 'image-prompt', routine: false, complexity: 20 + (q * 5) },
    };
  };
})(globalThis.AGPS = globalThis.AGPS || {});

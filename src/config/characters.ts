/**
 * Character registry with visual identity (Master Game System Prompt V1.0 + Character Visual Recognition System).
 * A character is VERIFIED only after its GLB has been inspected and compared with the approved reference image
 * (tools/character_sheet.py) AND the user confirms it. Until then: UNVERIFIED. Never infer missing details.
 */
export type CharacterCategory = 'permanent_npc' | 'starting_playable' | 'unlockable_playable';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED';

export interface CharacterRecord {
  id: string;
  name: string;
  category: CharacterCategory;
  role: string;
  location: string;
  /** Text identification (supporting data). The reference image and the GLB are the primary sources. */
  visual: { sex?: 'female' | 'male'; hair?: string; eyes?: string; face?: string; clothing?: string[]; accessories?: string[] };
  /** Must-not-confuse-with, by id. */
  distinctFrom?: string[];
  /** Approved GLB file name (as delivered by the user) — null until provided. */
  glb: string | null;
  /** Approved reference image file name — null until provided. */
  reference: string | null;
  status: VerificationStatus;
  notes?: string;
}

const U = 'UNVERIFIED' as const;

export const characters: CharacterRecord[] = [
  // ── Category B ──
  { id: 'pc_alana', name: 'Alana', category: 'starting_playable', role: 'Main player', location: 'Central island plaza',
    visual: { sex: 'female', hair: 'long dark-brown wavy hair in a high ponytail, white flower and gold braid beads (from her GLB)', eyes: 'amber', face: 'tan skin, gentle smile',
      clothing: ['white-and-blue cropped jacket with palm-tree logo', 'white sports crop top', 'denim shorts', 'blue, white and gold sneakers'], accessories: ['utility belt with pouches', 'thigh straps', 'blue pendant'] },
    distinctFrom: ['pc_rei'], glb: 'Meshy_AI_Tropical_Trailblazer_All_AnimationsALANA.glb', reference: 'docs/images/sheet_alana_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED',
    notes: 'Delivered 2026-10-26 (file name says ALANA). Her GLB is her primary reference: becomes VERIFIED when the user confirms the sheet. In game as the player since v0.5.0 (chr_alana_v001).' },
  // ── Category C ──
  { id: 'pc_elianny', name: 'Elianny', category: 'unlockable_playable', role: 'Unlockable (The Koala Magic Quest)', location: 'Chibi Ramen or nearby',
    visual: { sex: 'female', hair: 'voluminous afro-curly', clothing: ['fantasy magician outfit with koala-themed details'] }, distinctFrom: ['pc_alana'], glb: 'Meshy_AI_Koala_Crystal_Guardia_All_AnimationseLIANNY.glb', reference: 'docs/images/sheet_elianny_v001.png (confirmed by the user 2026-10-26, curly hair under the hood accepted)', status: 'VERIFIED',
    notes: 'GLB delivered 2026-10-26: koala hood with ears, pink/black/white magician coat with koala prints, crystal charms ✓; hair is voluminous curly ringlets gathered high under the hood (not a full round afro) — user to confirm.' },
  { id: 'pc_mia', name: 'Mía', category: 'unlockable_playable', role: "Unlockable (Mía's Island Challenge)", location: 'Community mission area',
    visual: { sex: 'female', hair: 'dark, wavy, voluminous', face: 'medium-brown complexion, soft features, gentle smile (per approved photo)', clothing: ['approved fantasy/game outfit (not the photo work clothing)'] },
    glb: 'Meshy_AI_Kuma_Streetwear_Masco_All_AnimationsMIA.glb', reference: 'docs/images/sheet_mia_v001.png (confirmed by the user 2026-10-26; photo comparison not performed — photo not provided)', status: 'VERIFIED',
    notes: 'GLB delivered 2026-10-26: dark wavy voluminous hair under a navy bandana ✓, medium-brown complexion ✓, neutral expression (smile not visible), streetwear with bear (kuma) mascots. Resemblance to the approved PHOTO cannot be checked: photo not provided.' },
  { id: 'pc_ej', name: 'E.J.', category: 'unlockable_playable', role: 'Unlockable (The Technology Challenge)', location: 'Technology center',
    visual: { sex: 'male', clothing: ['high-tech hoodie with technology details'], accessories: ['futuristic smart glasses', 'modern tech accessories'] }, glb: 'Meshy_AI_Neon_Pulse_Hacker_All_AnimationsEJ.glb', reference: 'docs/images/sheet_ej_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED',
    notes: 'GLB delivered 2026-10-26: male ✓, blue futuristic visor-glasses ✓, black/white tech jacket with glowing blue circuit details ✓, headphones and tech backpack ✓.' },
  { id: 'pc_shadow_fuel', name: 'Shadow Fuel', category: 'unlockable_playable', role: 'Special unlockable (The Shadow Trial)', location: 'Shadow challenge area',
    visual: { sex: 'male', hair: 'dark', clothing: ['dark clothing with prominent purple accents (black-and-purple identity)'] }, glb: 'Meshy_AI_Violet_Shadowblade_All_Animations.glb', reference: 'docs/images/sheet_violet_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED', notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/violet_shadowblade_v001.glb — male, black hair with white streak, purple eyes, black outfit with purple accents, katana on the back.'  },
  { id: 'pc_lily', name: 'Lily', category: 'unlockable_playable', role: "Special unlockable (Lily's Precision Trial)", location: 'Training challenge area',
    visual: { sex: 'female', clothing: ['white, black and gold outfit'] }, glb: 'Meshy_AI_Golden_Vanguard_All_AnimationsLILY.glb', reference: 'docs/images/sheet_lily_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED',
    notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/golden_vanguard_lily_v001.glb (file says LILY) — long blonde hair with black ribbon, amber eyes, white/black/gold outfit ✓, punch combos and dances. Not a generic blue-haired character: hairstyle, face and eyes per approved reference.' },
  { id: 'pc_rei', name: 'Rei', category: 'unlockable_playable', role: "Special unlockable (Rei's Shadow Challenge)", location: 'Martial-arts / shadow challenge area',
    visual: { sex: 'female', hair: 'long purple', eyes: 'large purple', clothing: ['black-and-purple jacket with gold details', 'white crop top', 'black skirt with purple and yellow accents', 'tall black-and-purple boots'], accessories: ['fingerless gloves'] },
    distinctFrom: ['pc_alana'], glb: 'Meshy_AI_Violet_Vanguard_All_Animations__2__1.glb', reference: 'docs/images/sheet_rei_v002.png (user: "yo te envié a Rei", 2026-10-26)', status: 'VERIFIED',
    notes: 'Restored 2026-10-26 as the unlockable Rei (assets/characters/rei/chr_rei_v002.glb, 12 clips). Matches every listed trait. Never the main player: that is Alana.' },
  // ── Category A ──
  { id: 'npc_haruto_nakamura', name: 'Haruto Nakamura', category: 'permanent_npc', role: 'Mechanic', location: 'Vehicle maintenance workshop',
    visual: { sex: 'male', hair: 'messy brown', eyes: 'amber', clothing: ['black-and-red mechanic jacket with wrench/gear logos and 中村 name patch', 'black cargo pants', 'red-and-white sneakers'], accessories: ['goggles on the head', 'tool belt', 'fingerless gloves', 'red bandana at the hip'] },
    glb: 'Meshy_AI_Redline_Mechanic_All_Animations.glb', reference: 'docs/images/sheet_redline_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED',
    notes: 'Game file: assets/characters/npc_haruto_nakamura/npc_haruto_nakamura_v001.glb. Not placed yet (needs the workshop and the NPC system).' },
  { id: 'npc_hana_mizuki', name: 'Hana Mizuki', category: 'permanent_npc', role: 'UNKNOWN (do not invent)', location: 'UNKNOWN', visual: {}, glb: null, reference: null, status: U, notes: 'POSSIBLE 2026-10-26: _pending/sakura_medic_v001.glb — female medic (white coat with cross, sakura flower). Her job is not defined: not bound.'  },
  { id: 'npc_03', name: 'UNKNOWN', category: 'permanent_npc', role: 'UNKNOWN', location: 'UNKNOWN', visual: {}, glb: null, reference: null, status: U,
    notes: 'Unassigned model delivered 2026-10-26: Meshy_AI_Crimson_Kitchen_Wande_All_Animations.glb — MALE chef (red bandana, beard, white chef coat, apron with 食). Matches no listed NPC (Mika Tanaka is female; Ren Takahashi is a barista). Waiting for the user.' },
  { id: 'npc_04', name: 'UNKNOWN', category: 'permanent_npc', role: 'UNKNOWN', location: 'UNKNOWN', visual: {}, glb: null, reference: null, status: U },
  { id: 'npc_ren_takahashi', name: 'Ren Takahashi', category: 'permanent_npc', role: 'Café manager', location: 'Chibi Island Café',
    visual: { sex: 'male', clothing: ['barista work clothing', 'café uniform and apron'] }, glb: 'Meshy_AI_Café_Ember_Barista_All_Animations.glb', reference: 'docs/images/sheet_cafe_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED', notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/cafe_ember_barista_v001.glb — male, white shirt, black apron with coffee emblem, red headband (36-bone rig, compatible).'  },
  { id: 'npc_yui_sakamoto', name: 'Yui Sakamoto', category: 'permanent_npc', role: 'Supermarket cashier', location: 'Chibi Mart',
    visual: { sex: 'female', clothing: ['supermarket uniform with Chibi Mart branding'] }, distinctFrom: ['npc_sora_akiyama'], glb: null, reference: null, status: U, notes: 'CANDIDATE WITH MISMATCH 2026-10-26: _pending/yui_bunny_barista_v001.glb — name tag "Yui" ✓ but a café/barista bunny apron, no Chibi Mart branding.'  },
  { id: 'npc_kaito_fujimoto', name: 'Kaito Fujimoto', category: 'permanent_npc', role: 'Baseball coach', location: 'Baseball stadium',
    visual: { sex: 'male', clothing: ['white, blue and orange baseball uniform with number 10'], accessories: ['baseball cap', 'baseball accessories'] }, glb: 'Meshy_AI_Chibi_All_Star_All_Animations.glb', reference: 'docs/images/sheet_allstar_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED', notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/chibi_all_star_v001.glb — male, cap with C, white/blue/orange uniform with 10 on the front (back shows another number), baseball_pitching clip.'  },
  { id: 'npc_mika_tanaka', name: 'Mika Tanaka', category: 'permanent_npc', role: 'Restaurant manager', location: 'Chibi Ramen',
    visual: { sex: 'female', clothing: ['restaurant work clothing'] }, glb: 'Meshy_AI_Ramen_Ribbon_Waitress_All_Animations.glb', reference: 'docs/images/sheet_ramen_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED', notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/ramen_ribbon_waitress_v001.glb — female, red ribbon, white shirt, red apron with ラーメン (ramen).'  },
  { id: 'npc_sora_akiyama', name: 'Sora Akiyama', category: 'permanent_npc', role: 'Delivery specialist', location: 'Chibi Delivery Station',
    visual: { sex: 'female', hair: 'brown, high messy ponytail', eyes: 'bright blue',
      clothing: ['blue-and-orange cropped jacket', 'white inner top', 'black shorts', 'white, blue and orange sneakers'],
      accessories: ['blue visor with CHIBI DELIVERY branding', 'utility belt and thigh accessories', 'fingerless gloves', 'large blue delivery backpack with cat logo'] },
    distinctFrom: ['npc_yui_sakamoto', 'npc_rina_fujimoto'], glb: 'Meshy_AI_Chibi_Delivery_Sora_All_Animations.glb', reference: 'docs/images/sheet_sora_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED',
    notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/chibi_delivery_sora_v001.glb — every listed trait matches (blue eyes, brown high ponytail, blue CHIBI DELIVERY visor, blue-orange crop jacket, white top, black shorts, utility belt, gloves, sneakers, blue backpack). Backpack may need to be a separate mesh for rigging (directive Phase 10).' },
  { id: 'npc_rina_fujimoto', name: 'Rina Fujimoto', category: 'permanent_npc', role: 'Tourist information guide (tutorial NPC)', location: 'Chibi Island Information Center',
    visual: { sex: 'female', hair: 'brown, high messy ponytail', eyes: 'amber-brown',
      clothing: ['white uniform shirt with green trim', 'green neck scarf', 'green utility skirt', 'white, green and orange sneakers'],
      accessories: ['green-and-white CHIBI ISLAND visor', 'green palm-tree hair accessory', 'RINA name badge', 'information-symbol accessories', 'fingerless gloves'] },
    distinctFrom: ['npc_sora_akiyama'], glb: 'Meshy_AI_Chibi_Island_Guide_All_Animations.glb', reference: 'docs/images/sheet_guide_v001.png (confirmed by the user 2026-10-26)', status: 'VERIFIED', notes: 'CONFIRMED 2026-10-26 (was candidate): _pending/chibi_island_guide_v001.glb — brown high ponytail, amber eyes, green-white CHIBI ISLAND visor, white shirt with green trim, green scarf, green skirt, sneakers ✓; palm-tree hair accessory not clearly visible.'  },
];

/** Trait pairs that tell look-alike characters apart (same hairstyle). Used when verifying their GLBs. */
export const LOOKALIKE_CHECKS: Array<{ a: string; b: string; tellApart: string[] }> = [
  { a: 'npc_sora_akiyama', b: 'npc_rina_fujimoto', tellApart: ['eyes: bright blue vs amber-brown', 'visor: blue CHIBI DELIVERY vs green-and-white CHIBI ISLAND', 'blue-orange jacket + black shorts vs white shirt + green skirt', 'cat-logo backpack vs RINA badge + palm-tree accessory'] },
  { a: 'pc_rei', b: 'pc_alana', tellApart: ['separate identities: Alana is identified only by her own approved GLB'] },
];

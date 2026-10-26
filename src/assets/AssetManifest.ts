export type AssetKind = 'gltf';

export interface AssetEntry {
  id: string;
  url: string;
  kind: AssetKind;
  /** Human label for the loading screen. */
  label: string;
  /** Expected real-world height in meters (validated after load). */
  expectedHeight?: number;
  required?: boolean;
}

/** Validates ids/urls before anything is fetched. Returns a list of problems (empty = OK). */
export function validateManifest(entries: AssetEntry[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of entries) {
    if (!/^[a-z0-9_]+$/.test(e.id)) problems.push(`id inválido: "${e.id}" (solo a-z, 0-9, _)`);
    if (ids.has(e.id)) problems.push(`id duplicado: "${e.id}"`);
    ids.add(e.id);
    if (!e.url) problems.push(`"${e.id}" no tiene url`);
    else if (e.kind === 'gltf' && !/\.glb(\?|#|$)/i.test(e.url) && !e.url.startsWith('data:')) problems.push(`"${e.id}" no apunta a un .glb: ${e.url}`);
    if (e.expectedHeight !== undefined && !(e.expectedHeight > 0)) problems.push(`"${e.id}" tiene una altura esperada no válida`);
  }
  return problems;
}

/** Phase 1 manifest. URLs go through Vite (fingerprinted in builds, inlined in the preview build). */
export const phase1Manifest: AssetEntry[] = [
  // Main player: Alana (Master Game System Prompt V1.0). Rei is now an unlockable character.
  { id: 'chr_alana', url: new URL('../../assets/characters/alana/chr_alana_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Alana', expectedHeight: 1.4, required: false },
  { id: 'env_villas', url: new URL('../../assets/environment/env_villas_v004.glb', import.meta.url).href, kind: 'gltf', label: 'Villas de Harbor Bay', required: false },
  { id: 'env_town', url: new URL('../../assets/environment/env_town_buildings_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Edificios de Chibi Town', required: false },
  { id: 'prop_lamp', url: new URL('../../assets/props/prop_streetlamp_a_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Farol', required: false },
  { id: 'prop_bench', url: new URL('../../assets/props/prop_bench_a_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Banco', required: false },
  { id: 'prop_board', url: new URL('../../assets/props/prop_noticeboard_a_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Tablón', required: false },
  { id: 'npc_rina', url: new URL('../../assets/characters/npc_rina_fujimoto/npc_rina_fujimoto_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Rina Fujimoto', expectedHeight: 1.4, required: false },
  { id: 'veg_palm', url: new URL('../../assets/vegetation/veg_palm_tall_a_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Palmera', required: false },
  { id: 'veg_sakura', url: new URL('../../assets/vegetation/veg_sakura_a_v001.glb', import.meta.url).href, kind: 'gltf', label: 'Sakura', required: false },
];

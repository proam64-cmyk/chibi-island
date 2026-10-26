/**
 * Where each permanent NPC works and walks (Step 5). Positions are derived from the workplace building so they
 * stay correct if the building moves. Only NPCs whose model is VERIFIED and whose workplace exists are placed.
 */
import { buildings } from '../config/buildings';
import { districts } from '../config/islandPlan';
import type { NpcBrainConfig } from './NpcBrain';

export interface NpcPlacement {
  characterId: string;          // id in config/characters.ts
  asset: string;                // manifest id
  building: string;             // buildings.ts id of the workplace
  dialogue: string;             // i18n prefix of the dialogue tree
  /** Metres in front of the building's centre (along its facing) for the work spot and patrol points. */
  workFront: number;
  patrol: Array<{ front: number; side: number }>;
}

export const NPC_PLACEMENTS: NpcPlacement[] = [
  // Rina Fujimoto — Tourist Information Center = the town hall with the clock tower (plaza, NW quadrant).
  { characterId: 'npc_rina_fujimoto', asset: 'npc_rina', building: 'town_hall', dialogue: 'npc.rina',
    workFront: 6.5, patrol: [{ front: 9.5, side: 4 }, { front: 12, side: 0 }, { front: 9.5, side: -4 }] },
];

/** World-space brain configuration for a placement (work spot faces away from the building, toward visitors). */
export function placementBrain(p: NpcPlacement): NpcBrainConfig {
  const b = buildings.find((q) => q.id === p.building)!;
  const d = districts.find((q) => q.id === b.district)!;
  const bx = d.x + b.dx, bz = d.z + b.dz;
  const facing = Math.atan2((b.faceX ?? d.x) - bx, (b.faceZ ?? d.z) - bz);
  const fx = Math.sin(facing), fz = Math.cos(facing), sx = fz, sz = -fx;
  const at = (front: number, side: number) => ({ x: bx + fx * front + sx * side, z: bz + fz * front + sz * side });
  return { work: { ...at(p.workFront, 0), heading: facing }, patrol: p.patrol.map((q) => at(q.front, q.side)), seed: p.characterId.length * 97 };
}

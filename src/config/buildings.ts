/**
 * Placed buildings (Phase 3 preview). Positions are offsets from a district center; each building turns
 * its front (+Z of the model) toward `faceX/faceZ` (default: the district center).
 * The four Harbor Bay villas come from the user's map (REF-04), generated in Meshy as one model (Remesh 80 k),
 * split by tools/split-kit.mjs into one GLB with four named meshes that share a single texture.
 */
export interface BuildingDef { id: string; asset: string; /** mesh/node name inside a kit GLB (several buildings sharing one texture) */ node?: string; district: string; dx: number; dz: number; faceX?: number; faceZ?: number; /** meters the model is lowered so its base plate is flush with the ground (default 0.12) */ baseSink?: number; /** clearance radius checked by the tests (default 6 m) */ footprint?: number }

/** Harbor Bay villas v004 (approved by the user 2026-10-25; house B texture repaired). */
export const buildings: BuildingDef[] = [
  { id: 'harbor_villa_a', asset: 'env_villas', node: 'villa_a', district: 'harbor', dx: 24, dz: -26 },
  { id: 'harbor_villa_b', asset: 'env_villas', node: 'villa_b', district: 'harbor', dx: 30, dz: 18 },
  { id: 'harbor_villa_c', asset: 'env_villas', node: 'villa_c', district: 'harbor', dx: -10, dz: 32 },
  { id: 'harbor_villa_d', asset: 'env_villas', node: 'villa_d', district: 'harbor', dx: -32, dz: 8 },
  // Chibi Town plaza (2026-10-25): four buildings from the user's map, one per quadrant between the roads, facing the plaza.
  { id: 'town_hall', asset: 'env_town', node: 'town_a', district: 'plaza', dx: -28.3, dz: -28.3, footprint: 7.5 },
  { id: 'town_apartments', asset: 'env_town', node: 'town_b', district: 'plaza', dx: -28.3, dz: 28.3, footprint: 9 },
  { id: 'town_domed_hall', asset: 'env_town', node: 'town_c', district: 'plaza', dx: 33.9, dz: -33.9, footprint: 12.5 },
  { id: 'town_villa', asset: 'env_town', node: 'town_d', district: 'plaza', dx: 28.3, dz: 28.3, footprint: 7.5 },
];

/**
 * Deterministic vegetation placement (no three.js, testable). Rules follow the official map:
 * palms on coasts and beaches, sakura around the town plateaus and Sky Terrace, dense round trees in
 * Lumi Forest, scattered trees and bushes on the green land; nothing on roads, building plateaus,
 * the volcano core, snow or water.
 */
import { districts } from '../../config/islandPlan';

export type VegType = 'palm' | 'sakura' | 'tree' | 'bush';
export interface VegInstance { x: number; y: number; z: number; rot: number; scale: number }
export interface ScatterInput {
  height: (x: number, z: number) => number;
  coast: (x: number, z: number) => number;
  road: (x: number, z: number) => number;   // road weight 0..1
  beach: (x: number, z: number) => number;  // 0..1
  sand?: (x: number, z: number, h: number) => number; // 0..1, keeps bushes and trees off the beach
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  density?: number;                          // 0..1 (quality profile)
  seed?: number;
}

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

import { VOLCANO_X, VOLCANO_Z } from '../island/islandHeight';
const VOLCANO = { x: VOLCANO_X, z: VOLCANO_Z };
const byId = (id: string) => districts.find((d) => d.id === id)!;
const inCore = (x: number, z: number, f = 0.8) => districts.some((d) => d.flatten === 1 && Math.hypot(x - d.x, z - d.z) < d.radius * f);
const ring = (id: string, x: number, z: number, a: number, b: number) => { const d = byId(id); const r = Math.hypot(x - d.x, z - d.z) / d.radius; return r >= a && r <= b; };

export function scatterVegetation(inp: ScatterInput): Record<VegType, VegInstance[]> {
  const rnd = mulberry32(inp.seed ?? 1234);
  const density = inp.density ?? 1;
  const out: Record<VegType, VegInstance[]> = { palm: [], sakura: [], tree: [], bush: [] };
  const slopeAt = (x: number, z: number) => Math.hypot(inp.height(x + 2, z) - inp.height(x - 2, z), inp.height(x, z + 2) - inp.height(x, z - 2)) / 4;
  const forest = byId('forest');
  const sand = (x: number, z: number, h: number) => inp.sand?.(x, z, h) ?? 0;

  const pass = (type: VegType, cell: number, accept: (x: number, z: number, h: number) => number, scale: [number, number]) => {
    for (let z = inp.bounds.minZ; z < inp.bounds.maxZ; z += cell) for (let x = inp.bounds.minX; x < inp.bounds.maxX; x += cell) {
      const px = x + rnd() * cell, pz = z + rnd() * cell, roll = rnd(), rot = rnd() * Math.PI * 2, sc = scale[0] + rnd() * (scale[1] - scale[0]);
      const c = inp.coast(px, pz);
      if (c < 2) continue;
      if (inp.road(px, pz) > 0.02) continue;
      const h = inp.height(px, pz);
      if (h < 0.8) continue;
      const p = accept(px, pz, h) * density;
      if (p <= 0 || roll > p) continue;
      out[type].push({ x: px, y: h, z: pz, rot, scale: sc });
    }
  };
  const volcanoDist = (x: number, z: number) => Math.hypot(x - VOLCANO.x, z - VOLCANO.z);

  pass('palm', 16, (x, z, h) => {
    const c = inp.coast(x, z);
    if (c > 90 || h > 20 || volcanoDist(x, z) < 330 || inCore(x, z, 0.5) || slopeAt(x, z) > 0.35) return 0;
    if (sand(x, z, h) > 0.85) return 0.12;                 // keep the open sand mostly clear (palms line its edge)
    return inp.beach(x, z) > 0.2 ? 0.45 : 0.15;
  }, [0.85, 1.15]);

  pass('sakura', 14, (x, z, h) => {
    if (h > 70 || inCore(x, z) || slopeAt(x, z) > 0.4) return 0;
    if (ring('plaza', x, z, 0.8, 1.45) || ring('lantern', x, z, 0.8, 1.5) || ring('izakaya', x, z, 0.8, 1.5) || ring('skyterrace', x, z, 0.8, 1.35)) return 0.4;
    return 0;
  }, [0.8, 1.2]);

  pass('tree', 9, (x, z, h) => {
    if (sand(x, z, h) > 0.3) return 0;
    if (h > 80 || volcanoDist(x, z) < 330 || inCore(x, z) || slopeAt(x, z) > 0.5) return 0;
    const inForest = Math.hypot(x - forest.x, z - forest.z) < forest.radius * 1.35;
    if (inForest) return 0.75;
    if (inp.coast(x, z) < 25 || h < 3) return 0;
    return 0.035;
  }, [0.8, 1.3]);

  pass('bush', 12, (x, z, h) => {
    if (sand(x, z, h) > 0.3) return 0;
    if (h > 75 || h < 1.5 || volcanoDist(x, z) < 250 || inCore(x, z, 0.85) || slopeAt(x, z) > 0.5) return 0;
    const inForest = Math.hypot(x - forest.x, z - forest.z) < forest.radius * 1.35;
    return inForest ? 0.6 : 0.3;
  }, [0.7, 1.4]);

  return out;
}

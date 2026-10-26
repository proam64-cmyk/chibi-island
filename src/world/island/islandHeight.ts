/**
 * Height of the official island (map approved 2026-10-24). Pure and deterministic: used by the terrain mesh,
 * the character controller and the camera, and unit-tested.
 * Coastline = signed distance field traced from the map; relief = Crystal Peak (N), Volcano Cliffs (W),
 * Sky Terrace (NE plateau), Lumi Forest hills (NW), flat district plateaus, gentle Sunset Beach.
 */
import { districts } from '../../config/islandPlan';
import { COAST_GRID, COAST_SDF_B64 } from './coastSdfData';
import { buildRoadRaster, sampleRoad, type RoadRaster } from '../roads/roadRaster';

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = fade(x - ix), fz = fade(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let o = 0; o < octaves; o++) { s += noise(x * f, z * f, seed + o * 31) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
export const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const gauss = (x: number, z: number, cx: number, cz: number, sigma: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * sigma * sigma));

// ── coastline distance field ──────────────────────────────────────────────
let sdf: Uint8Array | null = null;
/** Raw coast distance grid (uint8, value − 128 = meters), shared with the ocean shader. */
export function sdfData(): Uint8Array {
  if (sdf) return sdf;
  const bin = atob(COAST_SDF_B64);
  sdf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) sdf[i] = bin.charCodeAt(i);
  return sdf;
}
/** Meters to the coast: + on land, − at sea (bilinear, clamped to ±127; outside the map = open sea). */
export function coastDistance(x: number, z: number): number {
  const { cols, rows, cell, originX, originZ } = COAST_GRID;
  const gx = (x - originX) / cell - 0.5, gz = (z - originZ) / cell - 0.5;
  if (gx < 0 || gz < 0 || gx > cols - 1 || gz > rows - 1) return -128;
  const d = sdfData();
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const i1 = Math.min(i + 1, cols - 1), j1 = Math.min(j + 1, rows - 1);
  const v = (ii: number, jj: number) => d[jj * cols + ii] - 128;
  const top = v(i, j) + (v(i1, j) - v(i, j)) * fx, bot = v(i, j1) + (v(i1, j1) - v(i, j1)) * fx;
  return top + (bot - top) * fz;
}

export const SEA_FLOOR = -10;
/** Volcano Cliffs crater (moved inland on 2026-10-24 so the cone isn't sliced by the coast). */
export const VOLCANO_X = -1000, VOLCANO_Z = -215;

/** How beach-like the coast is at (x, z): 1 at Sunset Beach, 0 on the rocky coasts. */
export function beachiness(x: number, z: number): number {
  return Math.min(1, 1.2 * gauss(x, z, -560, 330, 210) + 0.6 * gauss(x, z, 520, 60, 110) + 0.5 * gauss(x, z, -150, 520, 140));
}

/**
 * How sandy the ground is (0..1): a strip along the shore that widens a lot at Sunset Beach and is
 * limited to low ground (cliffs stay rocky/green). Shared by terrain colors and vegetation rules.
 */
export function sandAmount(x: number, z: number, h: number): number {
  const b = beachiness(x, z);
  const band = 1 - smoothstep(8 + 70 * b, 22 + 90 * b, coastDistance(x, z));
  return band * (1 - smoothstep(3.5, 7, h));
}

/** 0 = open sea … 1 = inland (kept for coloring and for the old API). */
export function landMask(x: number, z: number): number {
  return smoothstep(-20, 30, coastDistance(x, z));
}

/** Natural terrain before roads are cut into it. */
export function baseIslandHeight(x: number, z: number): number {
  let h = 6 + (fbm(x / 280, z / 280, 3) - 0.45) * 14 + (fbm(x / 70, z / 70, 9) - 0.5) * 4;
  h += 4 * gauss(x, z, 0, -60, 260);                                   // town rises gently to the north
  h += 225 * gauss(x, z, -47, -688, 165);                              // Crystal Peak
  h += 85 * gauss(x, z, -320, -560, 140) + 70 * gauss(x, z, 200, -600, 130); // shoulders of the massif
  h += 48 * gauss(x, z, 670, -300, 230);                               // Sky Terrace highland
  h += 14 * gauss(x, z, -609, -336, 240);                              // Lumi Forest hills
  // Volcano Cliffs: the cone shrinks toward the sea (steep cliffs, not a vertical wall) and has a real crater.
  const rv = Math.hypot(x - VOLCANO_X, z - VOLCANO_Z);
  const coastFade = smoothstep(-10, 110, coastDistance(x, z));
  h += 135 * (1 - smoothstep(0, 290, rv)) * coastFade - 60 * gauss(x, z, VOLCANO_X, VOLCANO_Z, 40);

  for (const d of districts) {
    if (d.flatten <= 0) continue;
    const dist = Math.hypot(x - d.x, z - d.z);
    const w = (1 - smoothstep(d.radius * 0.7, d.radius * 1.35, dist)) * d.flatten;
    if (w > 0) h += (d.elevation - h) * w;
  }

  // Coast: gentle sand slopes on beaches, steeper rocky edges elsewhere.
  const c = coastDistance(x, z), b = beachiness(x, z);
  const blend = smoothstep(-28 - 50 * b, 8 + 70 * b, c);
  h = SEA_FLOOR + (h - SEA_FLOOR) * blend;
  if (c < 0) h = Math.min(h, -0.5 + c * 0.25);                          // anything past the coastline is under water
  return h;
}

let raster: RoadRaster | null = null;
/** Road raster, built on first use from the natural terrain. */
export function roadRaster(): RoadRaster { return (raster ??= buildRoadRaster(baseIslandHeight)); }

/** Terrain height with the roads cut in (what the mesh shows and what Rei walks on, bridges excluded). */
export function islandHeight(x: number, z: number): number {
  const h = baseIslandHeight(x, z);
  const r = sampleRoad(roadRaster(), x, z);
  return r.weight > 0 ? h + (r.elev - h) * r.weight : h;
}

/** Walkable ground: terrain, or a bridge deck where one passes overhead. */
export function groundHeight(x: number, z: number): number {
  const h = islandHeight(x, z);
  const r = sampleRoad(roadRaster(), x, z);
  const g = r.bridge ? Math.max(h, r.elev) : h;
  return g;
}

/** District whose zone contains (x, z), nearest first, or null. */
export function districtAt(x: number, z: number): (typeof districts)[number] | null {
  let best: (typeof districts)[number] | null = null, bestD = Infinity;
  for (const d of districts) {
    const dist = Math.hypot(x - d.x, z - d.z);
    if (dist <= d.radius * 1.2 && dist < bestD) { best = d; bestD = dist; }
  }
  return best;
}


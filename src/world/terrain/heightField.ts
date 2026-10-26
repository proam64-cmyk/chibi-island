/**
 * Deterministic height function for the Phase 1 test terrain (512 × 512 m).
 * Pure math, no three.js: used by the mesh, the character controller and the camera,
 * and unit-tested. Phase 2 replaces it with the real island heightmap behind the same signature.
 */
export const TEST_TERRAIN_SIZE = 512;

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz; // 0..1
}

function fbm(x: number, z: number, seed: number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += valueNoise(x * freq, z * freq, seed + o * 17) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm; // 0..1
}

export const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Height in meters at world (x, z). Sea level is 0. */
export function testTerrainHeight(x: number, z: number, seed = 7): number {
  const half = TEST_TERRAIN_SIZE / 2;
  const hills = (fbm(x / 70, z / 70, seed) - 0.35) * 14;          // gentle rolling hills
  const r = Math.hypot(x, z) / half;                                  // 0 center → 1 edge
  const land = 3 + Math.max(hills, -1.5);
  const shore = smoothstep(0.62, 0.92, r);                            // beach ring, then sea floor
  let h = land * (1 - shore) + (-4) * shore;
  const plaza = 1 - smoothstep(14, 28, Math.hypot(x, z));             // flat spawn area
  h = h * (1 - plaza) + 3 * plaza;
  return h;
}

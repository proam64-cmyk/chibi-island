/**
 * Road layout baked into a 2 m raster (no three.js, testable in Node):
 *  - each road is a Catmull-Rom curve through its waypoints, sampled every 2 m;
 *  - its elevation profile follows the natural terrain, smoothed and grade-limited (MAX_ROAD_GRADE);
 *  - where the natural ground is under water the road becomes a bridge with a straight deck;
 *  - the raster stores, per cell, the road elevation and a blend weight used to cut the terrain to the road.
 */
import { MAX_ROAD_GRADE, roads, type RoadDef } from '../../config/roads';
import { districts, islandBounds } from '../../config/islandPlan';

export const ROAD_CELL = 2;
export const ROAD_SHOULDER = 9; // meters beyond the road edge where the terrain blends back to natural

export interface RoadSample { x: number; z: number; elev: number; bridge: boolean; tx: number; tz: number; natural: number }
export interface RoadPath { def: RoadDef; samples: RoadSample[]; length: number }

export function catmullRom(points: Array<[number, number]>, step: number): Array<[number, number]> {
  const P = [points[0], ...points, points[points.length - 1]];
  const out: Array<[number, number]> = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(segLen / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function buildRoadPath(def: RoadDef, baseHeight: (x: number, z: number) => number, step = 2): RoadPath {
  const pts = catmullRom(def.points, step);
  const n = pts.length;
  const natural = pts.map(([x, z]) => baseHeight(x, z));
  const wet = natural.map((h) => h < 0.6);
  // Inside flat district plateaus the road keeps the plateau height (no smoothing), so towns stay level.
  const pinned = pts.map(([x, z]) => districts.some((d) => d.flatten === 1 && Math.hypot(x - d.x, z - d.z) < d.radius * 0.75));
  const dist = [0];
  for (let i = 1; i < n; i++) dist.push(dist[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  // 1. smooth the natural profile (±30 m window) on land
  const elev = natural.map((_, i) => {
    if (pinned[i]) return natural[i];
    let s = 0, w = 0;
    for (let k = i; k >= 0 && dist[i] - dist[k] <= 30; k--) if (!wet[k]) { s += natural[k]; w++; }
    for (let k = i + 1; k < n && dist[k] - dist[i] <= 30; k++) if (!wet[k]) { s += natural[k]; w++; }
    return w ? s / w : natural[i];
  });
  // 2. bridges: straight deck between the land on both sides, at least 3.5 m above the sea
  for (let i = 0; i < n; i++) if (wet[i]) {
    let a = i; while (a > 0 && wet[a - 1]) a--;
    let b = i; while (b < n - 1 && wet[b + 1]) b++;
    const ea = a > 0 ? elev[a - 1] : 3.5, eb = b < n - 1 ? elev[b + 1] : 3.5;
    const da = a > 0 ? dist[a - 1] : dist[a], db = b < n - 1 ? dist[b + 1] : dist[b];
    for (let k = a; k <= b; k++) elev[k] = Math.max(3.5, ea + ((eb - ea) * (dist[k] - da)) / Math.max(1, db - da));
    i = b;
  }
  // 3. limit the grade (forward then backward pass)
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < n; i++) { if (pinned[i]) continue; const max = (dist[i] - dist[i - 1]) * MAX_ROAD_GRADE; elev[i] = Math.min(elev[i - 1] + max, Math.max(elev[i - 1] - max, elev[i])); }
    for (let i = n - 2; i >= 0; i--) { if (pinned[i]) continue; const max = (dist[i + 1] - dist[i]) * MAX_ROAD_GRADE; elev[i] = Math.min(elev[i + 1] + max, Math.max(elev[i + 1] - max, elev[i])); }
  }
  const samples: RoadSample[] = pts.map(([x, z], i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x, z, elev: elev[i], bridge: wet[i], tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len, natural: natural[i] };
  });
  return { def, samples, length: dist[n - 1] };
}

export interface RoadRaster {
  cols: number; rows: number; originX: number; originZ: number;
  /** road surface elevation (m) */ elev: Float32Array;
  /** 0 = no road influence … 1 = on the road (terrain fully cut to `elev`) */ weight: Float32Array;
  /** 1 where the road is a bridge deck (terrain left untouched underneath) */ bridge: Uint8Array;
  paths: RoadPath[];
}

export function buildRoadRaster(baseHeight: (x: number, z: number) => number): RoadRaster {
  const originX = islandBounds.minX, originZ = islandBounds.minZ;
  const cols = Math.ceil((islandBounds.maxX - islandBounds.minX) / ROAD_CELL), rows = Math.ceil((islandBounds.maxZ - islandBounds.minZ) / ROAD_CELL);
  const elev = new Float32Array(cols * rows), weight = new Float32Array(cols * rows), bridge = new Uint8Array(cols * rows);
  const best = new Float32Array(cols * rows).fill(Infinity);
  const paths = roads.map((r) => buildRoadPath(r, baseHeight));
  for (const p of paths) {
    const half = p.def.width / 2;
    for (const s of p.samples) {
      // Deep cuts or fills get wider shoulders so the embankment is never steeper than ~1 : 1.5.
      const reach = half + Math.min(40, Math.max(ROAD_SHOULDER, 1.5 * Math.abs(s.natural - s.elev)));
      const rc = Math.ceil(reach / ROAD_CELL);
      const ci = Math.floor((s.x - originX) / ROAD_CELL), cj = Math.floor((s.z - originZ) / ROAD_CELL);
      for (let j = cj - rc; j <= cj + rc; j++) for (let i = ci - rc; i <= ci + rc; i++) {
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const cx = originX + (i + 0.5) * ROAD_CELL, cz = originZ + (j + 0.5) * ROAD_CELL;
        const d = Math.hypot(cx - s.x, cz - s.z);
        if (d > reach) continue;
        const k = j * cols + i;
        if (s.bridge) { if (d <= half + 0.5 && d < best[k]) { best[k] = d; elev[k] = s.elev; bridge[k] = 1; weight[k] = 0; } continue; }
        const w = d <= half + 1 ? 1 : 1 - (d - half - 1) / (reach - half - 1);
        const ws = w * w * (3 - 2 * w);
        if (d < best[k]) { best[k] = d; elev[k] = s.elev; bridge[k] = 0; }
        if (ws > weight[k]) weight[k] = ws;
      }
    }
  }
  return { cols, rows, originX, originZ, elev, weight, bridge, paths };
}

/** Bilinear lookup of the road raster; returns weight 0 outside. */
export function sampleRoad(r: RoadRaster, x: number, z: number): { elev: number; weight: number; bridge: boolean } {
  const gx = (x - r.originX) / ROAD_CELL - 0.5, gz = (z - r.originZ) / ROAD_CELL - 0.5;
  const i = Math.floor(gx), j = Math.floor(gz);
  if (i < 0 || j < 0 || i >= r.cols - 1 || j >= r.rows - 1) return { elev: 0, weight: 0, bridge: false };
  const fx = gx - i, fz = gz - j;
  const k00 = j * r.cols + i, k10 = k00 + 1, k01 = k00 + r.cols, k11 = k01 + 1;
  const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
  const weight = r.weight[k00] * w00 + r.weight[k10] * w10 + r.weight[k01] * w01 + r.weight[k11] * w11;
  // elevation: weighted by cells that actually carry a road value
  let es = 0, ew = 0;
  for (const [k, w] of [[k00, w00], [k10, w10], [k01, w01], [k11, w11]] as const) if (r.weight[k] > 0 || r.bridge[k]) { es += r.elev[k] * w; ew += w; }
  const bridge = (r.bridge[k00] | r.bridge[k10] | r.bridge[k01] | r.bridge[k11]) === 1;
  return { elev: ew > 0 ? es / ew : 0, weight, bridge };
}

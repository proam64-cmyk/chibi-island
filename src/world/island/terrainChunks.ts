/**
 * Chunked terrain data (no three.js here, so it can be tested in Node).
 * Each chunk samples the height function once on a grid with a 1-cell apron (for seamless normals);
 * lower LODs reuse that grid by skipping samples. Skirts hide LOD cracks between chunks.
 */
export type HeightFn = (x: number, z: number) => number;
export type ColorFn = (x: number, z: number, h: number, slope: number) => [number, number, number];

export interface ChunkSample {
  cx: number; cz: number; size: number; n: number;
  /** (n+3)² heights including a 1-sample apron on every side */
  heights: Float32Array;
  minH: number; maxH: number;
  /** Full-resolution vertex colors, computed once and reused by every LOD. */
  colors?: Float32Array;
}

export interface LevelData {
  positions: Float32Array; normals: Float32Array; colors: Float32Array; indices: Uint32Array;
}

export function sampleChunk(cx: number, cz: number, size: number, n: number, heightAt: HeightFn): ChunkSample {
  const s = n + 3, cell = size / n, x0 = cx - size / 2 - cell, z0 = cz - size / 2 - cell;
  const heights = new Float32Array(s * s);
  let minH = Infinity, maxH = -Infinity;
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const h = heightAt(x0 + i * cell, z0 + j * cell);
    heights[j * s + i] = h;
    if (i > 0 && j > 0 && i < s - 1 && j < s - 1) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  }
  return { cx, cz, size, n, heights, minH, maxH };
}

/** Builds one LOD level. `step` = 1, 2, 4, 8… (must divide n). `skirt` = depth of the edge skirt in meters. */
export function buildLevel(c: ChunkSample, step: number, colorAt: ColorFn, skirt = 4): LevelData {
  if (c.n % step !== 0) throw new Error(`step ${step} must divide ${c.n}`);
  const s = c.n + 3, cell = c.size / c.n, m = c.n / step + 1;
  const H = (i: number, j: number) => c.heights[(j + 1) * s + (i + 1)]; // i,j in 0..n (apron is −1 and n+1)
  const ringCount = 4 * (m - 1);
  const vCount = m * m + ringCount;
  const positions = new Float32Array(vCount * 3), normals = new Float32Array(vCount * 3), colors = new Float32Array(vCount * 3);
  const x0 = c.cx - c.size / 2, z0 = c.cz - c.size / 2;
  const full = c.n + 1;
  if (!c.colors) {
    c.colors = new Float32Array(full * full * 3);
    for (let j = 0; j <= c.n; j++) for (let i = 0; i <= c.n; i++) {
      const nx = H(i - 1, j) - H(i + 1, j), nz = H(i, j - 1) - H(i, j + 1), ny = 2 * cell;
      c.colors.set(colorAt(x0 + i * cell, z0 + j * cell, H(i, j), 1 - ny / Math.hypot(nx, ny, nz)), (j * full + i) * 3);
    }
  }
  for (let gj = 0; gj < m; gj++) for (let gi = 0; gi < m; gi++) {
    const i = gi * step, j = gj * step, v = gj * m + gi;
    const x = x0 + i * cell, z = z0 + j * cell, h = H(i, j);
    // Central differences on the full-resolution grid → identical normals on shared chunk edges.
    let nx = H(i - 1, j) - H(i + 1, j), nz = H(i, j - 1) - H(i, j + 1);
    const ny = 2 * cell, len = Math.hypot(nx, ny, nz);
    nx /= len; nz /= len;
    positions.set([x, h, z], v * 3);
    normals.set([nx, ny / len, nz], v * 3);
    colors.set(c.colors.subarray((j * full + i) * 3, (j * full + i) * 3 + 3), v * 3);
  }
  // Skirt ring: copies of the border vertices pushed down.
  const ring: number[] = [];
  for (let gi = 0; gi < m - 1; gi++) ring.push(gi);                       // north edge →
  for (let gj = 0; gj < m - 1; gj++) ring.push(gj * m + (m - 1));         // east edge ↓
  for (let gi = m - 1; gi > 0; gi--) ring.push((m - 1) * m + gi);         // south edge ←
  for (let gj = m - 1; gj > 0; gj--) ring.push(gj * m);                   // west edge ↑
  ring.forEach((src, k) => {
    const v = m * m + k;
    positions.set([positions[src * 3], positions[src * 3 + 1] - skirt, positions[src * 3 + 2]], v * 3);
    normals.set(normals.subarray(src * 3, src * 3 + 3), v * 3);
    colors.set(colors.subarray(src * 3, src * 3 + 3), v * 3);
  });
  const idx: number[] = [];
  for (let gj = 0; gj < m - 1; gj++) for (let gi = 0; gi < m - 1; gi++) {
    const a = gj * m + gi, b = a + 1, d = a + m, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  for (let k = 0; k < ringCount; k++) {
    const top0 = ring[k], top1 = ring[(k + 1) % ringCount], bot0 = m * m + k, bot1 = m * m + ((k + 1) % ringCount);
    idx.push(top0, top1, bot0, top1, bot1, bot0, top0, bot0, top1, top1, bot0, bot1); // both windings (skirt seen from either side)
  }
  return { positions, normals, colors, indices: new Uint32Array(idx) };
}

export function chunkCenters(minX: number, maxX: number, minZ: number, maxZ: number, size: number): Array<{ cx: number; cz: number }> {
  const out: Array<{ cx: number; cz: number }> = [];
  for (let z = minZ; z < maxZ; z += size) for (let x = minX; x < maxX; x += size) out.push({ cx: x + size / 2, cz: z + size / 2 });
  return out;
}

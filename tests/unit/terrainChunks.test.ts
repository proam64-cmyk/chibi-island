import { describe, expect, it } from 'vitest';
import { buildLevel, chunkCenters, sampleChunk } from '../../src/world/island/terrainChunks';
import { islandHeight } from '../../src/world/island/islandHeight';

const flatColor = () => [1, 1, 1] as [number, number, number];

describe('terrain chunks', () => {
  it('covers the bounds with whole chunks', () => {
    expect(chunkCenters(-1000, 1000, -1000, 800, 200).length).toBe(10 * 9);
  });
  it('builds every LOD with the right vertex count, skirt and in-range indices', () => {
    const c = sampleChunk(100, -100, 200, 64, islandHeight);
    for (const step of [1, 2, 4, 8]) {
      const m = 64 / step + 1;
      const d = buildLevel(c, step, flatColor);
      expect(d.positions.length / 3).toBe(m * m + 4 * (m - 1));
      expect(d.indices.length).toBe((m - 1) * (m - 1) * 6 + 4 * (m - 1) * 12);
      expect(Math.max(...d.indices)).toBeLessThan(d.positions.length / 3);
    }
  });
  it('shares identical edge heights and normals between neighbouring chunks (no seams)', () => {
    const a = buildLevel(sampleChunk(100, 100, 200, 32, islandHeight), 1, flatColor);
    const b = buildLevel(sampleChunk(300, 100, 200, 32, islandHeight), 1, flatColor);
    const m = 33;
    for (let j = 0; j < m; j++) {
      const ea = (j * m + (m - 1)) * 3, eb = (j * m) * 3; // east edge of a == west edge of b
      expect(a.positions[ea]).toBeCloseTo(b.positions[eb], 4);
      expect(a.positions[ea + 1]).toBeCloseTo(b.positions[eb + 1], 4);
      expect(a.normals[ea + 1]).toBeCloseTo(b.normals[eb + 1], 5);
    }
  });
  it('rejects LOD steps that do not divide the grid', () => {
    expect(() => buildLevel(sampleChunk(0, 0, 200, 64, islandHeight), 3, flatColor)).toThrow();
  });
});

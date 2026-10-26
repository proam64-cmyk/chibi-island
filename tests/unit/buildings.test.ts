import { describe, expect, it } from 'vitest';
import { buildings } from '../../src/config/buildings';
import { districts } from '../../src/config/islandPlan';
import { coastDistance, islandHeight, roadRaster } from '../../src/world/island/islandHeight';
import { sampleRoad } from '../../src/world/roads/roadRaster';

describe('placed buildings', () => {
  const r = roadRaster();
  for (const b of buildings) {
    const d = districts.find((q) => q.id === b.district)!;
    const x = d.x + b.dx, z = d.z + b.dz;
    it(`${b.id}: on land, off the roads, on flat ground (±0.4 m over its footprint)`, () => {
      expect(coastDistance(x, z)).toBeGreaterThan(8);
      const h0 = islandHeight(x, z), rad = b.footprint ?? 6;
      for (let k = 0; k < 16; k++) for (const f of [0.5, 1]) {
        const px = x + Math.cos(k * Math.PI / 8) * rad * f, pz = z + Math.sin(k * Math.PI / 8) * rad * f;
        expect(sampleRoad(r, px, pz).weight, `road at ${px.toFixed(0)},${pz.toFixed(0)}`).toBeLessThan(0.05);
        expect(Math.abs(islandHeight(px, pz) - h0)).toBeLessThan(0.4);
      }
    });
  }
  it('buildings do not overlap each other (footprints + 3 m)', () => {
    const pos = buildings.map((b) => { const d = districts.find((q) => q.id === b.district)!; return [d.x + b.dx, d.z + b.dz, b.footprint ?? 6]; });
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) expect(Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])).toBeGreaterThan(pos[i][2] + pos[j][2] + 3);
  });
});

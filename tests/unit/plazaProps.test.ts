import { describe, expect, it } from 'vitest';
import { lampSpots, PLAZA_SPOTS } from '../../src/world/props/PlazaProps';
import { islandHeight, roadRaster } from '../../src/world/island/islandHeight';
import { sampleRoad } from '../../src/world/roads/roadRaster';
import { buildings } from '../../src/config/buildings';
import { districts } from '../../src/config/islandPlan';

describe('plaza props (Hito A)', () => {
  const r = roadRaster();
  const bpos = buildings.map((b) => { const d = districts.find((q) => q.id === b.district)!; return { x: d.x + b.dx, z: d.z + b.dz, r: b.footprint ?? 6 }; });
  it('bench and noticeboard stand off the road, on flat ground, away from buildings', () => {
    for (const { x, z } of Object.values(PLAZA_SPOTS)) {
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos(a * Math.PI / 4) * 1.5, pz = z + Math.sin(a * Math.PI / 4) * 1.5;
        expect(sampleRoad(r, px, pz).weight).toBeLessThan(0.05);
        expect(Math.abs(islandHeight(px, pz) - islandHeight(x, z))).toBeLessThan(0.15);
      }
      for (const b of bpos) expect(Math.hypot(b.x - x, b.z - z)).toBeGreaterThan(b.r + 3);
    }
  });
  it('street lamps line the roads near the plaza, beside the carriageway and never inside buildings', () => {
    const lamps = lampSpots();
    expect(lamps.length).toBeGreaterThanOrEqual(8);
    for (const l of lamps) {
      const centre = Math.min(...r.paths.flatMap((p) => p.samples.map((s) => Math.hypot(s.x - l.x, s.z - l.z))));
      expect(centre).toBeGreaterThan(3.4);          // not on the asphalt (half width 3.5 m, lamp 1.4 m outside)
      for (const b of bpos) expect(Math.hypot(b.x - l.x, b.z - l.z)).toBeGreaterThan(b.r + 1.5);
    }
  });
});

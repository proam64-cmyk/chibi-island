import { describe, expect, it } from 'vitest';
import { MAX_ROAD_GRADE, roads } from '../../src/config/roads';
import { districts } from '../../src/config/islandPlan';
import { baseIslandHeight, groundHeight, islandHeight, roadRaster } from '../../src/world/island/islandHeight';

describe('road network', () => {
  const r = roadRaster();
  it('builds one path per road with samples every ~2 m', () => {
    expect(r.paths.length).toBe(roads.length);
    for (const p of r.paths) expect(p.length / p.samples.length).toBeLessThan(2.6);
  });
  it('no road is steeper than the maximum grade (+1 % tolerance) outside the town plateaus', () => {
    const inCore = (x: number, z: number) => districts.some((d) => d.flatten === 1 && Math.hypot(x - d.x, z - d.z) < d.radius * 0.75);
    for (const p of r.paths) {
      let worst = 0;
      for (let i = 1; i < p.samples.length; i++) {
        const a = p.samples[i - 1], b = p.samples[i];
        if (inCore(a.x, a.z) || inCore(b.x, b.z)) continue; // plateaus keep their own gentle ramps
        worst = Math.max(worst, Math.abs(b.elev - a.elev) / Math.max(0.5, Math.hypot(b.x - a.x, b.z - a.z)));
      }
      expect(worst, p.def.id).toBeLessThanOrEqual(MAX_ROAD_GRADE + 0.01);
    }
  });
  it('the terrain is cut to the road: ground at the centerline ≈ road elevation (land sections)', () => {
    for (const p of r.paths) for (let i = 0; i < p.samples.length; i += 25) {
      const s = p.samples[i];
      if (s.bridge) continue;
      expect(Math.abs(islandHeight(s.x, s.z) - s.elev), `${p.def.id} #${i}`).toBeLessThan(0.35);
    }
  });
  it('the harbor road crosses the inlet on a bridge that Rei can walk on, above the sea', () => {
    const p = r.paths.find((q) => q.def.id === 'harbor')!;
    const bridge = p.samples.filter((s) => s.bridge);
    expect(bridge.length).toBeGreaterThan(5);
    for (const s of bridge) {
      expect(baseIslandHeight(s.x, s.z)).toBeLessThan(0.6);
      expect(groundHeight(s.x, s.z)).toBeGreaterThan(3);
    }
  });
  it('the Winter Atelier road climbs from Chibi Town to the plateau', () => {
    const p = r.paths.find((q) => q.def.id === 'winter')!;
    const end = p.samples[p.samples.length - 1];
    const winter = districts.find((d) => d.id === 'winter')!;
    expect(end.elev).toBeGreaterThan(winter.elevation - 6);
    expect(p.samples[0].elev).toBeLessThan(10);
  });
});

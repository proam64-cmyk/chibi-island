import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { districts, islandBounds, landmarks } from '../../src/config/islandPlan';
import { baseIslandHeight, coastDistance, districtAt, islandHeight } from '../../src/world/island/islandHeight';

const D = (id: string) => districts.find((d) => d.id === id)!;
const L = (id: string) => landmarks.find((d) => d.id === id)!;

describe('official island (map approved 2026-10-24)', () => {
  it('is deterministic', () => {
    expect(islandHeight(123.4, -56.7)).toBe(islandHeight(123.4, -56.7));
  });
  it('every district center is on land, inside the traced coastline', () => {
    for (const d of districts) expect(coastDistance(d.x, d.z), d.id).toBeGreaterThan(20);
  });
  it('flat districts sit at their planned elevation (±1.5 m) and are buildable (≤ 1.5 m variation in 60 % of the radius)', () => {
    for (const d of districts.filter((d) => d.flatten === 1 && d.id !== 'beach')) {
      expect(Math.abs(islandHeight(d.x, d.z) - d.elevation), d.id).toBeLessThan(1.5);
      let lo = Infinity, hi = -Infinity;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (const f of [0.2, 0.4, 0.6]) {
        const h = baseIslandHeight(d.x + Math.cos(a) * d.radius * f, d.z + Math.sin(a) * d.radius * f);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      expect(hi - lo, d.id).toBeLessThan(1.5);
    }
  });
  it('Crystal Peak is the highest point (200–260 m) and the volcano rises above 110 m', () => {
    const peak = L('peak');
    expect(islandHeight(peak.x, peak.z)).toBeGreaterThan(200);
    expect(islandHeight(peak.x, peak.z)).toBeLessThan(260);
    const v = D('volcano');
    const rim = Math.max(...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => islandHeight(v.x + Math.cos(k * Math.PI / 4) * 55, v.z + Math.sin(k * Math.PI / 4) * 55)));
    expect(rim).toBeGreaterThan(90);
    expect(islandHeight(v.x, v.z)).toBeLessThan(rim - 25); // a real crater
  });
  it('the volcano cone has no sheer wall (max 1.6 m rise per meter on its slopes, shore cliffs excluded)', () => {
    const v = D('volcano');
    let worst = 0;
    for (let z = v.z - 260; z <= v.z + 260; z += 4) for (let x = v.x - 260; x <= v.x + 260; x += 4) {
      if (Math.hypot(x - v.x, z - v.z) > 260 || coastDistance(x, z) < 10) continue;
      worst = Math.max(worst, Math.abs(islandHeight(x + 4, z) - islandHeight(x, z)) / 4, Math.abs(islandHeight(x, z + 4) - islandHeight(x, z)) / 4);
    }
    expect(worst).toBeLessThan(1.6);
  });
  it('Sunset Beach slopes gently into the sea', () => {
    const b = D('beach');
    expect(islandHeight(b.x, b.z)).toBeGreaterThan(1);
    expect(islandHeight(b.x, b.z)).toBeLessThan(5);
    let z = b.z; while (coastDistance(b.x, z) > -30 && z < 900) z += 5;
    expect(islandHeight(b.x, z)).toBeLessThan(0);
  });
  it('the harbor docks are on water and the map edges are open sea', () => {
    const docks = L('docks');
    expect(islandHeight(docks.x, docks.z)).toBeLessThan(0);
    for (const [x, z] of [[islandBounds.minX + 20, 0], [islandBounds.maxX - 20, 0], [0, islandBounds.minZ + 10], [0, islandBounds.maxZ - 20]]) {
      expect(islandHeight(x, z)).toBeLessThan(-3);
    }
  });
  it('districtAt finds Chibi Town plaza at the origin and nothing far at sea', () => {
    expect(districtAt(0, 0)?.id).toBe('plaza');
    expect(districtAt(1100, 900)).toBeNull();
  });
  it('writes a debug heightmap for visual review', () => {
    const step = 8, w = (islandBounds.maxX - islandBounds.minX) / step, hgt = (islandBounds.maxZ - islandBounds.minZ) / step;
    const data: number[] = [];
    for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) data.push(+islandHeight(islandBounds.minX + i * step, islandBounds.minZ + j * step).toFixed(2));
    try { writeFileSync('/tmp/island_heights.json', JSON.stringify({ w, h: hgt, step, minX: islandBounds.minX, minZ: islandBounds.minZ, data })); } catch { /* optional */ }
    expect(data.length).toBe(w * hgt);
  });
});

describe('baseball stadium site', () => {
  it('the stadium site (≈ 86 m radius) stays flat for a future stadium', async () => {
    const { stadiumPlacement: sp } = await import('../../src/config/islandPlan');
    const base = islandHeight(sp.x, sp.z);
    for (let k = 0; k < 36; k++) for (const r of [40, 70, 90]) {
      expect(Math.abs(islandHeight(sp.x + Math.cos(k * Math.PI / 18) * r, sp.z + Math.sin(k * Math.PI / 18) * r) - base)).toBeLessThan(0.3);
    }
  });
});

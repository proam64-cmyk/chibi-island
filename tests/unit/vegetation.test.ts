import { describe, expect, it } from 'vitest';
import { districts, islandBounds } from '../../src/config/islandPlan';
import { beachiness, coastDistance, islandHeight, roadRaster, sandAmount } from '../../src/world/island/islandHeight';
import { sampleRoad } from '../../src/world/roads/roadRaster';
import { scatterVegetation } from '../../src/world/vegetation/scatter';
import { createBush, createRoundTree } from '../../src/world/vegetation/proceduralFoliage';

const r = roadRaster();
const input = { height: islandHeight, coast: coastDistance, beach: beachiness, sand: sandAmount, road: (x: number, z: number) => { const s = sampleRoad(r, x, z); return s.bridge ? 1 : s.weight; }, bounds: islandBounds };
const veg = scatterVegetation(input);
const all = Object.values(veg).flat();

describe('vegetation scatter', () => {
  it('is deterministic', () => {
    const again = scatterVegetation(input);
    expect(again.palm.length).toBe(veg.palm.length);
    expect(again.tree[10]).toEqual(veg.tree[10]);
  });
  it('places a sensible amount of each type', () => {
    expect(veg.palm.length).toBeGreaterThan(80);
    expect(veg.sakura.length).toBeGreaterThan(40);
    expect(veg.tree.length).toBeGreaterThan(300);
    expect(veg.bush.length).toBeGreaterThan(500);
    expect(all.length).toBeLessThan(20000);
  });
  it('never on water, roads or the Chibi Town plaza core', () => {
    const plaza = districts.find((d) => d.id === 'plaza')!;
    for (const v of all) {
      expect(v.y).toBeGreaterThan(0.7);
      expect(input.road(v.x, v.z)).toBeLessThan(0.03);
      expect(Math.hypot(v.x - plaza.x, v.z - plaza.z)).toBeGreaterThan(plaza.radius * 0.5);
    }
  });
  it('palms grow near the coast and Lumi Forest is the densest woodland', () => {
    for (const p of veg.palm) expect(coastDistance(p.x, p.z)).toBeLessThan(91);
    const f = districts.find((d) => d.id === 'forest')!;
    const inForest = veg.tree.filter((t) => Math.hypot(t.x - f.x, t.z - f.z) < f.radius).length;
    expect(inForest / veg.tree.length).toBeGreaterThan(0.25);
  });
  it('lower density keeps fewer instances', () => {
    const low = scatterVegetation({ ...input, density: 0.45 });
    expect(Object.values(low).flat().length).toBeLessThan(all.length * 0.6);
  });
  it('procedural foliage stays light', () => {
    expect(createRoundTree().attributes.position.count / 3).toBeLessThan(800);
    expect(createBush().attributes.position.count / 3).toBeLessThan(400);
  });
});

describe('Sunset Beach', () => {
  it('is open sand: no bushes or round trees on it, and the spawn point is on sand', () => {
    for (const t of [...veg.bush, ...veg.tree]) expect(sandAmount(t.x, t.z, t.y)).toBeLessThanOrEqual(0.3);
    const b = districts.find((d) => d.id === 'beach')!;
    const [sx, sz] = b.spawn!;
    expect(sandAmount(sx, sz, islandHeight(sx, sz))).toBeGreaterThan(0.8);
  });
});

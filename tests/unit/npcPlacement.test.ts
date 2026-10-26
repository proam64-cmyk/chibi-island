import { beforeAll, describe, expect, it } from 'vitest';
import { NPC_PLACEMENTS, placementBrain } from '../../src/npc/npcPlacements';
import { buildings } from '../../src/config/buildings';
import { districts } from '../../src/config/islandPlan';
import { characters } from '../../src/config/characters';
import { islandHeight, roadRaster } from '../../src/world/island/islandHeight';
import { sampleRoad } from '../../src/world/roads/roadRaster';
import { lampSpots, PLAZA_SPOTS } from '../../src/world/props/PlazaProps';
import { initPhysics, PhysicsWorld } from '../../src/physics/PhysicsWorld';

describe('NPC placements (Step 5)', () => {
  beforeAll(async () => { await initPhysics(); });
  const r = roadRaster();
  for (const p of NPC_PLACEMENTS) {
    it(`${p.characterId}: verified model, existing workplace`, () => {
      expect(characters.find((c) => c.id === p.characterId)?.status).toBe('VERIFIED');
      expect(buildings.some((b) => b.id === p.building)).toBe(true);
    });
    it(`${p.characterId}: work spot and the whole patrol route are walkable (off roads, flat, clear of buildings and props)`, () => {
      const cfg = placementBrain(p);
      const phys = new PhysicsWorld();
      for (const b of buildings) { const d = districts.find((q) => q.id === b.district)!; phys.addCylinder(d.x + b.dx, 0, d.z + b.dz, (b.footprint ?? 6) - 1.5, 20); }
      for (const l of lampSpots()) phys.addCylinder(l.x, 0, l.z, 0.16, 4);
      for (const s of Object.values(PLAZA_SPOTS)) phys.addCylinder(s.x, 0, s.z, 1.1, 2);
      const route = [cfg.work, ...cfg.patrol, cfg.work];
      for (let i = 0; i < route.length - 1; i++) for (let t = 0; t <= 1; t += 0.05) {
        const x = route[i].x + (route[i + 1].x - route[i].x) * t, z = route[i].z + (route[i + 1].z - route[i].z) * t;
        expect(sampleRoad(r, x, z).weight, `road at ${x.toFixed(1)},${z.toFixed(1)}`).toBeLessThan(0.05);
        expect(Math.abs(islandHeight(x, z) - islandHeight(cfg.work.x, cfg.work.z))).toBeLessThan(0.5);
        expect(phys.overlaps(x, islandHeight(x, z), z), `blocked at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
      }
    });
  }
});

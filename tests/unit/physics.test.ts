import { beforeAll, describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { initPhysics, PhysicsWorld } from '../../src/physics/PhysicsWorld';

describe('physics (Rapier)', () => {
  beforeAll(async () => { await initPhysics(); });
  const flat = () => 0;

  it('a wall blocks the player and lets it slide along', () => {
    const p = new PhysicsWorld();
    p.addBox(0, 0, 5, 10, 3, 1); // wall from z 4.5 to 5.5
    const pos = new Vector3(0, 0, 3.5);
    for (let i = 0; i < 60; i++) { const m = p.moveHorizontal(pos, 0.05, 0.1); pos.x += m.x; pos.z += m.z; }
    expect(pos.z).toBeLessThan(4.5 - 0.29);       // never inside the wall
    expect(pos.x).toBeGreaterThan(2.5);           // slid sideways
  });
  it('a building made of triangles (trimesh) is solid', () => {
    const p = new PhysicsWorld();
    const house = new Mesh(new BoxGeometry(8, 6, 8).translate(0, 3, 0), new MeshBasicMaterial());
    house.position.set(0, 0, 10); house.updateMatrixWorld(true);
    p.addTrimesh(house);
    const pos = new Vector3(0, 0, 0);
    for (let i = 0; i < 100; i++) { const m = p.moveHorizontal(pos, 0, 0.15); pos.x += m.x; pos.z += m.z; }
    expect(pos.z).toBeLessThan(6 - 0.29);
  });
  it('low obstacles (under the step height) do not block', () => {
    const p = new PhysicsWorld();
    p.addBox(0, 0, 2, 4, 0.2, 1);
    const m = p.moveHorizontal(new Vector3(0, 0, 0), 0, 3);
    expect(m.z).toBeCloseTo(3, 2);
  });
  it('recovery: a spot inside a building is moved to the nearest free spot', () => {
    const p = new PhysicsWorld();
    p.addBox(0, 0, 0, 6, 4, 6);
    expect(p.overlaps(0, 0, 0)).toBe(true);
    const s = p.findFreeSpot(0, 0, flat);
    expect(p.overlaps(s.x, 0, s.z)).toBe(false);
    expect(Math.hypot(s.x, s.z)).toBeLessThan(4.5);
  });
  it('tree trunks are solid', () => {
    const p = new PhysicsWorld();
    p.addCylinder(0, 0, 2, 0.35, 4);
    const pos = new Vector3(0, 0, 0);
    for (let i = 0; i < 40; i++) { const m = p.moveHorizontal(pos, 0, 0.1); pos.z += m.z; pos.x += m.x; }
    expect(Math.hypot(pos.x, pos.z - 2)).toBeGreaterThan(0.6);
  });
});

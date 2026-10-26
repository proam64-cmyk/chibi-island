import { describe, expect, it } from 'vitest';
import { angleDelta, cameraBasis, clamp, dampFactor, orbitOffset, terrainSafeDistance } from '../../src/camera/cameraMath';

describe('cameraMath', () => {
  it('orbitOffset keeps the requested distance and puts yaw 0 behind on +Z', () => {
    const o = orbitOffset(0, 0.3, 5.5);
    expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(5.5, 6);
    expect(o.z).toBeGreaterThan(0);
    expect(Math.abs(o.x)).toBeLessThan(1e-9);
  });
  it('cameraBasis: forward points away from the camera, right is perpendicular', () => {
    const { forward, right } = cameraBasis(0.7);
    const off = orbitOffset(0.7, 0, 1);
    expect(forward.x * off.x + forward.z * off.z).toBeCloseTo(-1, 6);
    expect(forward.x * right.x + forward.z * right.z).toBeCloseTo(0, 6);
    expect(cameraBasis(0).right).toEqual({ x: 1, z: -0 });
  });
  it('angleDelta returns the shortest signed turn', () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2, 6);
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2, 6);
  });
  it('terrainSafeDistance shortens the boom when a hill blocks it, and keeps it on flat ground', () => {
    const target = { x: 0, y: 1.1, z: 0 };
    const off = orbitOffset(0, 0.1, 6);
    expect(terrainSafeDistance(target, off, 6, () => 0, 0.4)).toBeCloseTo(6, 6);
    const hill = (_x: number, z: number) => (z > 2 ? 5 : 0);
    const d = terrainSafeDistance(target, off, 6, hill, 0.4);
    expect(d).toBeLessThan(2.5);
    expect(d).toBeGreaterThanOrEqual(0.6);
  });
  it('dampFactor is frame-rate independent', () => {
    const one = 1 - dampFactor(0.12, 1 / 30);
    const two = (1 - dampFactor(0.12, 1 / 60)) ** 2;
    expect(one).toBeCloseTo(two, 9);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});

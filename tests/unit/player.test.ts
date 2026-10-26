import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { PlayerController } from '../../src/characters/PlayerController';

const idle = { moveX: 0, moveY: 0, run: false, jumpPressed: false, interactPressed: false };

describe('PlayerController', () => {
  it('uses an avatar instead of the capsule and can toggle back for debugging', () => {
    const p = new PlayerController(() => 0);
    const rei = new Group();
    p.setAvatar(rei);
    expect(p.hasAvatar).toBe(true);
    expect(rei.parent).toBe(p.body);
    p.toggleCapsule();
    expect(rei.visible).toBe(false);
    p.toggleCapsule();
    expect(rei.visible).toBe(true);
  });
  it('walks forward relative to the camera, bobs while moving and stays on the ground', () => {
    const p = new PlayerController(() => 2);
    p.setAvatar(new Group());
    let maxBob = 0;
    for (let i = 0; i < 60; i++) { p.update(1 / 60, { ...idle, moveY: 1 }, 0); maxBob = Math.max(maxBob, p.body.position.y); }
    expect(p.position.z).toBeLessThan(-1);          // camera yaw 0 → forward is −Z
    expect(p.position.y).toBeCloseTo(2, 6);
    expect(maxBob).toBeGreaterThan(0.01);
    expect(p.odometer).toBeGreaterThan(1);
  });
  it('does not walk into deep water', () => {
    const p = new PlayerController((_x, z) => (z < -1 ? -3 : 1));
    for (let i = 0; i < 120; i++) p.update(1 / 60, { ...idle, moveY: 1 }, 0);
    expect(p.position.z).toBeGreaterThan(-1.05);
  });
  it('jumps once per press and lands back on the ground', () => {
    const p = new PlayerController(() => 0);
    p.update(1 / 60, { ...idle, jumpPressed: true, interactPressed: false }, 0);
    let top = 0;
    for (let i = 0; i < 120; i++) { p.update(1 / 60, idle, 0); top = Math.max(top, p.position.y); }
    expect(top).toBeGreaterThan(0.6);
    expect(p.position.y).toBe(0);
    expect(p.grounded).toBe(true);
  });
});

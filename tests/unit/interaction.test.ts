import { describe, expect, it, beforeAll } from 'vitest';
import { InteractionSystem } from '../../src/interaction/Interactables';
import { PlayerController } from '../../src/characters/PlayerController';
import { initPhysics, PhysicsWorld } from '../../src/physics/PhysicsWorld';

describe('interaction (E)', () => {
  it('offers the nearest target in front, nothing when out of range or behind', () => {
    const s = new InteractionSystem(); let used = '';
    s.add({ id: 'bench', x: 0, y: 0, z: 2, radius: 2.5, promptKey: 'interact.sit', action: () => { used = 'bench'; } });
    s.add({ id: 'board', x: 0, y: 0, z: -2, radius: 2.5, promptKey: 'interact.read', action: () => { used = 'board'; } });
    expect(s.update(0, 0, 0)?.id).toBe('bench');          // facing +Z
    expect(s.update(0, 0, Math.PI)?.id).toBe('board');    // facing −Z
    expect(s.update(0, 10, 0)).toBeNull();                 // too far
    s.update(0, 0, 0); expect(s.trigger()).toBe(true); expect(used).toBe('bench');
    s.update(0, 10, 0); expect(s.trigger()).toBe(false);   // no fake action
  });
  it('disabled targets are not offered', () => {
    const s = new InteractionSystem();
    s.add({ id: 'shop', x: 0, y: 0, z: 1, radius: 2, promptKey: 'x', enabled: () => false, action: () => {} });
    expect(s.update(0, 0, 0)).toBeNull();
  });
});

describe('player with physics', () => {
  beforeAll(async () => { await initPhysics(); });
  const idle = { moveX: 0, moveY: 0, run: false, jumpPressed: false, interactPressed: false };
  it('cannot walk through a building and never appears inside one', () => {
    const phys = new PhysicsWorld(); phys.addBox(0, 0, 8, 10, 6, 6); // building from z 5 to 11
    const p = new PlayerController(() => 0); p.physics = phys;
    p.teleport(0, 0);
    for (let i = 0; i < 300; i++) p.update(1 / 60, { ...idle, moveY: 1 }, 0);
    expect(p.position.z).toBeLessThan(5 - 0.25);
    p.teleport(0, 8);                                   // asked to appear inside it
    expect(phys.overlaps(p.position.x, 0, p.position.z)).toBe(false);
  });
  it('sits on a bench and stands up when moving', () => {
    const p = new PlayerController(() => 0);
    p.sit(2, 0.45, 2, Math.PI, 2, 3);
    p.update(1 / 60, idle, 0); expect(p.seated).not.toBeNull(); expect(p.position.x).toBe(2);
    p.update(1 / 60, { ...idle, moveY: 1 }, 0); expect(p.seated).toBeNull(); expect(p.position.z).toBeGreaterThan(2.9);
  });
});

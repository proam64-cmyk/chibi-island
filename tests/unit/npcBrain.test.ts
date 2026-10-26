import { describe, expect, it } from 'vitest';
import { NpcBrain, headingTo } from '../../src/npc/NpcBrain';

const cfg = { work: { x: 0, z: 0, heading: 0 }, patrol: [{ x: 5, z: 0 }, { x: 5, z: 5 }], workTime: [2, 2] as [number, number], pauseTime: 1 };
function run(b: NpcBrain, pos: { x: number; z: number }, secs: number, player: { x: number; z: number } | null = null, talking = false) {
  const states = new Set<string>(); const seq: string[] = []; let greets = 0, out = b.update(0, pos, null, false);
  for (let t = 0; t < secs; t += 0.05) { out = b.update(0.05, pos, player, talking); pos.x += out.vx * 0.05; pos.z += out.vz * 0.05; states.add(out.state); if (seq[seq.length - 1] !== out.state) seq.push(out.state); if (out.greet) greets++; }
  return { out, states, greets, seq };
}

describe('NPC brain (FSM)', () => {
  it('works, walks its patrol route, pauses at each point and returns to work', () => {
    const b = new NpcBrain(cfg), pos = { x: 0, z: 0 };
    const r = run(b, pos, 30);
    expect(r.seq.slice(0, 7)).toEqual(['WORKING', 'WALKING', 'IDLE', 'WALKING', 'IDLE', 'RETURNING_TO_WORK', 'WORKING']);
  });
  it('stops, turns to a nearby player and greets once per approach', () => {
    const b = new NpcBrain(cfg), pos = { x: 0, z: 0 };
    const r = run(b, pos, 5, { x: 3, z: 0 });
    expect(r.out.state).toBe('RESPONDING_TO_PLAYER');
    expect(r.out.vx).toBe(0);
    expect(r.out.heading).toBeCloseTo(headingTo(pos, { x: 3, z: 0 }), 5);
    expect(r.greets).toBe(1);
  });
  it('talking holds the NPC still facing the player; when the player leaves it goes back to work', () => {
    const b = new NpcBrain(cfg), pos = { x: 0, z: 0 };
    expect(run(b, pos, 2, { x: 2, z: 1 }, true).out.state).toBe('TALKING');
    const back = run(b, pos, 20, { x: 30, z: 30 });
    expect(back.states.has('RETURNING_TO_WORK') || back.states.has('WORKING')).toBe(true);
  });
  it('never walks into a player standing on its path', () => {
    const b = new NpcBrain({ ...cfg, workTime: [0.1, 0.1] }), pos = { x: 0, z: 0 };
    run(b, pos, 0.3);                           // starts walking toward (5,0)
    const startX = pos.x;
    const r = run(b, pos, 3, { x: startX + 5.2, z: 0 }); // outside the notice radius but ahead on the route
    expect(pos.x).toBeLessThan(startX + 5.2 - 1.0);
    expect(r.out.state).not.toBe('TALKING');
  });
  it('is deterministic for the same seed', () => {
    const a = new NpcBrain(cfg), c = new NpcBrain(cfg), pa = { x: 0, z: 0 }, pc = { x: 0, z: 0 };
    run(a, pa, 12); run(c, pc, 12);
    expect(pa).toEqual(pc);
  });
});

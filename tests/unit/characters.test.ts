import { describe, expect, it } from 'vitest';
import { characters, LOOKALIKE_CHECKS } from '../../src/config/characters';

describe('character registry', () => {
  it('has 10 permanent NPCs, Alana as starting player and 6 unlockables, with unique ids', () => {
    expect(characters.filter((c) => c.category === 'permanent_npc')).toHaveLength(10);
    expect(characters.filter((c) => c.category === 'starting_playable').map((c) => c.id)).toEqual(['pc_alana']);
    expect(characters.filter((c) => c.category === 'unlockable_playable')).toHaveLength(6);
    expect(new Set(characters.map((c) => c.id)).size).toBe(characters.length);
  });
  it('a character without GLB and reference can never be VERIFIED', () => {
    for (const c of characters) if (!c.glb || !c.reference) expect(c.status, c.id).toBe('UNVERIFIED');
  });
  it('no two characters share the same GLB (one model = one identity)', () => {
    const glbs = characters.map((c) => c.glb).filter(Boolean);
    expect(new Set(glbs).size).toBe(glbs.length);
  });
  it('Rei and Alana are separate; Sora, Rina and Yui are marked as not interchangeable', () => {
    const byId = Object.fromEntries(characters.map((c) => [c.id, c]));
    expect(byId.pc_alana.distinctFrom).toContain('pc_rei');
    expect(byId.npc_sora_akiyama.distinctFrom).toEqual(expect.arrayContaining(['npc_yui_sakamoto', 'npc_rina_fujimoto']));
    for (const l of LOOKALIKE_CHECKS) { expect(byId[l.a]).toBeTruthy(); expect(byId[l.b]).toBeTruthy(); }
  });
});

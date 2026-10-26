import { describe, expect, it } from 'vitest';
import { WorldClock } from '../../src/world/time/WorldClock';
import { lightDirection, presetAt, streetLightLevel } from '../../src/world/time/dayNight';

describe('world clock', () => {
  it('a full day lasts 48 real minutes by default and wraps to day 2', () => {
    const c = new WorldClock(48, 0);
    c.update(48 * 60);
    expect(c.day).toBe(2);
    expect(c.minuteOfDay).toBeCloseTo(0, 5);
  });
  it('starts at 08:00 and formats the time', () => {
    const c = new WorldClock();
    expect(c.label).toBe('08:00');
    c.update(60); // 1 real minute = 30 game minutes
    expect(c.label).toBe('08:30');
  });
  it('phases follow the directive (dawn 5–7, day 7–17, evening 17–20, night 20–5)', () => {
    const at = (h: number) => { const c = new WorldClock(48, 0); c.skipHours(h); return c.phase; };
    expect([at(4.9), at(5), at(7), at(16.9), at(17), at(20), at(23)]).toEqual(['night', 'dawn', 'day', 'day', 'evening', 'night', 'night']);
  });
  it('pausing stops time', () => {
    const c = new WorldClock(); c.paused = true; c.update(600); expect(c.label).toBe('08:00');
  });
});

describe('day / night', () => {
  it('daytime keeps the approved Phase 1 look', () => {
    const p = presetAt(12);
    expect(p.zenith).toBe('#4FA8F0'); expect(p.sunIntensity).toBe(2.5);
  });
  it('lighting changes gradually (no jumps between minutes)', () => {
    for (let m = 0; m < 1440; m++) {
      const a = presetAt(m / 60), b = presetAt((m + 1) / 60);
      expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.05);
    }
  });
  it('the sun is up at noon and the moon at midnight', () => {
    expect(lightDirection(12)).toMatchObject({ isSun: true }); expect(lightDirection(12).elevationDeg).toBeGreaterThan(50);
    expect(lightDirection(0)).toMatchObject({ isSun: false });
  });
  it('street lights: off by day, on at night, switching on gradually 17:30–18:30', () => {
    expect(streetLightLevel(12)).toBe(0); expect(streetLightLevel(23)).toBe(1); expect(streetLightLevel(3)).toBe(1);
    const mid = streetLightLevel(18); expect(mid).toBeGreaterThan(0.2); expect(mid).toBeLessThan(0.8);
    expect(streetLightLevel(7.5)).toBe(0);
  });
});

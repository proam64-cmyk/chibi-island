import { describe, expect, it } from 'vitest';
import { TEST_TERRAIN_SIZE, testTerrainHeight } from '../../src/world/terrain/heightField';
import { detectProfile } from '../../src/config/performanceProfiles';
import { missingKeys } from '../../src/i18n/i18n';

describe('test terrain', () => {
  it('is deterministic', () => {
    expect(testTerrainHeight(37.2, -81.5)).toBe(testTerrainHeight(37.2, -81.5));
  });
  it('has a flat spawn area at 3 m and sinks below sea level at the edges', () => {
    expect(testTerrainHeight(0, 0)).toBeCloseTo(3, 6);
    expect(testTerrainHeight(5, -6)).toBeCloseTo(3, 6);
    const edge = TEST_TERRAIN_SIZE / 2 - 2;
    expect(testTerrainHeight(edge, 0)).toBeLessThan(0);
    expect(testTerrainHeight(0, -edge)).toBeLessThan(0);
  });
  it('stays gentle: no step steeper than 1 m per meter on a 1 m grid', () => {
    let worst = 0;
    for (let x = -200; x < 200; x += 1) for (let z = -200; z < 200; z += 7) {
      worst = Math.max(worst, Math.abs(testTerrainHeight(x + 1, z) - testTerrainHeight(x, z)));
    }
    expect(worst).toBeLessThan(1);
  });
});

describe('config', () => {
  it('detects a quality profile', () => {
    expect(detectProfile({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe('high');
    expect(detectProfile({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile', hardwareConcurrency: 4 })).toBe('low');
  });
  it('EN and JA translations cover every Spanish key', () => {
    expect(missingKeys('en')).toEqual([]);
    expect(missingKeys('ja')).toEqual([]);
  });
});

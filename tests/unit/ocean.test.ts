import { describe, expect, it } from 'vitest';
import { COAST_GRID } from '../../src/world/island/coastSdfData';
import { landmarks } from '../../src/config/islandPlan';
import { buildDepthGrid } from '../../src/world/ocean/StylizedOcean';

describe('ocean depth grid', () => {
  const grid = buildDepthGrid();
  const at = (x: number, z: number) => {
    const i = Math.floor((x - COAST_GRID.originX) / COAST_GRID.cell), j = Math.floor((z - COAST_GRID.originZ) / COAST_GRID.cell);
    return grid[j * COAST_GRID.cols + i] / 10;
  };
  it('has one value per coast-grid cell', () => {
    expect(grid.length).toBe(COAST_GRID.cols * COAST_GRID.rows);
  });
  it('is 0 on land, shallow at the docks and deep far offshore', () => {
    expect(at(0, 0)).toBe(0);
    const docks = landmarks.find((l) => l.id === 'docks')!;
    expect(at(docks.x, docks.z)).toBeGreaterThan(0.3);
    expect(at(1000, 780)).toBeGreaterThan(20);
  });
});

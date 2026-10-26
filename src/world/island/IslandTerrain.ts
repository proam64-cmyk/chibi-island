import { BufferAttribute, BufferGeometry, Color, Group, LOD, Mesh, MeshToonMaterial } from 'three';
import { islandBounds } from '../../config/islandPlan';
import { palette } from '../../config/styleTokens';
import { environmentRamp } from '../../render/materials/ToonMaterial';
import { VOLCANO_X, VOLCANO_Z, islandHeight, sandAmount, smoothstep } from './islandHeight';
import { buildLevel, chunkCenters, sampleChunk, type ColorFn } from './terrainChunks';

export const CHUNK_SIZE = 200;
// Snow starts higher (85 m) so Winter Atelier (100 m) is snowy while Sky Terrace (55 m) stays green.
/** Camera distances (m) at which each LOD level starts. */
export const LOD_DISTANCES = [0, 260, 560, 1000];

const C = (hex: string) => new Color(hex);
const grassLit = C(palette.grass.lit), grassShade = C(palette.grass.shade), sandDry = C(palette.sand.dry), sandWet = C(palette.sand.wet);
const rockLit = C(palette.rock.lit), rockShade = C(palette.rock.shade), snow = C(palette.snow.lit), seabed = C(palette.water.shallow);
const basalt = C('#3F3A44'), ash = C('#6B5F5A'), lava = C('#FF6A2B');
const tmp = new Color();

export const islandColor: ColorFn = (x, z, h, slope) => {
  tmp.copy(grassLit).lerp(grassShade, smoothstep(20, 70, h) * 0.45);
  tmp.lerp(sandDry, sandAmount(x, z, h));
  tmp.lerp(sandWet, 1 - smoothstep(-0.4, 0.7, h));
  tmp.lerp(seabed, (1 - smoothstep(-6, -1, h)) * 0.5);
  tmp.lerp(rockLit, smoothstep(0.22, 0.42, slope));
  tmp.lerp(rockShade, smoothstep(0.5, 0.7, slope) * 0.6);
  const volcanic = 1 - smoothstep(140, 300, Math.hypot(x - VOLCANO_X, z - VOLCANO_Z));
  tmp.lerp(snow, smoothstep(85, 115, h) * (1 - smoothstep(0.55, 0.75, slope) * 0.5) * (1 - volcanic));
  tmp.lerp(ash, volcanic * smoothstep(8, 30, h) * 0.8);
  tmp.lerp(basalt, volcanic * smoothstep(45, 90, h));
  // Lava: a glowing pool in the crater and a few streaks running down the cone (map REF-04 / REF-07).
  const rv = Math.hypot(x - VOLCANO_X, z - VOLCANO_Z);
  const ang = Math.atan2(z - VOLCANO_Z, x - VOLCANO_X);
  const streak = smoothstep(0.95, 0.99, Math.sin(ang * 6 + Math.sin(rv * 0.03 + ang * 3) * 1.6)) * smoothstep(0.35, 0.65, 0.5 + 0.5 * Math.sin(ang * 3 + 1.7))
    * smoothstep(45, 70, rv) * (1 - smoothstep(150, 230, rv));
  tmp.lerp(lava, Math.max(1 - smoothstep(18, 30, rv), streak * 0.9));
  return [tmp.r, tmp.g, tmp.b];
};

export interface TerrainBuildStats { chunks: number; skipped: number; ms: number }

/**
 * Builds the island as 200 m chunks, each a THREE.LOD with 4 levels (full, ½, ¼, ⅛ resolution).
 * Chunks entirely deep under the sea are skipped (the ocean covers them).
 */
export async function buildIslandTerrain(segments: number, onProgress?: (done: number, total: number) => void): Promise<{ group: Group; stats: TerrainBuildStats }> {
  const t0 = performance.now();
  const group = new Group();
  group.name = 'IslandTerrain';
  const material = new MeshToonMaterial({ vertexColors: true, gradientMap: environmentRamp() });
  const centers = chunkCenters(islandBounds.minX, islandBounds.maxX, islandBounds.minZ, islandBounds.maxZ, CHUNK_SIZE);
  let skipped = 0;
  for (let k = 0; k < centers.length; k++) {
    const { cx, cz } = centers[k];
    const sample = sampleChunk(cx, cz, CHUNK_SIZE, segments, islandHeight);
    if (sample.maxH < -7) { skipped++; }
    else {
      const lod = new LOD();
      lod.name = `chunk_${cx}_${cz}`;
      [1, 2, 4, 8].forEach((step, level) => {
        const d = buildLevel(sample, step, islandColor);
        const geo = new BufferGeometry();
        geo.setAttribute('position', new BufferAttribute(d.positions, 3));
        geo.setAttribute('normal', new BufferAttribute(d.normals, 3));
        geo.setAttribute('color', new BufferAttribute(d.colors, 3));
        geo.setIndex(new BufferAttribute(d.indices, 1));
        geo.computeBoundingSphere();
        const mesh = new Mesh(geo, material);
        mesh.receiveShadow = true;
        mesh.castShadow = level === 0;
        lod.addLevel(mesh, LOD_DISTANCES[level]);
      });
      group.add(lod);
    }
    onProgress?.(k + 1, centers.length);
    if (k % 4 === 3) await new Promise((r) => setTimeout(r, 0)); // keep the loading screen responsive
  }
  return { group, stats: { chunks: centers.length - skipped, skipped, ms: performance.now() - t0 } };
}

import { BufferAttribute, Color, Mesh, MeshToonMaterial, PlaneGeometry } from 'three';
import { palette } from '../../config/styleTokens';
import { environmentRamp } from '../../render/materials/ToonMaterial';
import { TEST_TERRAIN_SIZE, smoothstep, testTerrainHeight } from './heightField';

/** Phase 1 prototype terrain: one mesh, vertex-colored by height and slope, toon shaded. */
export function createTestTerrain(segments: number): Mesh {
  const geo = new PlaneGeometry(TEST_TERRAIN_SIZE, TEST_TERRAIN_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, testTerrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const nrm = geo.attributes.normal as BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassLit = new Color(palette.grass.lit), grassShade = new Color(palette.grass.shade);
  const sandDry = new Color(palette.sand.dry), sandWet = new Color(palette.sand.wet);
  const rock = new Color(palette.rock.lit);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i);
    const slope = 1 - nrm.getY(i); // 0 flat → 1 vertical
    c.copy(grassLit).lerp(grassShade, smoothstep(4, 9, h) * 0.6);
    c.lerp(sandDry, 1 - smoothstep(0.9, 1.8, h));
    c.lerp(sandWet, 1 - smoothstep(-0.2, 0.6, h));
    c.lerp(rock, smoothstep(0.18, 0.35, slope));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));

  const mat = new MeshToonMaterial({ vertexColors: true, gradientMap: environmentRamp() });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'TestTerrain';
  mesh.receiveShadow = true;
  return mesh;
}

import { Mesh, MeshToonMaterial, PlaneGeometry } from 'three';
import { palette } from '../../config/styleTokens';
import { environmentRamp } from '../../render/materials/ToonMaterial';

/** Placeholder sea (Phase 1 only). The stylized water shader arrives in Phase 2. */
export function createDebugOcean(): Mesh {
  const geo = new PlaneGeometry(8000, 8000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new MeshToonMaterial({ color: palette.water.mid, gradientMap: environmentRamp(), transparent: true, opacity: 0.88 });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'DebugOcean';
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  return mesh;
}

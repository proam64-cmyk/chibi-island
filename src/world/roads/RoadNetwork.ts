import { BufferAttribute, BufferGeometry, CanvasTexture, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshToonMaterial, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three';
import { palette } from '../../config/styleTokens';
import { environmentRamp } from '../../render/materials/ToonMaterial';
import type { RoadPath, RoadRaster } from './roadRaster';

function roadTexture(): CanvasTexture {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = palette.asphalt; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2); }
  g.fillStyle = palette.roadline.white; g.fillRect(6, 0, 5, 256); g.fillRect(117, 0, 5, 256);       // edge lines
  g.fillStyle = palette.roadline.yellow; g.fillRect(61, 0, 6, 150);                                 // centre dash
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Flat ribbon along the road at its design elevation (+5 cm); bridges get a deck, low walls and pillars. */
function ribbon(path: RoadPath): { road: BufferGeometry; walls: BufferGeometry | null; pillars: Vector3[] } {
  const half = path.def.width / 2, s = path.samples, n = s.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const wpos: number[] = [], widx: number[] = [];
  const pillars: Vector3[] = [];
  let v = 0, lastPillar = -999;
  for (let i = 0; i < n; i++) {
    const p = s[i], nx = -p.tz, nz = p.tx, y = p.elev + 0.05;
    pos.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
    uv.push(0, v / path.def.width, 1, v / path.def.width);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); v += Math.hypot(p.x - s[i - 1].x, p.z - s[i - 1].z); }
    if (p.bridge) {
      if (v - lastPillar > 14) { pillars.push(new Vector3(p.x, p.elev, p.z)); lastPillar = v; }
      if (i > 0 && s[i - 1].bridge) {
        const q = s[i - 1], qnx = -q.tz, qnz = q.tx;
        for (const side of [1, -1]) {
          const b = wpos.length / 3;
          const ax = q.x + qnx * half * side, az = q.z + qnz * half * side, bx = p.x + nx * half * side, bz = p.z + nz * half * side;
          wpos.push(ax, q.elev - 0.6, az, bx, p.elev - 0.6, bz, ax, q.elev + 0.75, az, bx, p.elev + 0.75, bz);
          widx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2, b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
    }
  }
  const road = new BufferGeometry();
  road.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  road.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  road.setIndex(idx);
  road.computeVertexNormals();
  let walls: BufferGeometry | null = null;
  if (wpos.length) { walls = new BufferGeometry(); walls.setAttribute('position', new BufferAttribute(new Float32Array(wpos), 3)); walls.setIndex(widx); walls.computeVertexNormals(); }
  return { road, walls, pillars };
}

export function createRoadNetwork(raster: RoadRaster): Group {
  const group = new Group(); group.name = 'Roads';
  const roadMat = new MeshToonMaterial({ map: roadTexture(), gradientMap: environmentRamp(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const stone = new MeshToonMaterial({ color: palette.paving.warm, gradientMap: environmentRamp() });
  const allPillars: Vector3[] = [];
  for (const path of raster.paths) {
    const { road, walls, pillars } = ribbon(path);
    const m = new Mesh(road, roadMat); m.receiveShadow = true; m.name = `road_${path.def.id}`; group.add(m);
    if (walls) { const w = new Mesh(walls, stone); w.castShadow = true; w.receiveShadow = true; group.add(w); }
    allPillars.push(...pillars);
  }
  if (allPillars.length) {
    const geo = new CylinderGeometry(0.9, 1.1, 1, 10).translate(0, -0.5, 0);
    const inst = new InstancedMesh(geo, stone, allPillars.length);
    const mtx = new Matrix4();
    allPillars.forEach((p, i) => { const h = p.y + 14; inst.setMatrixAt(i, mtx.makeScale(1, h, 1).setPosition(p.x, p.y - 0.3, p.z)); });
    inst.computeBoundingSphere(); inst.castShadow = true;
    group.add(inst);
  }
  return group;
}

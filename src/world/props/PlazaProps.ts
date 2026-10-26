import { AdditiveBlending, Box3, CanvasTexture, CircleGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, PointLight, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toToonMaterial } from '../../render/materials/ToonMaterial';
import { groundHeight, roadRaster } from '../island/islandHeight';
import { placeBuilding } from '../buildings/placeBuilding';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import type { InteractionSystem } from '../../interaction/Interactables';
import { buildings } from '../../config/buildings';
import { districts } from '../../config/islandPlan';

/** Approved plaza props placed for Hito A (bench + noticeboard interactions, street lights for day/night). */
export const PLAZA_SPOTS = {
  bench: { x: -14, z: 15 },
  noticeboard: { x: 16, z: -14 },
} as const;

const faceCenter = (x: number, z: number) => Math.atan2(-x, -z); // +Z of the model toward the plaza centre

function toonify(o: Object3D): void {
  o.traverse((c) => { const m = c as Mesh; if (!m.isMesh) return; m.material = toToonMaterial(Array.isArray(m.material) ? m.material[0] : m.material, 'building'); m.castShadow = true; m.receiveShadow = true; });
}

function radialTexture(inner: string, outer: string): CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

/** Positions for street lamps along the roads near the plaza (both sides, every 16 m, away from buildings). */
export function lampSpots(maxDist = 62, every = 16): Array<{ x: number; z: number; rot: number }> {
  const out: Array<{ x: number; z: number; rot: number }> = [];
  const bpos = buildings.map((b) => { const d = districts.find((q) => q.id === b.district)!; return { x: d.x + b.dx, z: d.z + b.dz, r: (b.footprint ?? 6) + 2 }; });
  for (const p of roadRaster().paths) {
    let acc = 0, side = 1;
    for (let i = 1; i < p.samples.length; i++) {
      const s = p.samples[i], q = p.samples[i - 1];
      acc += Math.hypot(s.x - q.x, s.z - q.z);
      const dc = Math.hypot(s.x, s.z);
      if (dc > maxDist) break;
      if (acc < every || dc < 14) continue;
      acc = 0; side = -side;
      const off = p.def.width / 2 + 1.4;
      const x = s.x - s.tz * off * side, z = s.z + s.tx * off * side;
      if (bpos.some((b) => Math.hypot(b.x - x, b.z - z) < b.r)) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 8)) continue;
      out.push({ x, z, rot: Math.atan2(s.tz * side, -s.tx * side) });
    }
  }
  return out;
}

export class PlazaProps {
  readonly group = new Group();
  private glows: Sprite[] = [];
  private pools: Mesh[] = [];
  private lights: PointLight[] = [];
  private heads: Vector3[] = [];

  constructor(assets: { lamp?: GLTF; bench?: GLTF; board?: GLTF }, physics: PhysicsWorld, interaction: InteractionSystem,
    actions: { sit: (x: number, y: number, z: number, heading: number, standX: number, standZ: number) => void; readBoard: () => void }) {
    this.group.name = 'PlazaProps';
    // Bench
    if (assets.bench) {
      const { x, z } = PLAZA_SPOTS.bench, rot = faceCenter(x, z), y = groundHeight(x, z);
      const b = placeBuilding(assets.bench.scene, x, y, z, rot); toonify(b); this.group.add(b);
      const size = new Box3().setFromObject(b).getSize(new Vector3());
      physics.addBox(x, y, z, Math.max(size.x, size.z), 0.9, Math.min(size.x, size.z) * 0.9, rot);
      const fx = Math.sin(rot), fz = Math.cos(rot);
      interaction.add({ id: 'plaza_bench', x: x + fx * 0.6, y, z: z + fz * 0.6, radius: 2.4, promptKey: 'interact.sit',
        action: () => actions.sit(x + fx * 0.1, y + 0.45, z + fz * 0.1, rot, x + fx * 1.3, z + fz * 1.3) });
    }
    // Noticeboard
    if (assets.board) {
      const { x, z } = PLAZA_SPOTS.noticeboard, rot = faceCenter(x, z), y = groundHeight(x, z);
      const b = placeBuilding(assets.board.scene, x, y, z, rot); toonify(b); this.group.add(b);
      physics.addBox(x, y, z, 1.45, 1.9, 0.45, rot);
      interaction.add({ id: 'plaza_noticeboard', x: x + Math.sin(rot) * 0.9, y, z: z + Math.cos(rot) * 0.9, radius: 2.6, promptKey: 'interact.read', action: actions.readBoard });
    }
    // Street lamps
    if (assets.lamp) {
      const glowTex = radialTexture('rgba(255,230,170,1)', 'rgba(255,200,120,0)');
      const poolTex = radialTexture('rgba(255,214,150,0.55)', 'rgba(255,200,120,0)');
      for (const s of lampSpots()) {
        const y = groundHeight(s.x, s.z);
        const lamp = placeBuilding(assets.lamp.scene.clone(true), s.x, y, s.z, s.rot); toonify(lamp); this.group.add(lamp);
        const box = new Box3().setFromObject(lamp), c = box.getCenter(new Vector3());
        const head = new Vector3(c.x, box.max.y - 0.45, c.z);
        physics.addCylinder(s.x, y, s.z, 0.16, 4.2);
        const glow = new Sprite(new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
        glow.position.copy(head); glow.scale.setScalar(1.6); this.group.add(glow); this.glows.push(glow);
        const pool = new Mesh(new CircleGeometry(5, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: poolTex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
        pool.position.set(head.x, y + 0.04, head.z); this.group.add(pool); this.pools.push(pool);
        this.heads.push(head);
      }
      // A few real lights moved to the lamps nearest the camera (fixed count: no shader recompiles).
      for (let i = 0; i < 4; i++) { const l = new PointLight('#FFD9A0', 0, 16, 2); this.group.add(l); this.lights.push(l); }
    }
  }

  get lampCount(): number { return this.heads.length; }

  /** `level` 0…1 from streetLightLevel(hour). */
  update(level: number, camera: Vector3): void {
    for (const g of this.glows) (g.material as SpriteMaterial).opacity = level;
    for (const p of this.pools) (p.material as MeshBasicMaterial).opacity = level;
    const near = this.heads.map((h, i) => ({ i, d: h.distanceToSquared(camera) })).sort((a, b) => a.d - b.d);
    this.lights.forEach((l, k) => {
      const n = near[k];
      if (!n) { l.intensity = 0; return; }
      l.position.copy(this.heads[n.i]); l.intensity = 9 * level;
    });
  }
}

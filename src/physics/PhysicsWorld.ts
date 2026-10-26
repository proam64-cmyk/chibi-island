/**
 * Rapier 3D collision for solid objects (buildings, tree trunks, props) — decision D-7, Hito A.
 * The terrain itself stays analytic (`groundHeight`, exact and already tested): Rapier only resolves the
 * player's HORIZONTAL movement against obstacles. The player capsule floats `STEP` m above the ground,
 * so anything lower than that (kerbs, Meshy base plates) is simply stepped over.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import type { Object3D, Mesh, BufferGeometry } from 'three';
import { Vector3 } from 'three';

export const PLAYER_RADIUS = 0.3;
export const PLAYER_HALF_HEIGHT = 0.35;
/** Obstacles lower than this are stepped over. */
export const STEP = 0.3;
const CENTER_Y = STEP + PLAYER_RADIUS + PLAYER_HALF_HEIGHT;

let ready: Promise<void> | null = null;
/** Loads the Rapier WASM once (works in browsers and Node). */
export function initPhysics(): Promise<void> { return (ready ??= RAPIER.init()); }

export class PhysicsWorld {
  readonly world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private shape: RAPIER.Capsule;
  colliders = 0;
  private dirty = true;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.controller = this.world.createCharacterController(0.02);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, CENTER_Y, 0));
    this.shape = new RAPIER.Capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS);
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS), this.body);
  }

  /** Static triangle-mesh collider from every mesh under `root`, in world space (buildings). */
  addTrimesh(root: Object3D): number {
    root.updateMatrixWorld(true);
    let tris = 0;
    const v = new Vector3();
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const g = m.geometry as BufferGeometry, pos = g.attributes.position;
      const verts = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); verts.set([v.x, v.y, v.z], i * 3); }
      const idx = g.index ? Uint32Array.from(g.index.array as ArrayLike<number>) : Uint32Array.from({ length: pos.count }, (_, i) => i);
      this.world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx));
      tris += idx.length / 3; this.colliders++;
    });
    this.dirty = true;
    return tris;
  }

  /** Static vertical cylinder (tree trunks, lamp posts). `y` = base height. */
  addCylinder(x: number, y: number, z: number, radius: number, height: number): void {
    this.world.createCollider(RAPIER.ColliderDesc.cylinder(height / 2, radius).setTranslation(x, y + height / 2, z));
    this.colliders++; this.dirty = true;
  }

  /** Static box rotated about Y. `y` = base height; sizes are full extents. */
  addBox(x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0): void {
    const q = { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) };
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(x, y + sy / 2, z).setRotation(q));
    this.colliders++; this.dirty = true;
  }

  /** Moving solid capsule for an NPC (same size as the player). Returns a setter for its feet position. */
  addNpcCapsule(x: number, y: number, z: number): (x: number, y: number, z: number) => void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + CENTER_Y, z));
    this.world.createCollider(RAPIER.ColliderDesc.capsule(PLAYER_HALF_HEIGHT, PLAYER_RADIUS), body);
    this.colliders++; this.dirty = true;
    return (nx, ny, nz) => { body.setTranslation({ x: nx, y: ny + CENTER_Y, z: nz }, true); this.dirty = true; };
  }

  private refresh(): void { if (this.dirty) { this.world.step(); this.dirty = false; } }

  /**
   * Moves the player capsule from `from` (feet position) by (dx, dz) against static obstacles and
   * returns the allowed horizontal movement (sliding along walls).
   */
  moveHorizontal(from: Vector3, dx: number, dz: number): { x: number; z: number; blocked: boolean } {
    this.refresh();
    this.body.setTranslation({ x: from.x, y: from.y + CENTER_Y, z: from.z }, true);
    this.collider.setTranslation({ x: from.x, y: from.y + CENTER_Y, z: from.z });
    this.controller.computeColliderMovement(this.collider, { x: dx, y: 0, z: dz });
    const m = this.controller.computedMovement();
    const blocked = Math.hypot(m.x - dx, m.z - dz) > 1e-4;
    return { x: m.x, z: m.z, blocked };
  }

  /** True when a player standing at (x, y, z) would overlap a solid object. */
  overlaps(x: number, y: number, z: number): boolean {
    this.refresh();
    let hit = false;
    this.world.intersectionsWithShape({ x, y: y + CENTER_Y, z }, { x: 0, y: 0, z: 0, w: 1 }, this.shape, (c) => {
      if (c.handle === this.collider.handle) return true;
      hit = true; return false;
    });
    return hit;
  }

  /** Nearest free spot to (x, z) on a spiral (0.5 m steps, up to `maxR`), using `height` for y. */
  findFreeSpot(x: number, z: number, height: (x: number, z: number) => number, maxR = 40): { x: number; z: number } {
    if (!this.overlaps(x, height(x, z), z)) return { x, z };
    for (let r = 0.5; r <= maxR; r += 0.5) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.5));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (!this.overlaps(px, height(px, pz), pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }
}

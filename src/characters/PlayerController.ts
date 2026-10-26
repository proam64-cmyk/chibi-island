import { BoxGeometry, CapsuleGeometry, Group, Mesh, MeshToonMaterial, type Object3D, Vector3 } from 'three';
import { palette } from '../config/styleTokens';
import { worldScale } from '../config/worldScale';
import { angleDelta, cameraBasis, type HeightFn } from '../camera/cameraMath';
import type { InputState } from '../input/InputManager';
import { characterRamp } from '../render/materials/ToonMaterial';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/**
 * Phase 1 player: a 1.40 m debug capsule (the real, animated Rei arrives in Phases 6–7).
 * Camera-relative movement, run, jump, gravity and ground following on the height field.
 */
export class PlayerController {
  readonly root = new Group();
  readonly position = new Vector3();
  heading = 0; // radians, 0 = facing +Z
  velocityY = 0;
  grounded = true;
  speed = 0;
  /** Lowest ground height the player may walk onto (m). */
  minGround = -0.4;
  /** Meters walked on the ground and seconds spent moving, for checking travel times (reset with R). */
  odometer = 0;
  travelTime = 0;

  /** Holds the visible body (debug capsule or Rei); procedural motion is applied here, never to `root`. */
  readonly body = new Group();
  private capsule = new Group();
  private avatar: Object3D | null = null;
  private gait = 0;
  /** True when the avatar has real animations (procedural bob/sway disabled). */
  animatedAvatar = false;
  private time = 0;
  /** Solid obstacles (Rapier); null = terrain only. */
  physics: PhysicsWorld | null = null;
  /** Sitting on a seat (bench): movement locked until the player stands up. */
  seated: { x: number; y: number; z: number; heading: number; standX: number; standZ: number } | null = null;
  /** Last positions where the player stood safely (recovery, V2.0 §9). */
  private safe: Array<{ x: number; z: number }> = [];
  private safeTimer = 0;
  /** Number of automatic recoveries (shown in F3). */
  recoveries = 0;

  constructor(private heightAt: HeightFn) {
    const r = worldScale.capsuleRadius;
    const body = new Mesh(
      new CapsuleGeometry(r, worldScale.reiHeight - 2 * r, 6, 16),
      new MeshToonMaterial({ color: palette.rei.hair, gradientMap: characterRamp() }),
    );
    body.position.y = worldScale.reiHeight / 2;
    body.castShadow = true;
    const nose = new Mesh(new BoxGeometry(0.14, 0.1, 0.22), new MeshToonMaterial({ color: palette.rei.skin, gradientMap: characterRamp() }));
    nose.position.set(0, worldScale.reiHeight * 0.78, r + 0.06); // shows which way it faces (+Z local)
    nose.castShadow = true;
    this.capsule.add(body, nose);
    this.capsule.name = 'DebugCapsule';
    this.body.add(this.capsule);
    this.root.add(this.body);
    this.root.name = 'Player';
    this.teleport(0, 0);
  }

  resetOdometer(): void { this.odometer = 0; this.travelTime = 0; }

  teleport(x: number, z: number): void {
    this.resetOdometer();
    this.seated = null;
    if (this.physics) ({ x, z } = this.physics.findFreeSpot(x, z, this.heightAt)); // never inside a building
    this.position.set(x, this.heightAt(x, z), z);
    this.velocityY = 0;
    this.sync();
  }

  get isMoving(): boolean { return this.speed > 0.05; }

  /**
   * Uses a model (the static Rei) as the visible player. Until Rei is rigged (Phase 6) she moves with
   * simple procedural motion: a step bob, a forward lean when running and idle breathing.
   */
  setAvatar(model: Object3D, animated = false): void {
    this.animatedAvatar = animated;
    if (this.avatar) this.body.remove(this.avatar);
    this.avatar = model;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    this.body.add(model);
    this.capsule.visible = false;
  }

  /** Debug: show the collision capsule instead of the avatar (key C). */
  toggleCapsule(): void {
    if (!this.avatar) return;
    this.capsule.visible = !this.capsule.visible;
    this.avatar.visible = !this.capsule.visible;
  }

  get hasAvatar(): boolean { return this.avatar !== null; }

  /** Sits on a seat: the player moves onto it facing `heading`; standing up returns to (standX, standZ). */
  sit(x: number, y: number, z: number, heading: number, standX: number, standZ: number): void {
    this.seated = { x, y, z, heading, standX, standZ };
    this.speed = 0; this.velocityY = 0; this.grounded = true;
    this.position.set(x, y, z); this.heading = heading;
    this.sync();
  }

  standUp(): void {
    if (!this.seated) return;
    const { standX, standZ } = this.seated;
    this.seated = null;
    this.position.set(standX, this.heightAt(standX, standZ), standZ);
    this.sync();
  }

  update(dt: number, input: InputState, cameraYaw: number): void {
    if (this.seated) {
      if (Math.hypot(input.moveX, input.moveY) > 0.3 || input.jumpPressed) this.standUp();
      else { this.body.position.y = -0.42; this.body.rotation.set(0, 0, 0); this.time += dt; return; } // capsule shown seated
    }
    const { forward, right } = cameraBasis(cameraYaw);
    const mx = right.x * input.moveX + forward.x * input.moveY;
    const mz = right.z * input.moveX + forward.z * input.moveY;
    const len = Math.hypot(mx, mz);
    const target = len > 0.01 ? (input.run ? worldScale.speed.run : worldScale.speed.walk) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);

    const px = this.position.x, pz = this.position.z;
    if (len > 0.01) {
      const desired = Math.atan2(mx, mz);
      this.heading += angleDelta(this.heading, desired) * Math.min(1, dt * worldScale.turnRate);
      let ddx = (mx / len) * this.speed * dt, ddz = (mz / len) * this.speed * dt;
      if (this.physics) { const m = this.physics.moveHorizontal(this.position, ddx, ddz); ddx = m.x; ddz = m.z; } // buildings, trunks, props
      const nx = this.position.x + ddx;
      const nz = this.position.z + ddz;
      // Swimming arrives in Phase 9: until then the shoreline (water deeper than 0.4 m) blocks movement, sliding along it.
      if (this.heightAt(nx, nz) > this.minGround) { this.position.x = nx; this.position.z = nz; }
      else if (this.heightAt(nx, this.position.z) > this.minGround) this.position.x = nx;
      else if (this.heightAt(this.position.x, nz) > this.minGround) this.position.z = nz;
    }

    const moved = Math.hypot(this.position.x - px, this.position.z - pz);
    if (moved > 0) { this.odometer += moved; this.travelTime += dt; }
    const ground = this.heightAt(this.position.x, this.position.z);
    if (this.grounded && input.jumpPressed) { this.velocityY = worldScale.jumpVelocity; this.grounded = false; }
    this.velocityY -= worldScale.gravity * dt;
    this.position.y += this.velocityY * dt;
    if (this.position.y <= ground) { this.position.y = ground; this.velocityY = 0; this.grounded = true; }
    else if (this.grounded && this.position.y - ground < 0.25) { this.position.y = ground; this.velocityY = 0; } // stick to slopes
    else this.grounded = false;
    this.recover(dt);
    this.sync();
    this.animate(dt);
  }

  /** Keeps a trail of safe spots; if the player ends up inside a solid object, returns to the last one. */
  private recover(dt: number): void {
    if (!this.physics) return;
    this.safeTimer += dt;
    if (this.safeTimer < 0.25) return;
    this.safeTimer = 0;
    const p = this.position;
    if (this.physics.overlaps(p.x, p.y, p.z)) {
      const back = this.safe.pop() ?? this.physics.findFreeSpot(p.x, p.z, this.heightAt);
      p.set(back.x, this.heightAt(back.x, back.z), back.z);
      this.recoveries++;
    } else if (this.grounded) {
      this.safe.push({ x: p.x, z: p.z });
      if (this.safe.length > 10) this.safe.shift();
    }
  }

  private sync(): void {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.heading;
  }

  /** Procedural stand-in for animations (removed when the rigged Rei arrives). */
  private animate(dt: number): void {
    this.time += dt;
    const run = Math.min(1, this.speed / worldScale.speed.run);
    if (this.animatedAvatar) { // skeleton animations do the work; keep only a small lean in the air
      this.body.position.y = 0; this.body.rotation.set(this.grounded ? 0 : -0.06, 0, 0); this.body.scale.set(1, 1, 1);
      return;
    }
    this.gait += dt * (6 + 5 * run) * (this.speed > 0.05 ? 1 : 0);
    const step = this.speed > 0.05 && this.grounded ? Math.abs(Math.sin(this.gait)) : 0;
    this.body.position.y = step * (0.025 + 0.035 * run);
    this.body.rotation.x = this.grounded ? 0.12 * run : -0.06;
    this.body.rotation.z = this.speed > 0.05 ? Math.sin(this.gait) * 0.035 * (0.5 + run) : 0;
    const breathe = this.speed > 0.05 ? 0 : Math.sin(this.time * 2.2) * 0.008;
    this.body.scale.set(1, 1 + breathe, 1);
  }
}

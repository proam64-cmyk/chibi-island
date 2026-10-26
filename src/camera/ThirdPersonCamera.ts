import { PerspectiveCamera, Vector3 } from 'three';
import { cameraTokens } from '../config/styleTokens';
import type { InputManager } from '../input/InputManager';
import { angleDelta, clamp, dampFactor, orbitOffset, terrainSafeDistance, type HeightFn } from './cameraMath';

const DEG = Math.PI / 180;

export interface CameraTarget { position: Vector3; heading: number; isMoving: boolean }

/** Orbit camera around the character with smoothing, zoom limits, terrain collision and auto-recenter. */
export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera;
  yaw = 0;
  pitch = cameraTokens.pitchDeg.default * DEG;
  distance: number = cameraTokens.distance.default;
  sensitivity = 0.0045;

  private smoothedTarget = new Vector3();
  private currentDistance: number = cameraTokens.distance.default;
  private initialized = false;

  constructor(aspect: number, private input: InputManager, private heightAt: HeightFn) {
    this.camera = new PerspectiveCamera(cameraTokens.fovDeg, aspect, cameraTokens.near, cameraTokens.far);
  }

  update(dt: number, target: CameraTarget): void {
    const look = this.input.consumeLook();
    this.yaw -= look.dx * this.sensitivity;
    this.pitch = clamp(this.pitch + look.dy * this.sensitivity, cameraTokens.pitchDeg.min * DEG, cameraTokens.pitchDeg.max * DEG);
    this.distance = clamp(this.distance + this.input.consumeZoom(), cameraTokens.distance.min, cameraTokens.distance.max);

    // Ease back behind the character when it moves and the player isn't steering the camera.
    if (target.isMoving && this.input.idleCameraTime > cameraTokens.recenterDelay) {
      const behind = target.heading + Math.PI;
      this.yaw += angleDelta(this.yaw, behind) * Math.min(1, dt * 1.5);
    }

    const lookAt = new Vector3(target.position.x, target.position.y + cameraTokens.lookAtHeight, target.position.z);
    if (!this.initialized) { this.smoothedTarget.copy(lookAt); this.initialized = true; }
    this.smoothedTarget.lerp(lookAt, dampFactor(cameraTokens.followDamping, dt));

    const off = orbitOffset(this.yaw, this.pitch, this.distance);
    const safe = terrainSafeDistance(this.smoothedTarget, off, this.distance, this.heightAt, cameraTokens.collisionRadius + 0.15);
    // Pull in instantly when blocked, ease out when free (avoids popping).
    this.currentDistance = safe < this.currentDistance ? safe : this.currentDistance + (safe - this.currentDistance) * dampFactor(0.3, dt);
    const k = this.currentDistance / this.distance;
    this.camera.position.set(this.smoothedTarget.x + off.x * k, this.smoothedTarget.y + off.y * k, this.smoothedTarget.z + off.z * k);
    this.camera.lookAt(this.smoothedTarget);
  }

  resize(aspect: number): void { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}

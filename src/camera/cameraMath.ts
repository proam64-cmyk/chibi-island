/** Pure camera math (no three.js) so it can be unit-tested. Angles in radians. */
export interface Vec3 { x: number; y: number; z: number }
export type HeightFn = (x: number, z: number) => number;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Offset from the look-at point to the camera. yaw 0 = camera behind on +Z looking toward −Z. */
export function orbitOffset(yaw: number, pitch: number, distance: number): Vec3 {
  const c = Math.cos(pitch);
  return { x: Math.sin(yaw) * c * distance, y: Math.sin(pitch) * distance, z: Math.cos(yaw) * c * distance };
}

/** Horizontal forward/right unit vectors seen from the camera (for camera-relative movement). */
export function cameraBasis(yaw: number): { forward: { x: number; z: number }; right: { x: number; z: number } } {
  return { forward: { x: -Math.sin(yaw), z: -Math.cos(yaw) }, right: { x: Math.cos(yaw), z: -Math.sin(yaw) } };
}

/** Shortest signed angle from a to b, in (−π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Walks from the look-at point toward the desired camera position and stops before the camera
 * would go under the terrain (+ clearance). Returns the allowed distance.
 */
export function terrainSafeDistance(target: Vec3, offset: Vec3, distance: number, heightAt: HeightFn, clearance: number, steps = 24): number {
  if (distance <= 0) return 0;
  const ux = offset.x / distance, uy = offset.y / distance, uz = offset.z / distance;
  let safe = distance;
  for (let i = 1; i <= steps; i++) {
    const d = (distance * i) / steps;
    const x = target.x + ux * d, y = target.y + uy * d, z = target.z + uz * d;
    if (y < heightAt(x, z) + clearance) { safe = (distance * (i - 1)) / steps; break; }
  }
  return Math.max(safe, 0.6);
}

/** Frame-rate independent exponential smoothing factor for a settle time in seconds. */
export function dampFactor(settleSeconds: number, dt: number): number {
  if (settleSeconds <= 0) return 1;
  return 1 - Math.exp(-dt / (settleSeconds / 4));
}

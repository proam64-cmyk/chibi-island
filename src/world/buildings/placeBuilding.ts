import { Group, type Object3D } from 'three';

/**
 * Puts a building on the ground without touching the object's own transform: quantized GLBs
 * (KHR_mesh_quantization) keep a de-quantization offset/scale on the node, so we place a parent group instead.
 * Before 2026-10-25 the node position was overwritten and the villas ended up half-buried.
 */
export function placeBuilding(object: Object3D, x: number, y: number, z: number, rotationY: number): Group {
  const holder = new Group();
  object.removeFromParent();
  holder.add(object);
  holder.position.set(x, y, z);
  holder.rotation.y = rotationY;
  holder.updateMatrixWorld(true);
  return holder;
}

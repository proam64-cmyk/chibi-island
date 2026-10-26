import { Box3, Group, type Mesh, type Object3D, Vector3 } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toon } from '../config/styleTokens';
import { addOutline, toToonMaterial } from '../render/materials/ToonMaterial';
import { tf } from '../i18n/i18n';

export interface ReiValidation {
  loaded: boolean;
  height: number;
  feetOffset: number;
  ok: boolean;
  message: string;
}

/**
 * Places the static (unrigged) Rei as a loader/scale validation model (Phase 1 acceptance).
 * Not playable: the rig and animations come in Phase 6.
 */
export function placeReiStatic(gltf: GLTF, groundY: number, x: number, z: number, expectedHeight: number): { object: Object3D; validation: ReiValidation } {
  const root = new Group();
  root.name = 'ReiStatic';
  const model = gltf.scene;
  root.add(model);
  // Collect meshes first: adding outline children while traversing would visit them again (infinite recursion).
  const meshes: Mesh[] = [];
  model.traverse((o) => { if ((o as Mesh).isMesh) meshes.push(o as Mesh); });
  for (const m of meshes) {
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    m.material = toToonMaterial(src, 'character');
    m.castShadow = true;
  }
  root.position.set(x, groundY, z);
  root.updateMatrixWorld(true);

  // Measure before adding outlines so the hull doesn't inflate the result.
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const feetOffset = box.min.y - groundY;
  const okH = Math.abs(size.y - expectedHeight) <= 0.02;
  const okF = Math.abs(feetOffset) <= 0.02;
  for (const m of meshes) addOutline(m, toon.outlineCharacter.width, toon.outlineCharacter.color);
  return {
    object: root,
    validation: {
      loaded: true,
      height: size.y,
      feetOffset,
      ok: okH && okF,
      message: tf('rei.validation', { h: size.y.toFixed(3), e: expectedHeight.toFixed(2), f: (feetOffset >= 0 ? '+' : '') + feetOffset.toFixed(3) }),
    },
  };
}

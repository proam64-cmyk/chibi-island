import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { placeReiStatic } from '../../src/characters/ReiStatic';

/** Regression test for v0.1.0: outlines were added while traversing → infinite recursion (RangeError). */
describe('placeReiStatic', () => {
  it('adds exactly one outline per mesh, without recursion, and validates height/feet', () => {
    const scene = new Group();
    const body = new Mesh(new BoxGeometry(0.5, 1.4, 0.4), new MeshStandardMaterial());
    body.position.y = 0.7;
    const hair = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshStandardMaterial());
    hair.position.y = 0.4; // stays inside the 1.4 m body
    body.add(hair);
    scene.add(body);
    const { object, validation } = placeReiStatic({ scene } as unknown as GLTF, 3, 2.5, -3, 1.4);
    let outlines = 0, meshes = 0;
    object.traverse((o) => { if ((o as Mesh).isMesh) { meshes++; if (o.name.endsWith('_outline')) outlines++; } });
    expect(outlines).toBe(2);
    expect(meshes).toBe(4);
    expect(validation.height).toBeCloseTo(1.4, 3);
    expect(validation.feetOffset).toBeCloseTo(0, 3);
    expect(validation.ok).toBe(true);
  });
});

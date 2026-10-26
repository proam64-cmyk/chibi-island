import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Bone, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RiggedCharacter } from '../../src/characters/RiggedCharacter';

/** Drops images so the GLB can be parsed in Node (geometry, skin and animations only). */
function stripImages(buf: Buffer): ArrayBuffer {
  const jl = buf.readUInt32LE(12); const json = JSON.parse(buf.subarray(20, 20 + jl).toString());
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) { delete m.normalTexture; if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } }
  const js = Buffer.from(JSON.stringify(json)); const pad = (4 - (js.length % 4)) % 4; const jsonChunk = Buffer.concat([js, Buffer.alloc(pad, 0x20)]);
  const binStart = 20 + jl; const binLen = buf.readUInt32LE(binStart); const bin = buf.subarray(binStart + 8, binStart + 8 + binLen);
  const out = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonChunk.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(out, 20);
  const b = 20 + jsonChunk.length; out.writeUInt32LE(bin.length, b); out.writeUInt32LE(0x004e4942, b + 4); bin.copy(out, b + 8);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

const FILE = 'assets/characters/alana/chr_alana_v001.glb';
describe.skipIf(!existsSync(FILE))('rigged character (Alana, main player)', () => {
  const load = async () => new RiggedCharacter(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripImages(readFileSync(FILE)), ''));
  const handY = (rei: RiggedCharacter) => {
    let hand: Bone | null = null;
    rei.object.traverse((o) => { if (!hand && (o as Bone).isBone && o.name.endsWith('LeftHand')) hand = o as Bone; });
    rei.object.updateMatrixWorld(true);
    return (hand as unknown as Bone).getWorldPosition(new Vector3()).y;
  };
  it('is scaled to 1.40 m with the feet on the ground and has idle, walk and run', async () => {
    const rei = await load();
    expect(rei.validation.ok).toBe(true);
    expect(rei.clipNames).toEqual(['idle', 'walk', 'run']);
  });
  it('the generated idle lowers the arms from the A-pose', async () => {
    const rei = await load();
    const bind = handY(rei);
    rei.update(1, 0, true);
    expect(handY(rei)).toBeLessThan(bind - 0.03);
  });
  it('has the emotes from the Meshy export and can play and cancel one', async () => {
    const rei = await load();
    expect(rei.availableEmotes).toEqual(['dance']);   // Alana's export: 6 dances, no backflip/pitch
    expect(rei.emoteClips('dance').length).toBe(6);
    expect(rei.playEmote('backflip')).toBe(false);    // no fake emote when the clip does not exist
    expect(rei.playEmote('dance')).toBe(true);
    rei.update(0.5, 0, true);
    expect(rei.emoting).toBe(true);
    rei.update(0.1, 2.2, true); // moving cancels it
    expect(rei.emoting).toBe(false);
  });
  it('clips do not move Rei horizontally (root motion stripped)', async () => {
    const rei = await load();
    let hips: Bone | null = null;
    rei.object.traverse((o) => { if (!hips && (o as Bone).isBone && o.name.endsWith('Hips')) hips = o as Bone; });
    const h = hips as unknown as Bone;
    rei.playEmote('dance');
    rei.update(0.1, 0, true);
    const a = h.position.clone();
    for (let i = 0; i < 20; i++) rei.update(0.1, 0, true);
    expect(Math.hypot(h.position.x - a.x, h.position.z - a.z)).toBeLessThan(0.05);
  });
  it('walking and running move the legs (pose changes over time)', async () => {
    const rei = await load();
    rei.update(0.5, 0, true);
    const idle = handY(rei);
    rei.update(0.3, 4.5, true);
    expect(Math.abs(handY(rei) - idle)).toBeGreaterThan(0.01);
  });
});

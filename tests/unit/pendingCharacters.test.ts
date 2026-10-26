import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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

import { readdirSync } from 'node:fs';
const ROOT = 'assets/characters';
// Every delivered character (verified ones in their ID folder and the pending ones) must work with the game's system.
const files = existsSync(ROOT) ? readdirSync(ROOT).flatMap((d) => readdirSync(`${ROOT}/${d}`).filter((f) => f.endsWith('.glb')).map((f) => `${d}/${f}`)) : [];
describe.skipIf(!files.length)('delivered characters work with the rigged-character system', () => {
  for (const f of files) it(f, async () => {
    const c = new RiggedCharacter(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripImages(readFileSync(`${ROOT}/${f}`)), ''));
    expect(c.validation.ok, c.validation.message).toBe(true);          // 1.40 m, feet on the ground
    expect(c.clipNames).toEqual(['idle', 'walk', 'run']);               // generated idle + Meshy walk/run
  }, 20000);
});

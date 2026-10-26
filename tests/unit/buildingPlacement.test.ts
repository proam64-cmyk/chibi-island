import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { placeBuilding } from '../../src/world/buildings/placeBuilding';
import { buildings } from '../../src/config/buildings';

const KITS: Record<string, string> = { env_villas: 'assets/environment/env_villas_v004.glb', env_town: 'assets/environment/env_town_buildings_v001.glb' };
/** Drops images so the GLB parses in Node. */
function noImages(buf: Buffer): ArrayBuffer {
  const jl = buf.readUInt32LE(12); const json = JSON.parse(buf.subarray(20, 20 + jl).toString());
  delete json.images; delete json.textures; delete json.samplers; for (const m of json.materials) delete m.pbrMetallicRoughness?.baseColorTexture;
  json.extensionsRequired = (json.extensionsRequired ?? []).filter((e: string) => e !== 'EXT_texture_webp');
  const js = Buffer.from(JSON.stringify(json)); const jc = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bs = 20 + jl, bl = buf.readUInt32LE(bs), bin = buf.subarray(bs + 8, bs + 8 + bl);
  const out = Buffer.alloc(28 + jc.length + bin.length); out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(jc.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jc.copy(out, 20); const b = 20 + jc.length; out.writeUInt32LE(bin.length, b); out.writeUInt32LE(0x004e4942, b + 4); bin.copy(out, b + 8);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

describe('building placement (real kits)', () => {
  it('every building stands ON the ground at its spot (base within ±5 cm), never half-buried', async () => {
    for (const b of buildings.filter((q) => q.node && existsSync(KITS[q.asset] ?? ''))) {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(noImages(readFileSync(KITS[b.asset])), '');
      const node = gltf.scene.getObjectByName(b.node!)!;
      const g = placeBuilding(node, 100, 7, -50, 1.1);
      const box = new Box3().setFromObject(g);
      // placeBuilding puts the base exactly at the y it is given (IslandScene passes ground − baseSink).
      expect(box.min.y, b.node).toBeGreaterThan(7 - 0.05);
      expect(box.min.y, b.node).toBeLessThan(7 + 0.05);
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      expect(Math.hypot(cx - 100, cz + 50), `${b.node} centred`).toBeLessThan(1.5);
    }
  }, 30000);
});

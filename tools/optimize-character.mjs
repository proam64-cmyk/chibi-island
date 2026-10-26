// Optimizes a rigged, animated character GLB without touching geometry, skin or animations.
// Usage: node optimize-character.mjs <in.glb> <out.glb> [textureSize=2048]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, size = '2048'] = process.argv.slice(2);
// DROP_FINGERS=1 removes finger-bone animation channels (invisible at chibi scale, ~60 % of the animation data).
const dropFingers = process.env.DROP_FINGERS === '1';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
for (const mat of doc.getRoot().listMaterials()) mat.setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(1).setName('M_Rei_Body');
if (dropFingers) {
  for (const anim of doc.getRoot().listAnimations()) for (const ch of anim.listChannels()) {
    const n = ch.getTargetNode()?.getName() ?? '';
    if (/Hand(Thumb|Index|Middle|Ring|Pinky)\d/.test(n)) { ch.getSampler()?.dispose(); ch.dispose(); }
  }
}
// BASE_COLOR / NORMAL_MAP = padded images from tools/dilate_uv_textures.py (no seam bleeding after downscaling).
if (process.env.BASE_COLOR || process.env.NORMAL_MAP) {
  const fs = await import('fs');
  for (const mat of doc.getRoot().listMaterials()) {
    if (process.env.BASE_COLOR && mat.getBaseColorTexture()) mat.getBaseColorTexture().setImage(new Uint8Array(fs.readFileSync(process.env.BASE_COLOR))).setMimeType('image/png');
    if (process.env.NORMAL_MAP && mat.getNormalTexture()) mat.getNormalTexture().setImage(new Uint8Array(fs.readFileSync(process.env.NORMAL_MAP))).setMimeType('image/png');
  }
}
const s = Number(size);
// NORMAL_SIZE: the normal map can be smaller than the base color (fine detail is in the colors).
const ns = Number(process.env.NORMAL_SIZE || s);
await doc.transform(resample({ tolerance: 1e-4 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [s, s], quality: 88, slots: /baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [ns, ns], quality: 85, slots: /normal/ }),
  dedup(), prune());
// QUANTIZE=1: KHR_mesh_quantization (16-bit positions/UVs, 8-bit normals) — read natively by three.js, ~half the geometry size.
if (process.env.QUANTIZE === '1') await doc.transform(quantize());
// MESHOPT=1: EXT_meshopt_compression (geometry + animation); the game registers three's MeshoptDecoder.
if (process.env.MESHOPT === '1') await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
const root = doc.getRoot();
console.log(JSON.stringify({ animations: root.listAnimations().map((a) => a.getName()), skins: root.listSkins().length, textures: root.listTextures().length }));

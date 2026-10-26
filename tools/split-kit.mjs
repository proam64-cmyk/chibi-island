// Splits a multi-building Meshy GLB into one GLB with one named mesh per building, all sharing the same
// texture (no duplicated atlas). Each building is re-centred on its own base (x/z centre, y = 0) and scaled
// by SCALE (model units → meters), with its front kept on +Z.
// HEIGHTS=15,17,15,9.6 sets each building's height in meters (in left-to-right order) instead of one SCALE,
// for kits whose buildings were generated at different implied scales.
// Usage: [SCALE=18] [PREFIX=villa] [MIN_PART_TRIS=1000] [TEX_SIZE=4096] [NORMAL_SIZE=1024] [BASE_COLOR=padded.png]
//        node split-kit.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inp, out] = process.argv.slice(2);
const SCALE = Number(process.env.SCALE || 18), PREFIX = process.env.PREFIX || 'building', MIN = Number(process.env.MIN_PART_TRIS || 1000);
const doc = await io.read(inp);
const root = doc.getRoot(), scene = root.listScenes()[0];
const srcNode = root.listNodes().find((n) => n.getMesh());
const srcPrim = srcNode.getMesh().listPrimitives()[0];
const mat = srcPrim.getMaterial();
mat.setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(1).setName(`M_${PREFIX}`);
if (process.env.BASE_COLOR) mat.getBaseColorTexture().setImage(new Uint8Array(fs.readFileSync(process.env.BASE_COLOR))).setMimeType('image/png');
if (process.env.NO_NORMAL === '1') mat.setNormalTexture(null);

const pos = srcPrim.getAttribute('POSITION').getArray(), nrm = srcPrim.getAttribute('NORMAL')?.getArray(), uv = srcPrim.getAttribute('TEXCOORD_0').getArray();
const idx = srcPrim.getIndices().getArray();
// connected components on welded positions
const key = new Map(), pid = new Int32Array(pos.length / 3);
for (let i = 0; i < pid.length; i++) { const k = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`; if (!key.has(k)) key.set(k, key.size); pid[i] = key.get(k); }
const parent = Int32Array.from({ length: key.size }, (_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
for (let t = 0; t < idx.length; t += 3) { const a = find(pid[idx[t]]); parent[find(pid[idx[t + 1]])] = a; parent[find(pid[idx[t + 2]])] = a; }
const parts = new Map();
for (let t = 0; t < idx.length; t += 3) { const r = find(pid[idx[t]]); let p = parts.get(r); if (!p) parts.set(r, (p = { tris: [], sx: 0 })); p.tris.push(t); p.sx += pos[idx[t] * 3]; }
const chosen = [...parts.values()].filter((p) => p.tris.length >= MIN).sort((a, b) => a.sx / a.tris.length - b.sx / b.tris.length);
const letters = 'abcdefghijklmnop';
const report = [];
const HEIGHTS = process.env.HEIGHTS ? process.env.HEIGHTS.split(',').map(Number) : null;
chosen.forEach((p, n) => {
  const remap = new Map(), P = [], N = [], U = [], I = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const t of p.tris) for (let c = 0; c < 3; c++) { const v = idx[t + c]; minX = Math.min(minX, pos[v * 3]); maxX = Math.max(maxX, pos[v * 3]); minY = Math.min(minY, pos[v * 3 + 1]); maxY = Math.max(maxY, pos[v * 3 + 1]); minZ = Math.min(minZ, pos[v * 3 + 2]); maxZ = Math.max(maxZ, pos[v * 3 + 2]); }
  const SC = HEIGHTS ? HEIGHTS[n] / (maxY - minY) : SCALE;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (const t of p.tris) for (let c = 0; c < 3; c++) {
    const v = idx[t + c];
    if (!remap.has(v)) {
      remap.set(v, P.length / 3);
      P.push((pos[v * 3] - cx) * SC, (pos[v * 3 + 1] - minY) * SC, (pos[v * 3 + 2] - cz) * SC);
      if (nrm) N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
      U.push(uv[v * 2], uv[v * 2 + 1]);
    }
    I.push(remap.get(v));
  }
  const name = `${PREFIX}_${letters[n]}`;
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(P)))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(U)))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(I)));
  if (nrm) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(N)));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  report.push({ name, tris: p.tris.length, size: [((maxX - minX) * SC).toFixed(1), ((maxZ - minZ) * SC).toFixed(1), ((maxY - minY) * SC).toFixed(1)] });
});
srcNode.dispose();
const s = Number(process.env.TEX_SIZE || 4096), ns = Number(process.env.NORMAL_SIZE || 1024);
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [s, s], quality: 88, slots: /baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [ns, ns], quality: 85, slots: /normal/ }),
  dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
console.log(JSON.stringify(report));

// Prototype of tools/optimize-assets.mjs for static props.
// Usage: [ASSET_NAME=Name] [TEX_SIZE=1024|2048] [PIVOT=base] [MIN_PART_TRIS=N] [ROT_Y=deg] [BASE_COLOR=file] [KEEP_PART=k] [NO_NORMAL=1] node optimize-prop.mjs <in.glb> <out.glb> <targetTris> <heightMeters>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress, getBounds, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, targetTris, heightM] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inp);
const root = doc.getRoot();
const countTris = () => root.listMeshes().flatMap(m => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);

const before = countTris();
// 1. Toon pipeline uses base color (+normal). Drop metallic/roughness.
for (const mat of root.listMaterials()) {
  mat.setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(1);
  mat.setName('M_' + (process.env.ASSET_NAME || 'prop'));
  if (process.env.NO_NORMAL === '1') mat.setNormalTexture(null); // big, far-away assets: normal map adds little
}
// 1b. MIN_PART_TRIS=N: delete loose parts smaller than N triangles (hidden/floating fragments).
const minPart = Number(process.env.MIN_PART_TRIS || 0);
const keepPart = process.env.KEEP_PART !== undefined ? Number(process.env.KEEP_PART) : -1;
if (minPart > 0 || keepPart >= 0) {
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idxAcc = prim.getIndices(); if (!idxAcc) continue;
    const idx = Array.from(idxAcc.getArray()); const key = new Map(); const pid = new Int32Array(pos.getCount()); const v=[0,0,0];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); const k = v.map(x => x.toFixed(5)).join(',');
      if (!key.has(k)) key.set(k, key.size); pid[i] = key.get(k); }
    const parent = Int32Array.from({ length: key.size }, (_, i) => i);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let t = 0; t < idx.length; t += 3) { const a = find(pid[idx[t]]); parent[find(pid[idx[t+1]])] = a; parent[find(pid[idx[t+2]])] = a; }
    const size = new Map();
    for (let t = 0; t < idx.length; t += 3) { const r = find(pid[idx[t]]); size.set(r, (size.get(r) || 0) + 1); }
    // KEEP_PART=k: keep only the k-th loose part, parts ordered left→right by centroid X.
    let only = null;
    if (keepPart >= 0) {
      const cx = new Map();
      for (let t = 0; t < idx.length; t += 3) { const r = find(pid[idx[t]]); pos.getElement(idx[t], v); const c = cx.get(r) || [0, 0]; c[0] += v[0]; c[1]++; cx.set(r, c); }
      const order = [...cx.entries()].filter(([r]) => size.get(r) >= Math.max(minPart, 1)).sort((a, b) => a[1][0]/a[1][1] - b[1][0]/b[1][1]);
      only = order[keepPart][0];
    }
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) { const r = find(pid[idx[t]]);
      if (size.get(r) >= minPart && (only === null || r === only)) keep.push(idx[t], idx[t+1], idx[t+2]); }
    const removed = (idx.length - keep.length) / 3;
    if (removed) { idxAcc.setArray(new Uint32Array(keep)); console.log(`removed ${removed} tris in loose parts < ${minPart}`); }
  }
}
// 2. Simplify to target triangle count (UV seams preserved by weld rules).
await doc.transform(weld());
let ratio = Math.min(1, Number(targetTris) / countTris()); // after loose parts / KEEP_PART
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02, lockBorder: false }));
// 2b. ROT_Y=deg: rotate around Y so the asset's front faces +Z.
if (process.env.ROT_Y) {
  const a = Number(process.env.ROT_Y) * Math.PI / 360;
  for (const node of root.listScenes()[0].listChildren()) {
    const q = node.getRotation(), r = [0, Math.sin(a), 0, Math.cos(a)];
    // r * q
    node.setRotation([r[3]*q[0]+r[0]*q[3]+r[1]*q[2]-r[2]*q[1], r[3]*q[1]-r[0]*q[2]+r[1]*q[3]+r[2]*q[0], r[3]*q[2]+r[0]*q[1]-r[1]*q[0]+r[2]*q[3], r[3]*q[3]-r[0]*q[0]-r[1]*q[1]-r[2]*q[2]]);
    const t = node.getTranslation(); const c = Math.cos(2*a), s2 = Math.sin(2*a);
    node.setTranslation([t[0]*c + t[2]*s2, t[1], -t[0]*s2 + t[2]*c]);
  }
}
// 3. Scale to real height, pivot at ground center.
const scene = root.listScenes()[0];
let b = getBounds(scene);
const s = Number(heightM) / (b.max[1] - b.min[1]);
for (const node of scene.listChildren()) {
  const t = node.getTranslation(), sc = node.getScale();
  node.setScale([sc[0]*s, sc[1]*s, sc[2]*s]);
  node.setTranslation([t[0]*s, t[1]*s, t[2]*s]);
}
b = getBounds(scene);
let cx = (b.min[0]+b.max[0])/2, cz = (b.min[2]+b.max[2])/2;
// PIVOT=base: center on the footprint (vertices in the lowest 3 % of height), e.g. tree trunks.
if (process.env.PIVOT === 'base') {
  const h = b.max[1] - b.min[1]; let sx = 0, sz = 0, n = 0;
  for (const node of scene.listChildren()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix(); const v = [0,0,0];
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const x = M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12], y = M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13], z = M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14];
        if (y < b.min[1] + 0.03*h) { sx += x; sz += z; n++; }
      }
    }
  }
  if (n) { cx = sx/n; cz = sz/n; }
}
for (const node of scene.listChildren()) {
  const t = node.getTranslation();
  node.setTranslation([t[0]-cx, t[1]-b.min[1], t[2]-cz]);
}
// 3b. BASE_COLOR=file: swap the base color image (e.g. palette recolor).
if (process.env.BASE_COLOR) {
  const fs = await import('fs');
  for (const mat of root.listMaterials()) { const t = mat.getBaseColorTexture();
    if (t) { t.setImage(new Uint8Array(fs.readFileSync(process.env.BASE_COLOR))); t.setMimeType(process.env.BASE_COLOR.endsWith('.png') ? 'image/png' : 'image/jpeg'); } }
}
// 4. Textures: 1024, WebP.
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(process.env.TEX_SIZE||1024), Number(process.env.TEX_SIZE||1024)], quality: 88 }),
  dedup(), prune()
);
// QUANTIZE=1: KHR_mesh_quantization (16-bit positions/UVs, 8-bit normals) — read natively by three.js, ~half the geometry size.
if (process.env.QUANTIZE === '1') await doc.transform(quantize());
// MESHOPT=1: EXT_meshopt_compression (geometry + animation); the game registers three's MeshoptDecoder.
if (process.env.MESHOPT === '1') await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(out, doc);
b = getBounds(scene);
console.log(JSON.stringify({ trisBefore: before, trisAfter: countTris(),
  bounds: { min: b.min.map(v=>+v.toFixed(3)), max: b.max.map(v=>+v.toFixed(3)) } }));

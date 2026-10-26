/**
 * Rewrites a GLB so that embedded images become `data:` URIs instead of buffer views.
 * three's GLTFLoader would otherwise decode them through blob: URLs, which strict
 * hosting policies (like published claude.ai pages) can block. Geometry is untouched.
 */
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface GltfJson { images?: Array<{ bufferView?: number; mimeType?: string; uri?: string }>; bufferViews: Array<{ byteOffset?: number; byteLength: number }> }

export function glbImagesToDataUris(glb: ArrayBuffer): ArrayBuffer {
  const view = new DataView(glb);
  if (view.getUint32(0, true) !== GLB_MAGIC) return glb; // not a GLB (e.g. .gltf JSON) → leave as is
  let off = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  while (off < glb.byteLength) {
    const len = view.getUint32(off, true), type = view.getUint32(off + 4, true);
    const data = new Uint8Array(glb, off + 8, len);
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(data)) as GltfJson;
    else if (type === CHUNK_BIN) bin = data;
    off += 8 + len;
  }
  if (!json || !bin || !json.images?.length) return glb;
  let changed = false;
  for (const img of json.images) {
    if (img.bufferView === undefined) continue;
    const bv = json.bufferViews[img.bufferView];
    const bytes = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    img.uri = `data:${img.mimeType ?? 'image/png'};base64,${bytesToBase64(bytes)}`;
    delete img.bufferView;
    changed = true;
  }
  if (!changed) return glb;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (jsonBytes.length % 4)) % 4;
  if (pad) { const p = new Uint8Array(jsonBytes.length + pad); p.set(jsonBytes); p.fill(0x20, jsonBytes.length); jsonBytes = p; }
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new ArrayBuffer(total);
  const ov = new DataView(out), ou = new Uint8Array(out);
  ov.setUint32(0, GLB_MAGIC, true); ov.setUint32(4, 2, true); ov.setUint32(8, total, true);
  ov.setUint32(12, jsonBytes.length, true); ov.setUint32(16, CHUNK_JSON, true); ou.set(jsonBytes, 20);
  const b = 20 + jsonBytes.length;
  ov.setUint32(b, bin.length, true); ov.setUint32(b + 4, CHUNK_BIN, true); ou.set(bin, b + 8);
  return out;
}

/** Decodes a `data:` URL without fetch (also blocked by strict hosting policies). */
export function dataUrlToArrayBuffer(url: string): ArrayBuffer {
  const comma = url.indexOf(',');
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  const bytes = meta.endsWith(';base64') ? base64ToBytes(payload) : new TextEncoder().encode(decodeURIComponent(payload));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { phase1Manifest, validateManifest } from '../../src/assets/AssetManifest';
import { bytesToBase64, dataUrlToArrayBuffer, glbImagesToDataUris } from '../../src/assets/glbImages';

describe('AssetManifest', () => {
  it('the Phase 1 manifest is valid', () => {
    expect(validateManifest(phase1Manifest)).toEqual([]);
  });
  it('rejects bad ids, duplicates, non-GLB urls and bad heights', () => {
    const problems = validateManifest([
      { id: 'Rei Static', url: 'a.glb', kind: 'gltf', label: 'x' },
      { id: 'dup', url: 'a.glb', kind: 'gltf', label: 'x' },
      { id: 'dup', url: 'b.png', kind: 'gltf', label: 'x', expectedHeight: -1 },
    ]);
    expect(problems.length).toBe(4);
  });
  it('every manifest file exists on disk', () => {
    for (const e of phase1Manifest) expect(() => readFileSync(fileURLToPath(e.url))).not.toThrow();
  });
});

describe('glbImagesToDataUris', () => {
  it('moves embedded textures to data: URIs and keeps a valid GLB', () => {
    const file = readFileSync(fileURLToPath(phase1Manifest[0].url));
    const out = glbImagesToDataUris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const v = new DataView(out);
    expect(v.getUint32(0, true)).toBe(0x46546c67);
    expect(v.getUint32(8, true)).toBe(out.byteLength);
    const jsonLen = v.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(out, 20, jsonLen)));
    expect(json.images.length).toBeGreaterThan(0);
    for (const img of json.images) {
      expect(img.bufferView).toBeUndefined();
      expect(img.uri).toMatch(/^data:image\/(webp|png|jpeg);base64,/);
    }
  });
  it('round-trips data: URLs without fetch', () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    const buf = dataUrlToArrayBuffer('data:application/octet-stream;base64,' + bytesToBase64(bytes));
    expect([...new Uint8Array(buf)]).toEqual([1, 2, 3, 250]);
  });
});

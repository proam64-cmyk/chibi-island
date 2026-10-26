"""Extends every UV island of a GLB's base-color and normal textures outward (texture "gutter"), so
downscaling and mipmaps don't bleed dark/background pixels across seams (thin lines on the face, etc.).
Usage: python3 tools/dilate_uv_textures.py in.glb out_dir/   → writes base_color.png and normal.png
Requires numpy, pillow, scipy."""
import sys, json, struct, io, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
Image.MAX_IMAGE_PIXELS = None

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
d = open(src, 'rb').read(); off = 12; ch = {}
while off < len(d):
    l, t = struct.unpack('<I4s', d[off:off + 8]); ch[t] = d[off + 8:off + 8 + l]; off += 8 + l
g = json.loads(ch[b'JSON']); b = ch[b'BIN\x00']
CT = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}; NC = {'SCALAR': 1, 'VEC2': 2}
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); st = bv.get('byteStride') or dt.itemsize * n
    raw = np.frombuffer(b, np.uint8, count=st * (a['count'] - 1) + dt.itemsize * n, offset=o)
    return np.frombuffer(np.lib.stride_tricks.as_strided(raw, (a['count'], dt.itemsize * n), (st, 1)).copy().tobytes(), dt).reshape(a['count'], n)
pr = g['meshes'][0]['primitives'][0]
UV = acc(pr['attributes']['TEXCOORD_0']).astype(float); F = acc(pr['indices']).astype(int).reshape(-1, 3)
mat = g['materials'][0]
for key, name in [(mat['pbrMetallicRoughness'].get('baseColorTexture'), 'base_color'), (mat.get('normalTexture'), 'normal')]:
    if not key: continue
    img_i = g['textures'][key['index']]['source']; bv = g['bufferViews'][g['images'][img_i]['bufferView']]; o = bv.get('byteOffset', 0)
    T = np.array(Image.open(io.BytesIO(b[o:o + bv['byteLength']])).convert('RGB')); H, W, _ = T.shape
    mask = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(mask)
    for f in F: dr.polygon([(UV[i, 0] * W, UV[i, 1] * H) for i in f], fill=255)
    M = ndimage.binary_erosion(np.array(mask) > 0, iterations=1)   # trust only the inside of each island
    idx = ndimage.distance_transform_edt(~M, return_distances=False, return_indices=True)
    Image.fromarray(T[idx[0], idx[1]]).save(os.path.join(out, name + '.png'))
    print(name, W, H, 'island coverage %.1f%%' % (100 * M.mean()))

"""Character verification sheet: renders a character GLB (bind pose) from the front, side, back and 3/4,
plus a face close-up, with per-pixel texturing — to compare against the approved reference image before a
model is bound to a character ID (Character Visual Recognition System, "inspect the GLB visually").

Usage: python3 tools/character_sheet.py model.glb out.png ["Label shown on the sheet"]
Requires numpy + pillow. Works with raw Meshy exports (float positions, one or more meshes)."""
import sys, json, struct, io
import numpy as np
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None

src, out = sys.argv[1], sys.argv[2]
label = sys.argv[3] if len(sys.argv) > 3 else src.split('/')[-1]
d = open(src, 'rb').read(); off = 12; ch = {}
while off < len(d):
    l, t = struct.unpack('<I4s', d[off:off + 8]); ch[t] = d[off + 8:off + 8 + l]; off += 8 + l
g = json.loads(ch[b'JSON']); b = ch[b'BIN\x00']
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]; dt = np.dtype(CT[a['componentType']]); st = bv.get('byteStride') or dt.itemsize * n
    raw = np.frombuffer(b, np.uint8, count=st * (a['count'] - 1) + dt.itemsize * n, offset=o)
    v = np.frombuffer(np.lib.stride_tricks.as_strided(raw, (a['count'], dt.itemsize * n), (st, 1)).copy().tobytes(), dt).reshape(a['count'], n).astype(float)
    if a.get('normalized'): v = np.maximum(v / float(np.iinfo(dt).max), -1)
    return v
def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    t = np.array(n.get('translation', [0, 0, 0])); s = np.array(n.get('scale', [1, 1, 1])); x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M
texcache = {}
def base_tex(mat_i):
    m = g['materials'][mat_i] if mat_i is not None else {}
    bct = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if not bct: return None
    tx = g['textures'][bct['index']]; srci = tx.get('source', tx.get('extensions', {}).get('EXT_texture_webp', {}).get('source'))
    if srci not in texcache:
        bv = g['bufferViews'][g['images'][srci]['bufferView']]; o = bv.get('byteOffset', 0)
        im = Image.open(io.BytesIO(b[o:o + bv['byteLength']])).convert('RGB'); im.thumbnail((2048, 2048))
        texcache[srci] = np.array(im)
    return texcache[srci]
parts = []
def walk(ni, parent):
    n = g['nodes'][ni]; M = parent @ node_mat(n)
    if 'mesh' in n and 'skin' not in n:  # skinned meshes are drawn in bind pose (their node transform is ignored by glTF)
        pass
    if 'mesh' in n:
        Mm = M if 'skin' not in n else np.eye(4)
        for pr in g['meshes'][n['mesh']]['primitives']:
            P = acc(pr['attributes']['POSITION']); P = (np.c_[P, np.ones(len(P))] @ Mm.T)[:, :3]
            UV = acc(pr['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in pr['attributes'] else np.zeros((len(P), 2))
            F = acc(pr['indices']).astype(int).reshape(-1, 3) if 'indices' in pr else np.arange(len(P)).reshape(-1, 3)
            parts.append((P, UV, F, base_tex(pr.get('material'))))
    for c in n.get('children', []): walk(c, M)
for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, np.eye(4))
allP = np.vstack([p[0] for p in parts]); mn, mx = allP.min(0), allP.max(0)
H = mx[1] - mn[1]; ctr = (mn + mx) / 2

def rot(ay, ax=0):
    cy, sy = np.cos(ay), np.sin(ay); cx, sx = np.cos(ax), np.sin(ax)
    return np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
def render(R, S, cx, cy, span):
    img = np.full((S, S, 3), 236, np.uint8); zb = np.full((S, S), -1e9); sc = S / span
    for P, UV, F, T in parts:
        V = (P - ctr) @ R.T; X = (V[:, 0] - cx) * sc + S / 2; Y = S / 2 - (V[:, 1] - cy) * sc; Z = V[:, 2]
        nrm = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); nz = nrm[:, 2] / (np.linalg.norm(nrm, axis=1) + 1e-12)
        for k, f in enumerate(F):
            xs, ys = X[f], Y[f]
            x0, x1 = int(max(0, np.floor(xs.min()))), int(min(S - 1, np.ceil(xs.max()))); y0, y1 = int(max(0, np.floor(ys.min()))), int(min(S - 1, np.ceil(ys.max())))
            if x1 < x0 or y1 < y0: continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            dd = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(dd) < 1e-9: continue
            l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / dd; l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / dd; l2 = 1 - l0 - l1
            m = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
            if not m.any(): continue
            z = l0 * Z[f[0]] + l1 * Z[f[1]] + l2 * Z[f[2]]
            yy, xx = np.nonzero(m); zz = z[m]; w = zz > zb[y0 + yy, x0 + xx]
            if not w.any(): continue
            zb[y0 + yy[w], x0 + xx[w]] = zz[w]
            if T is None: col = np.array([200, 200, 210])
            else:
                TH, TW, _ = T.shape
                u = (l0 * UV[f[0], 0] + l1 * UV[f[1], 0] + l2 * UV[f[2], 0])[m][w]; v = (l0 * UV[f[0], 1] + l1 * UV[f[1], 1] + l2 * UV[f[2], 1])[m][w]
                col = T[np.clip((v * TH).astype(int), 0, TH - 1), np.clip((u * TW).astype(int), 0, TW - 1)]
            img[y0 + yy[w], x0 + xx[w]] = (col * (0.72 + 0.28 * abs(nz[k]))).astype(np.uint8)
    return Image.fromarray(img)
S = 480; span = H * 1.08
views = [('Frente', rot(0)), ('Lado', rot(-np.pi / 2)), ('Detras', rot(np.pi)), ('3/4', rot(-np.pi / 5, np.radians(8)))]
sheet = Image.new('RGB', (S * 5, S + 40), 'white'); dr = ImageDraw.Draw(sheet)
for i, (name, R) in enumerate(views):
    sheet.paste(render(R, S, 0, 0, span), (S * i, 40)); dr.text((S * i + 8, 46), name, fill=(0, 0, 0))
face_span = H * 0.30
sheet.paste(render(rot(0), S, 0, H * 0.33, face_span), (S * 4, 40)); dr.text((S * 4 + 8, 46), 'Cara', fill=(0, 0, 0))
tris = sum(len(p[2]) for p in parts)
dr.text((8, 10), f'{label}  ·  {tris:,} triangulos  ·  altura modelo {H:.3f} u  ·  skins: {len(g.get("skins", []))}  ·  animaciones: {len(g.get("animations", []))}', fill=(0, 0, 0))
sheet.save(out); print('sheet', out, 'tris', tris)

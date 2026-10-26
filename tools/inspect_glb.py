# Reproducible GLB inspector for Chibi Island asset intake.
# Usage: python3 tools/inspect_glb.py <file.glb>
# Requires: Python 3, numpy. Read-only: never modifies the input file.
import struct, json, sys, numpy as np
p = sys.argv[1]
data = open(p,'rb').read()
magic, ver, length = struct.unpack('<4sII', data[:12])
off = 12; chunks = {}
while off < len(data):
    clen, ctype = struct.unpack('<I4s', data[off:off+8]); chunks[ctype] = data[off+8:off+8+clen]; off += 8+clen
g = json.loads(chunks[b'JSON']); bin_ = chunks.get(b'BIN\x00', b'')
print("asset:", g.get('asset'))
print("extensionsUsed:", g.get('extensionsUsed')); print("extensionsRequired:", g.get('extensionsRequired'))
for k in ['scenes','nodes','meshes','materials','textures','images','samplers','skins','animations','accessors','bufferViews','cameras']:
    print(f"{k}: {len(g.get(k,[]))}")
print("\n--- NODES ---")
for i,n in enumerate(g.get('nodes',[])):
    print(i, {k:v for k,v in n.items()})
CT = {5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset',0)+a.get('byteOffset',0); n = NC[a['type']]; dt = CT[a['componentType']]
    stride = bv.get('byteStride')
    isz = np.dtype(dt).itemsize*n
    if stride and stride != isz:
        raw = np.frombuffer(bin_, np.uint8, count=stride*a['count'], offset=o).reshape(a['count'],stride)[:,:isz]
        arr = np.frombuffer(raw.tobytes(), dt).reshape(a['count'],n)
    else:
        arr = np.frombuffer(bin_, dt, count=a['count']*n, offset=o).reshape(a['count'],n)
    return arr, a
print("\n--- MESHES ---")
totv=tott=0
for mi,m in enumerate(g['meshes']):
    for pi,pr in enumerate(m['primitives']):
        pos,pa = acc(pr['attributes']['POSITION'])
        tris = (g['accessors'][pr['indices']]['count']//3) if 'indices' in pr else len(pos)//3
        totv+=len(pos); tott+=tris
        print(f"mesh {mi} '{m.get('name')}' prim {pi}: attrs={list(pr['attributes'].keys())} verts={len(pos)} tris={tris} mode={pr.get('mode',4)} material={pr.get('material')} targets={len(pr.get('targets',[]))}")
        print("   bbox min", pos.min(0).round(4), "max", pos.max(0).round(4), "size", (pos.max(0)-pos.min(0)).round(4))
        print("   accessor min/max:", pa.get('min'), pa.get('max'))
        if 'indices' in pr:
            idx,_=acc(pr['indices']); idx=idx.ravel().reshape(-1,3)
            # connected components via union-find on triangles
            parent=np.arange(len(pos))
            def find(x):
                while parent[x]!=x:
                    parent[x]=parent[parent[x]]; x=parent[x]
                return x
            # weld by position first
            _, inv = np.unique(pos.round(5), axis=0, return_inverse=True)
            inv=inv.ravel()
            parent=np.arange(inv.max()+1)
            for a,b,c in inv[idx]:
                ra,rb,rc=find(a),find(b),find(c)
                parent[rb]=ra; parent[find(rc)]=ra
            roots=set(find(x) for x in np.unique(inv[idx]))
            print("   welded unique positions:", inv.max()+1, " connected components (position-welded):", len(roots))
            # degenerate tris
            P=pos[idx]; area=np.linalg.norm(np.cross(P[:,1]-P[:,0],P[:,2]-P[:,0]),axis=1)/2
            print("   degenerate tris (area<1e-10):", int((area<1e-10).sum()))
            # boundary edges on welded mesh
            e=np.sort(np.concatenate([inv[idx][:,[0,1]],inv[idx][:,[1,2]],inv[idx][:,[2,0]]]),axis=1)
            ue,cnt=np.unique(e,axis=0,return_counts=True)
            print("   edges:",len(ue)," boundary(1):",int((cnt==1).sum())," non-manifold(>2):",int((cnt>2).sum()))
print("TOTAL verts",totv,"tris",tott)
print("\n--- MATERIALS ---")
for m in g.get('materials',[]): print(json.dumps(m))
print("\n--- TEXTURES/IMAGES ---")
for t in g.get('textures',[]): print("tex",t)
for i,im in enumerate(g.get('images',[])):
    bv=g['bufferViews'][im['bufferView']] if 'bufferView' in im else None
    print("img",i,im.get('name'),im.get('mimeType'),"bytes",bv['byteLength'] if bv else im.get('uri'))
print("samplers",g.get('samplers'))
print("skins",g.get('skins')); print("animations",[a.get('name') for a in g.get('animations',[])])
import os
out = os.path.splitext(os.path.basename(p))[0] + '.inspect.json'
json.dump(g, open(out,'w'), indent=1)  # full glTF JSON written to the current folder
print('glTF JSON written to', out)

import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../../config/styleTokens';

/** Paints a geometry with one color and, if `center` is given, points its normals away from it (soft anime foliage). */
function paint(geo: BufferGeometry, color: Color, center?: Vector3, topLight?: Color): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position as BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const nrm = new Float32Array(pos.count * 3);
  const v = new Vector3(), c = new Color();
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.copy(color);
    if (topLight) c.lerp(topLight, Math.max(0, (v.y - minY) / Math.max(0.001, maxY - minY) - 0.45) * 0.9);
    cols.set([c.r, c.g, c.b], i * 3);
    if (center) { v.sub(center).normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
  }
  g.setAttribute('color', new BufferAttribute(cols, 3));
  if (center) g.setAttribute('normal', new BufferAttribute(nrm, 3)); else g.computeVertexNormals();
  return g;
}

/** Round anime tree (~6.5 m): trunk + 4 soft canopy blobs. Pivot at the base. Options make the far-away sakura stand-in. */
export function createRoundTree(opts: { leaf?: string; lit?: string; trunk?: string; spread?: number; detail?: number } = {}): BufferGeometry {
  const trunk = paint(new CylinderGeometry(0.22, 0.38, 3.4, 7, 1).translate(0, 1.7, 0), new Color(opts.trunk ?? palette.wood.warm).multiplyScalar(0.8));
  const leaf = new Color(opts.leaf ?? palette.grass.shade), lit = new Color(opts.lit ?? palette.foliage.highlight);
  const k = opts.spread ?? 1;
  const center = new Vector3(0, 4.6, 0);
  const blobs: Array<[number, number, number, number]> = [[0, 4.6, 0, 1.9 * k], [1.1 * k, 4.1, 0.4 * k, 1.3 * k], [-1.0 * k, 4.2, -0.5 * k, 1.35 * k], [0.2, 5.6, -0.2, 1.3 * k]];
  const parts = blobs.map(([x, y, z, r]) => paint(new IcosahedronGeometry(r, opts.detail ?? 1).translate(x, y, z), leaf, center, lit));
  return mergeGeometries([trunk, ...parts])!;
}

/** Far-away sakura (≈ 7 m tall, wide pink crown), ~250 triangles. */
export function createSakuraFar(): BufferGeometry {
  return createRoundTree({ leaf: palette.sakura.deep, lit: palette.sakura.light, trunk: '#5A3E2B', spread: 1.55, detail: 1 });
}

/** Far-away palm (≈ 12 m): slim trunk + a star of flattened fronds, ~200 triangles. */
export function createPalmFar(): BufferGeometry {
  const trunk = paint(new CylinderGeometry(0.2, 0.32, 11.4, 6, 1).translate(0, 5.7, 0), new Color(palette.wood.warm));
  const leaf = new Color(palette.grass.lit), lit = new Color(palette.foliage.highlight);
  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const g = new IcosahedronGeometry(1, 0).scale(2.8, 0.25, 0.75).translate(2.4, -0.5, 0).rotateZ(-0.35).rotateY(a).translate(0, 11.6, 0);
    fronds.push(paint(g, leaf, new Vector3(0, 11.0, 0), lit));
  }
  return mergeGeometries([trunk, ...fronds])!;
}

/** Round bush (~1.2 m): three soft blobs. Pivot at the base. */
export function createBush(): BufferGeometry {
  const leaf = new Color(palette.grass.lit), lit = new Color(palette.foliage.highlight);
  const center = new Vector3(0, 0.4, 0);
  const blobs: Array<[number, number, number, number]> = [[0, 0.55, 0, 0.6], [0.5, 0.4, 0.15, 0.45], [-0.45, 0.4, -0.15, 0.45]];
  return mergeGeometries(blobs.map(([x, y, z, r]) => paint(new IcosahedronGeometry(r, 1).translate(x, y, z), leaf, center, lit)))!;
}

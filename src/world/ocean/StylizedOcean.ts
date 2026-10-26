import { Color, DataTexture, LinearFilter, Mesh, PlaneGeometry, RedFormat, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, Vector4, ClampToEdgeWrapping } from 'three';
import { lighting, palette } from '../../config/styleTokens';
import { COAST_GRID } from '../island/coastSdfData';
import { islandHeight } from '../island/islandHeight';
import { oceanFragment, oceanVertex } from './oceanShader';

/** Water depth (m, 0 on land) sampled on the coast grid → R8 texture (0.1 m steps, up to 25.5 m). */
export function buildDepthGrid(heightAt: (x: number, z: number) => number = islandHeight): Uint8Array {
  const { cols, rows, cell, originX, originZ } = COAST_GRID;
  const out = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const h = heightAt(originX + (i + 0.5) * cell, originZ + (j + 0.5) * cell);
    out[j * cols + i] = Math.max(0, Math.min(255, Math.round(-h * 10)));
  }
  return out;
}

/** Stylized sea (STYLE_BIBLE §8): depth-colored, wave normals, toon glints, shore foam. One quad, one draw call. */
export class StylizedOcean {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor() {
    const { cols, rows, cell, originX, originZ } = COAST_GRID;
    const tex = new DataTexture(buildDepthGrid(), cols, rows, RedFormat);
    tex.magFilter = tex.minFilter = LinearFilter;
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
    tex.needsUpdate = true;
    const el = (lighting.sun.elevationDeg * Math.PI) / 180, az = (lighting.sun.azimuthDeg * Math.PI) / 180;
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog, {
        uTime: { value: 0 },
        uDepth: { value: null },
        uDepthRect: { value: new Vector4(originX, originZ, cols * cell, rows * cell) },
        uShallow: { value: new Color(palette.water.shallow) },
        uMid: { value: new Color(palette.water.mid) },
        uDeep: { value: new Color(palette.water.deep) },
        uFoam: { value: new Color(palette.water.foam) },
        uSky: { value: new Color(palette.sky.horizon) },
        uSunDir: { value: new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize() },
        uSunColor: { value: new Color(lighting.sun.color) },
      }]),
      vertexShader: oceanVertex,
      fragmentShader: oceanFragment,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.material.uniforms.uDepth.value = tex; // set after merge (merge clones textures)
    const geo = new PlaneGeometry(8000, 8000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(geo, this.material);
    this.mesh.name = 'StylizedOcean';
    this.mesh.renderOrder = 1;
  }

  update(elapsed: number): void { this.material.uniforms.uTime.value = elapsed; }
}

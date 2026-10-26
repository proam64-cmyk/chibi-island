import { BackSide, Color, DataTexture, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshToonMaterial, NearestFilter, RedFormat, Texture, Vector2 } from 'three';
import { toon } from '../../config/styleTokens';

let charRamp: DataTexture | null = null;
let envRamp: DataTexture | null = null;
let bldRamp: DataTexture | null = null;

function makeRamp(values: readonly number[]): DataTexture {
  const t = new DataTexture(new Uint8Array(values), values.length, 1, RedFormat);
  t.minFilter = t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
export const characterRamp = () => (charRamp ??= makeRamp(toon.rampCharacter));
export const environmentRamp = () => (envRamp ??= makeRamp(toon.rampEnvironment));
export const buildingRamp = () => (bldRamp ??= makeRamp(toon.rampBuilding));

/** Adds a soft white rim light to a MeshToonMaterial (STYLE_BIBLE §4). */
export function addRim(mat: MeshToonMaterial, strength: number): MeshToonMaterial {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: strength };
    sh.fragmentShader = 'uniform float uRim;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'float rimF = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);\n' +
      'outgoingLight += vec3(1.0) * rimF * uRim;\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'rim' + strength;
  return mat;
}

/**
 * Building shading: in the shade, keep the wall's own hue (no green/blue cast from the hemisphere light)
 * and never drop below `floor` × albedo. Lit faces are unchanged.
 */
export function addBuildingShade(mat: MeshToonMaterial, floor: number, neutral: number): MeshToonMaterial {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uShadeFloor = { value: floor };
    sh.uniforms.uShadeNeutral = { value: neutral };
    sh.fragmentShader = 'uniform float uShadeFloor;\nuniform float uShadeNeutral;\n' + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'vec3 bAlb = max(diffuseColor.rgb, vec3(0.02));\n' +
      'float bIrr = dot(outgoingLight / bAlb, vec3(0.3333));\n' +
      'vec3 bNeutral = diffuseColor.rgb * max(bIrr, uShadeFloor) * vec3(1.0, 0.98, 0.95);\n' +
      'outgoingLight = mix(outgoingLight, max(outgoingLight, bNeutral), uShadeNeutral);\n#include <opaque_fragment>');
  };
  const key = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => key() + 'bshade';
  return mat;
}

/** Converts a glTF PBR material into the game's toon material, keeping only color (+ normal) maps. */
export function toToonMaterial(src: Material, kind: 'character' | 'environment' | 'building'): MeshToonMaterial {
  const std = src as MeshStandardMaterial;
  const isChar = kind === 'character';
  if (kind === 'building') {
    const mat = new MeshToonMaterial({ map: (std.map as Texture | null) ?? null, color: std.color ? std.color.clone() : new Color(0xffffff), gradientMap: buildingRamp(), side: std.side });
    return addBuildingShade(addRim(mat, toon.rimBuilding), toon.buildingShadeFloor, toon.buildingNeutralShade);
  }
  const mat = new MeshToonMaterial({
    map: (std.map as Texture | null) ?? null,
    normalMap: (std.normalMap as Texture | null) ?? null,
    normalScale: new Vector2(toon.normalScaleCharacter, toon.normalScaleCharacter),
    color: std.color ? std.color.clone() : new Color(0xffffff),
    gradientMap: isChar ? characterRamp() : environmentRamp(),
    side: std.side,
  });
  return addRim(mat, isChar ? toon.rimCharacter : toon.rimEnvironment);
}

/** Inverted-hull outline as a child mesh. `worldWidth` in meters; compensates the mesh's world scale. */
export function addOutline(mesh: Mesh, worldWidth: number, color: string): Mesh {
  mesh.updateWorldMatrix(true, false);
  const scale = mesh.matrixWorld.getMaxScaleOnAxis() || 1;
  const mat = new MeshBasicMaterial({ color, side: BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uW = { value: worldWidth / scale };
    sh.vertexShader = 'uniform float uW;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uW;');
  };
  mat.customProgramCacheKey = () => 'outline';
  const outline = new Mesh(mesh.geometry, mat);
  outline.name = mesh.name + '_outline';
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  return outline;
}

// Expands three.js #includes like the engine does and checks the GLSL with glslangValidator (GLSL ES 3.00).
// Usage: node tools/validate-shaders.mjs   (needs `glslangValidator` on PATH; skips with a warning otherwise)
import { ShaderChunk } from 'three';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { oceanVertex, oceanFragment } = await import('../dist-shaders/world/ocean/oceanShader.js');
const { injectWind } = await import('../dist-shaders/world/vegetation/windShader.js');
const { ShaderLib, Mesh, BoxGeometry } = await import('three');
const { addRim, addOutline, addBuildingShade } = await import('../dist-shaders/render/materials/ToonMaterial.js');
const { MeshToonMaterial } = await import('three');
// Run the real onBeforeCompile hooks on copies of three's shaders.
const hook = (mat, lib) => { const sh = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader }; mat.onBeforeCompile(sh); return sh; };
const rimShader = hook(addRim(new MeshToonMaterial(), 0.35), ShaderLib.toon);
const bldShader = hook(addBuildingShade(addRim(new MeshToonMaterial(), 0.1), 0.66, 0.75), ShaderLib.toon);
const host = new Mesh(new BoxGeometry());
const outlineShader = hook(addOutline(host, 0.006, '#000000').material, ShaderLib.basic);
const resolve = (src) => src.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_, n) => { if (!(n in ShaderChunk)) throw new Error('unknown chunk ' + n); return resolve(ShaderChunk[n]); });
const common = '#version 300 es\nprecision highp float;\nprecision highp int;\n#define FOG_EXP2\n#define USE_FOG\n#define TONE_MAPPING\n// glslang reserves the name average (browsers do not): rename it for validation only\n#define average three_average\n';
const vertPrefix = common + 'uniform mat4 modelMatrix;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform mat4 viewMatrix;\nuniform mat3 normalMatrix;\nuniform vec3 cameraPosition;\nuniform bool isOrthographic;\nin vec3 position;\nin vec3 normal;\nin vec2 uv;\n#define attribute in\n#define varying out\n#define texture2D texture\n';
const fragPrefix = common + 'uniform mat4 viewMatrix;\nuniform vec3 cameraPosition;\nuniform bool isOrthographic;\n#define varying in\nlayout(location = 0) out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n#define texture2D texture\nvec3 toneMapping(vec3 c) { return c; }\nvec4 linearToOutputTexel(vec4 v) { return v; }\n';
// Same light-count substitution + loop unrolling that three.js performs when it builds a program.
const LIGHT_NUMS = { NUM_DIR_LIGHTS: 1, NUM_SPOT_LIGHTS: 0, NUM_RECT_AREA_LIGHTS: 0, NUM_POINT_LIGHTS: 0, NUM_HEMI_LIGHTS: 1, NUM_DIR_LIGHT_SHADOWS: 1, NUM_SPOT_LIGHT_SHADOWS: 0, NUM_POINT_LIGHT_SHADOWS: 0, NUM_SPOT_LIGHT_MAPS: 0, NUM_SPOT_LIGHT_COORDS: 0, NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS: 0 };
const threeLike = (src) => {
  let out = src;
  for (const [k, v] of Object.entries(LIGHT_NUMS)) out = out.replace(new RegExp(`(?<!define )\\b${k}\\b`, 'g'), String(v));
  return out.replace(/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g,
    (_, a, b, body) => { let r = ''; for (let i = +a; i < +b; i++) r += body.replace(/\[\s*i\s*\]/g, `[ ${i} ]`).replace(/UNROLLED_LOOP_INDEX/g, String(i)); return r; });
};
const dir = mkdtempSync(join(tmpdir(), 'glsl-'));
let ok = true;
const lightDefines = ['NUM_DIR_LIGHTS 1','NUM_SPOT_LIGHTS 0','NUM_RECT_AREA_LIGHTS 0','NUM_POINT_LIGHTS 0','NUM_HEMI_LIGHTS 1','NUM_DIR_LIGHT_SHADOWS 1','NUM_SPOT_LIGHT_SHADOWS 0','NUM_POINT_LIGHT_SHADOWS 0','NUM_SPOT_LIGHT_MAPS 0','NUM_SPOT_LIGHT_COORDS 0','NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS 0','NUM_CLIPPING_PLANES 0','UNION_CLIPPING_PLANES 0'].map((d) => '#define ' + d).join('\n') + '\n#define USE_SHADOWMAP\n';
const toonWind = vertPrefix + lightDefines + '#define USE_INSTANCING\nin mat4 instanceMatrix;\n#define USE_COLOR\nin vec3 color;\n' + resolve(injectWind(ShaderLib.toon.vertexShader, 0.01));
const skin = '#define USE_SKINNING\nin vec4 skinIndex;\nin vec4 skinWeight;\n';
const jobs = [
  ['ocean.vert', 'vert', vertPrefix + resolve(oceanVertex)],
  ['ocean.frag', 'frag', fragPrefix + resolve(oceanFragment)],
  ['toon_wind_instanced.vert', 'vert', toonWind],
  ['toon_rim_skinned.vert', 'vert', vertPrefix + lightDefines + skin + resolve(rimShader.vertexShader)],
  ['toon_rim.frag', 'frag', fragPrefix + lightDefines + '#define USE_MAP\n#define USE_UV\n' + resolve(rimShader.fragmentShader)],
  ['toon_building.frag', 'frag', fragPrefix + lightDefines + '#define USE_MAP\n#define USE_UV\n' + resolve(bldShader.fragmentShader)],
  ['outline_skinned.vert', 'vert', vertPrefix + lightDefines + skin + resolve(outlineShader.vertexShader)],
];
for (const [name, stage, src] of jobs) {
  const f = join(dir, name); writeFileSync(f, threeLike(src));
  try { execFileSync('glslangValidator', ['-S', stage, f], { stdio: 'pipe' }); console.log('✓', name); }
  catch (e) { ok = false; console.error('✗', name, '\n' + (e.stdout?.toString() || e.message)); }
}
process.exit(ok ? 0 : 1);

/** GLSL for the stylized ocean (STYLE_BIBLE §8). Kept in its own module so tools/validate-shaders.mjs can check it. */
export const oceanVertex = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export const oceanFragment = /* glsl */ `
uniform float uTime;
uniform sampler2D uDepth;      // water depth grid (R8: value * 25.5 = meters)
uniform vec4 uDepthRect;       // originX, originZ, width, depth (m)
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>

float waterDepth(vec2 p) {
  vec2 uv = (p - uDepthRect.xy) / uDepthRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 30.0;
  return texture2D(uDepth, uv).r * 25.5;
}

// Sum of four directional waves: stylized normals, no textures needed.
vec3 waveNormal(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec2 d1 = vec2(0.8, 0.6), d2 = vec2(-0.5, 0.85), d3 = vec2(0.95, -0.3), d4 = vec2(-0.7, -0.7);
  g += d1 * cos(dot(p, d1) * 0.21 + t * 1.1) * 0.045;
  g += d2 * cos(dot(p, d2) * 0.37 + t * 1.6) * 0.030;
  g += d3 * cos(dot(p, d3) * 0.73 + t * 2.3) * 0.018;
  g += d4 * cos(dot(p, d4) * 1.31 + t * 3.1) * 0.010;
  return normalize(vec3(-g.x, 1.0, -g.y));
}

void main() {
  float depth = waterDepth(vWorld.xz);
  vec3 col = mix(uShallow, uMid, smoothstep(1.0, 11.0, depth));
  col = mix(col, uDeep, smoothstep(11.0, 25.0, depth));

  vec3 n = waveNormal(vWorld.xz, uTime);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  col = mix(col, uSky, fres * 0.5);

  // Toon sun glints: a hard-edged highlight instead of a real reflection.
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(n, H), 0.0), 220.0);
  col += uSunColor * step(0.5, spec) * 0.7;

  // Foam: a rim where the water meets land + soft bands rolling toward the shore.
  float rim = 1.0 - smoothstep(0.15, 0.6, depth);
  float near = 1.0 - smoothstep(0.4, 2.2, depth);
  float wave = sin(depth * 5.5 - uTime * 1.8 + sin(vWorld.x * 0.05 + vWorld.z * 0.04) * 1.5) * 0.5 + 0.5;
  float bands = smoothstep(0.72, 0.9, wave) * near;
  float foam = clamp(max(rim, bands * 0.85), 0.0, 1.0);
  col = mix(col, uFoam, foam);

  float alpha = mix(0.55, 0.93, smoothstep(0.3, 6.0, depth));
  gl_FragColor = vec4(col, max(alpha, foam));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

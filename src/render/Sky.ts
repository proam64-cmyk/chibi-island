import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import { palette } from '../config/styleTokens';

/** Gradient sky dome: horizon color at the horizon, zenith color overhead. Follows the camera. */
export function createSky(radius = 1800): Mesh {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new Color(palette.sky.zenith) }, bottom: { value: new Color(palette.sky.horizon) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vDir; void main(){ float t = smoothstep(-0.02, 0.45, vDir.y); gl_FragColor = vec4(mix(bottom, top, t), 1.0); \n#include <colorspace_fragment>\n }',
  });
  const sky = new Mesh(new SphereGeometry(radius, 32, 16), mat);
  sky.name = 'Sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

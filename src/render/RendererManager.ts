import { NeutralToneMapping, PCFShadowMap, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { lighting } from '../config/styleTokens';
import type { QualityProfile } from '../config/performanceProfiles';

export function createRenderer(container: HTMLElement, profile: QualityProfile): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: profile.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.maxPixelRatio));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = lighting.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = profile.id === 'low' ? PCFShadowMap : PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);
  return renderer;
}

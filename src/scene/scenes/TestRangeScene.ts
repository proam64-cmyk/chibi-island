import { FogExp2, Scene } from 'three';
import { lighting } from '../../config/styleTokens';
import type { QualityProfile } from '../../config/performanceProfiles';
import { createSky } from '../../render/Sky';
import { Lighting } from '../../render/Lighting';
import { createTestTerrain } from '../../world/terrain/TestTerrain';
import { testTerrainHeight } from '../../world/terrain/heightField';
import { createDebugOcean } from '../../world/ocean/DebugOcean';

/** Phase 1 scene: 512 × 512 m test terrain, placeholder sea, gradient sky, style-bible lighting. */
export class TestRangeScene {
  readonly scene = new Scene();
  readonly sky = createSky();
  readonly lighting: Lighting;
  readonly heightAt = (x: number, z: number) => testTerrainHeight(x, z);

  constructor(profile: QualityProfile) {
    this.scene.fog = new FogExp2(lighting.fog.color, lighting.fog.density);
    this.scene.add(this.sky, createTestTerrain(profile.terrainSegments), createDebugOcean());
    this.lighting = new Lighting(this.scene, profile);
  }
}

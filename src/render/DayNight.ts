import { Color, type FogExp2, type Mesh, type ShaderMaterial } from 'three';
import type { Lighting } from './Lighting';
import { lightDirection, presetAt } from '../world/time/dayNight';
import { palette } from '../config/styleTokens';
import type { StylizedOcean } from '../world/ocean/StylizedOcean';

/** Applies the day/night presets (world/time/dayNight.ts) to lights, sky, fog and ocean every frame. */
export class DayNight {
  private c = new Color();
  private water = { shallow: new Color(palette.water.shallow), mid: new Color(palette.water.mid), deep: new Color(palette.water.deep), foam: new Color(palette.water.foam) };
  constructor(private lighting: Lighting, private sky: Mesh, private fog: FogExp2 | null, private ocean: StylizedOcean) {}

  apply(hour: number): void {
    const p = presetAt(hour), d = lightDirection(hour);
    this.lighting.setDirection(d.elevationDeg, d.azimuthDeg);
    this.lighting.sun.color.set(p.sunColor);
    this.lighting.sun.intensity = p.sunIntensity;
    this.lighting.hemi.color.set(p.hemiSky);
    this.lighting.hemi.groundColor.set(p.hemiGround);
    this.lighting.hemi.intensity = p.hemiIntensity;
    const su = (this.sky.material as ShaderMaterial).uniforms;
    su.top.value.set(p.zenith); su.bottom.value.set(p.horizon);
    this.fog?.color.set(p.fog);
    const ou = this.ocean.material.uniforms;
    ou.uSky.value.set(p.horizon);
    ou.uSunDir.value.copy(this.lighting.direction);
    ou.uSunColor.value.set(p.sunColor).multiplyScalar(Math.min(1, p.sunIntensity / 2.5) * 0.9 + 0.1);
    for (const k of ['shallow', 'mid', 'deep', 'foam'] as const) {
      const u = ou[`u${k[0].toUpperCase()}${k.slice(1)}`];
      u.value.copy(this.water[k]).multiplyScalar(p.waterTint).lerp(this.c.set(p.horizon), (1 - p.waterTint) * 0.25);
    }
  }
}

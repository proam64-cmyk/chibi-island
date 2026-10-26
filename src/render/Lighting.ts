import { Color, DirectionalLight, HemisphereLight, Object3D, Vector3 } from 'three';
import { lighting, shadows } from '../config/styleTokens';
import type { QualityProfile } from '../config/performanceProfiles';

/** Sun + hemisphere light (STYLE_BIBLE §2–3). The shadow box follows the player and snaps to texels to avoid shimmering. */
export class Lighting {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  private readonly dir: Vector3;
  private readonly area: number;
  private readonly texel: number;

  constructor(root: Object3D, profile: QualityProfile) {
    this.hemi = new HemisphereLight(new Color(lighting.hemi.sky), new Color(lighting.hemi.ground), lighting.hemi.intensity);
    this.sun = new DirectionalLight(new Color(lighting.sun.color), lighting.sun.intensity);
    const el = (lighting.sun.elevationDeg * Math.PI) / 180, az = (lighting.sun.azimuthDeg * Math.PI) / 180;
    this.dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.area = profile.shadowArea;
    this.texel = profile.shadowArea / profile.shadowMapSize;
    const s = this.sun.shadow;
    this.sun.castShadow = true;
    s.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    s.bias = shadows.bias;
    s.normalBias = shadows.normalBias;
    Object.assign(s.camera, { left: -this.area / 2, right: this.area / 2, top: this.area / 2, bottom: -this.area / 2, near: 0.5, far: 200 });
    s.camera.updateProjectionMatrix();
    root.add(this.hemi, this.sun, this.sun.target);
  }

  /** Day/night: moves the sun (or moon) — elevation/azimuth in degrees. */
  setDirection(elevationDeg: number, azimuthDeg: number): void {
    const el = (elevationDeg * Math.PI) / 180, az = (azimuthDeg * Math.PI) / 180;
    this.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }
  get direction(): Vector3 { return this.dir; }

  follow(p: Vector3): void {
    const snap = (v: number) => Math.round(v / this.texel) * this.texel;
    const c = new Vector3(snap(p.x), p.y, snap(p.z));
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.dir, 80);
  }
}

import { CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';
import { districts } from '../../config/islandPlan';
import { t } from '../../i18n/i18n';
import { islandHeight } from './islandHeight';

/** Debug-only district boundaries: a ground ring, a beacon and a name label per district (toggle with T). */
export class DistrictMarkers {
  readonly group = new Group();
  private sprites: Array<{ sprite: Sprite; key: string; color: string }> = [];

  constructor() {
    this.group.name = 'DistrictMarkers';
    for (const d of districts) {
      const y = islandHeight(d.x, d.z);
      const ring = new Mesh(new RingGeometry(d.radius - 1.5, d.radius, 96), new MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.7, side: DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(d.x, y + 0.6, d.z);
      const beacon = new Mesh(new CylinderGeometry(0.6, 0.6, 60, 8, 1, true), new MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.45, depthWrite: false }));
      beacon.position.set(d.x, y + 30, d.z);
      const sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
      sprite.position.set(d.x, y + 66, d.z);
      sprite.scale.set(48, 12, 1);
      sprite.renderOrder = 10;
      this.sprites.push({ sprite, key: d.nameKey, color: d.color });
      this.group.add(ring, beacon, sprite);
    }
    this.refreshLabels();
  }

  /** Re-draws the labels (after a language change). */
  refreshLabels(): void {
    for (const s of this.sprites) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(35,40,66,0.85)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 40); g.fill();
      g.fillStyle = s.color; g.fillRect(28, 50, 28, 28);
      g.fillStyle = '#F3E6CF'; g.font = '700 54px "M PLUS Rounded 1c", system-ui, sans-serif'; g.textBaseline = 'middle';
      g.fillText(t(s.key), 76, 66, 410);
      const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
      s.sprite.material.map?.dispose();
      s.sprite.material.map = tex; s.sprite.material.needsUpdate = true;
    }
  }

  set visible(v: boolean) { this.group.visible = v; }
  get visible(): boolean { return this.group.visible; }
}

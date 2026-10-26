import type { WebGLRenderer } from 'three';
import { t } from '../i18n/i18n';

export interface DiagnosticsExtra { quality: string; pixelRatio: number; player: string; rei: string; district: string; trip: string; terrain: string; world?: string }

/** F3 overlay: FPS, frame time, draw calls, triangles, geometries, textures + validation lines. */
export class DiagnosticsPanel {
  visible = false;
  private el: HTMLPreElement;
  private frames = 0;
  private acc = 0;
  private worst = 0;
  private fps = 0;
  private ms = 0;

  constructor(parent: HTMLElement, private renderer: WebGLRenderer) {
    this.el = document.createElement('pre');
    this.el.className = 'diagnostics';
    this.el.hidden = true;
    parent.appendChild(this.el);
  }

  toggle(): boolean { this.visible = !this.visible; this.el.hidden = !this.visible; return this.visible; }

  /** Call after rendering, once per frame. */
  update(dt: number, extra: DiagnosticsExtra): void {
    this.frames++; this.acc += dt; this.worst = Math.max(this.worst, dt);
    if (this.acc < 0.5) return;
    this.fps = this.frames / this.acc; this.ms = (this.acc / this.frames) * 1000;
    const worstMs = this.worst * 1000;
    this.frames = 0; this.acc = 0; this.worst = 0;
    if (!this.visible) return;
    const info = this.renderer.info;
    const n = (v: number) => v.toLocaleString('es-ES');
    this.el.textContent = [
      t('debug.title'),
      `${t('debug.fps')}: ${this.fps.toFixed(0)}`,
      `${t('debug.frame')}: ${this.ms.toFixed(1)} (peor ${worstMs.toFixed(1)})`,
      `${t('debug.calls')}: ${n(info.render.calls)}`,
      `${t('debug.tris')}: ${n(info.render.triangles)}`,
      `${t('debug.geometries')}: ${n(info.memory.geometries)}`,
      `${t('debug.textures')}: ${n(info.memory.textures)}`,
      `${t('debug.quality')}: ${extra.quality} · DPR ${extra.pixelRatio.toFixed(2)}`,
      `${t('debug.player')}: ${extra.player}`,
      `${t('debug.district')}: ${extra.district}`,
      `${t('debug.trip')}: ${extra.trip}`,
      `${t('debug.terrain')}: ${extra.terrain}`,
      ...(extra.world ? [`${t('debug.world')}: ${extra.world}`] : []),
      `${t('debug.rei')}: ${extra.rei}`,
      `${t('debug.ocean')}`,
    ].join('\n');
  }
}

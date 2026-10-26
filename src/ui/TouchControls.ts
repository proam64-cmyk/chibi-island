import type { InputManager } from '../input/InputManager';
import { t } from '../i18n/i18n';

/**
 * On-screen controls for phones/tablets (V1.0 §5): joystick bottom-left; jump, run and a contextual
 * interact button bottom-right. Shown only on touch screens; nothing overlaps.
 */
export class TouchControls {
  readonly el: HTMLDivElement;
  private knob: HTMLDivElement;
  private interactBtn: HTMLButtonElement;
  private runBtn: HTMLButtonElement;
  private stickId: number | null = null;
  private origin = { x: 0, y: 0 };

  static wanted(): boolean { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; }

  constructor(parent: HTMLElement, private input: InputManager) {
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML = `<div class="stick"><div class="knob"></div></div>
      <div class="btns"><button class="tbtn interact" hidden></button><button class="tbtn run"></button><button class="tbtn jump"></button></div>`;
    parent.appendChild(this.el);
    const stick = this.el.querySelector<HTMLDivElement>('.stick')!;
    this.knob = this.el.querySelector<HTMLDivElement>('.knob')!;
    this.interactBtn = this.el.querySelector<HTMLButtonElement>('.interact')!;
    this.runBtn = this.el.querySelector<HTMLButtonElement>('.run')!;
    const jump = this.el.querySelector<HTMLButtonElement>('.jump')!;
    const R = 50;
    stick.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      this.stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect(); this.origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.move(e.clientX, e.clientY, R);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.stickId) { e.stopPropagation(); this.move(e.clientX, e.clientY, R); } });
    const end = (e: PointerEvent) => { if (e.pointerId !== this.stickId) return; this.stickId = null; this.input.virtual.x = 0; this.input.virtual.y = 0; this.knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const tap = (b: HTMLButtonElement, fn: () => void) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(); });
    tap(jump, () => this.input.queueJump());
    tap(this.interactBtn, () => this.input.queueInteract());
    tap(this.runBtn, () => { this.input.virtual.run = !this.input.virtual.run; this.runBtn.classList.toggle('on', this.input.virtual.run); });
    this.refresh();
  }

  private move(cx: number, cy: number, R: number): void {
    let dx = cx - this.origin.x, dy = cy - this.origin.y;
    const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.input.virtual.x = dx / R; this.input.virtual.y = -dy / R;
  }

  /** Shows the interact button only when an action is really available. */
  setInteract(label: string | null): void {
    this.interactBtn.hidden = !label;
    if (label) this.interactBtn.textContent = label;
  }

  refresh(): void {
    this.el.querySelector('.jump')!.textContent = t('touch.jump');
    this.runBtn.textContent = t('touch.run');
  }
}

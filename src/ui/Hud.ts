import { t, tf } from '../i18n/i18n';
import type { WorldClock } from '../world/time/WorldClock';

/** World clock (top-left), contextual interaction prompt (bottom-centre) and the noticeboard panel. */
export class Hud {
  private clockEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  readonly board: HTMLDivElement;
  private lastLabel = '';

  constructor(parent: HTMLElement) {
    this.clockEl = document.createElement('div'); this.clockEl.className = 'clock'; parent.appendChild(this.clockEl);
    this.promptEl = document.createElement('div'); this.promptEl.className = 'prompt'; this.promptEl.hidden = true; parent.appendChild(this.promptEl);
    this.board = document.createElement('div'); this.board.className = 'board'; this.board.hidden = true; parent.appendChild(this.board);
  }

  updateClock(c: WorldClock): void {
    const icon = { dawn: '🌅', day: '☀️', evening: '🌇', night: '🌙' }[c.phase];
    const label = `${icon} ${tf('clock.label', { d: String(c.day), w: t(`clock.${c.weekday}`), time: c.label })}`;
    if (label !== this.lastLabel) { this.clockEl.textContent = label; this.lastLabel = label; }
  }

  /** `text` already includes the key hint; null hides the prompt. */
  setPrompt(text: string | null): void {
    this.promptEl.hidden = !text;
    if (text && this.promptEl.textContent !== text) this.promptEl.textContent = text;
  }

  get boardOpen(): boolean { return !this.board.hidden; }

  openBoard(c: WorldClock): void {
    const items = ['board.welcome', 'board.lights', 'board.sit', 'board.districts', 'board.soon'].map((k) => `<li>${t(k)}</li>`).join('');
    this.board.innerHTML = `<h2>${t('board.title')}</h2><p class="when">${tf('board.now', { d: String(c.day), time: c.label, phase: t(`clock.phase.${c.phase}`) })}</p><ul>${items}</ul><p class="close">${t('board.close')}</p>`;
    this.board.hidden = false;
  }

  closeBoard(): void { this.board.hidden = true; }
  refresh(): void { this.lastLabel = ''; }
}

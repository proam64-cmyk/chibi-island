import { t } from '../i18n/i18n';

/**
 * Dialogue box (bottom of the screen): speaker, text and numbered choices (keys 1–4, tap or click).
 * Data-driven: a tree of i18n keys `<prefix>.<node>.text` and choices.
 */
export interface DialogueNode { text: string; choices: Array<{ label: string; next: string | null }> }
export type DialogueTree = Record<string, DialogueNode>;

/** Rina's tree (Tourist Information): island, stars, what to do now. */
export function rinaTree(): DialogueTree {
  const back = { label: 'npc.rina.back', next: 'root' };
  return {
    root: { text: 'npc.rina.root', choices: [
      { label: 'npc.rina.q.island', next: 'island' }, { label: 'npc.rina.q.stars', next: 'stars' },
      { label: 'npc.rina.q.now', next: 'now' }, { label: 'npc.rina.q.bye', next: null }] },
    island: { text: 'npc.rina.a.island', choices: [back, { label: 'npc.rina.q.bye', next: null }] },
    stars: { text: 'npc.rina.a.stars', choices: [back, { label: 'npc.rina.q.bye', next: null }] },
    now: { text: 'npc.rina.a.now', choices: [back, { label: 'npc.rina.q.bye', next: null }] },
  };
}

export class DialoguePanel {
  private el: HTMLDivElement;
  private tree: DialogueTree | null = null;
  private node = 'root';
  private speaker = '';
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div'); this.el.className = 'dialogue'; this.el.hidden = true;
    parent.appendChild(this.el);
  }

  get open(): boolean { return !this.el.hidden; }

  start(speaker: string, tree: DialogueTree): void {
    this.speaker = speaker; this.tree = tree; this.node = 'root'; this.el.hidden = false; this.render();
  }

  choose(index: number): void {
    if (!this.tree) return;
    const c = this.tree[this.node].choices[index];
    if (!c) return;
    if (c.next === null) { this.close(); return; }
    this.node = c.next; this.render();
  }

  close(): void {
    if (!this.open) return;
    this.el.hidden = true; this.tree = null;
    this.onClose?.();
  }

  refresh(): void { if (this.open) this.render(); }

  private render(): void {
    const n = this.tree![this.node];
    this.el.innerHTML = `<div class="who">${this.speaker}</div><p>${t(n.text)}</p><div class="choices">${n.choices
      .map((c, i) => `<button data-i="${i}"><b>${i + 1}</b> ${t(c.label)}</button>`).join('')}</div>`;
    this.el.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(Number((b as HTMLElement).dataset.i)); }));
  }
}

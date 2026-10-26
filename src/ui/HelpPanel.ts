import { t } from '../i18n/i18n';

/** Controls overlay (key H). */
export class HelpPanel {
  private el: HTMLDivElement;
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'help';
    this.el.hidden = true;
    parent.appendChild(this.el);
    this.refresh();
  }
  refresh(): void {
    this.el.innerHTML = `<h2>${t('help.title')}</h2>` + ['help.move', 'help.camera', 'help.emotes', 'help.travel', 'help.debug'].map((k) => `<p>${t(k)}</p>`).join('');
  }
  toggle(): void { this.el.hidden = !this.el.hidden; }
}

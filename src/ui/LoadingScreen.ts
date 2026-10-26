import { t } from '../i18n/i18n';

export class LoadingScreen {
  private el: HTMLDivElement;
  private bar: HTMLDivElement;
  private label: HTMLDivElement;
  private errors: HTMLUListElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'loading';
    this.el.innerHTML = `
      <div class="loading-card">
        <h1>${t('loading.title')}</h1>
        <p class="loading-sub">${t('loading.subtitle')}</p>
        <div class="loading-track"><div class="loading-bar"></div></div>
        <div class="loading-label" aria-live="polite"></div>
        <ul class="loading-errors" role="alert"></ul>
      </div>`;
    parent.appendChild(this.el);
    this.bar = this.el.querySelector('.loading-bar')!;
    this.label = this.el.querySelector('.loading-label')!;
    this.errors = this.el.querySelector('.loading-errors')!;
  }

  progress(loaded: number, total: number, label: string): void {
    const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
    this.bar.style.width = pct.toFixed(1) + '%';
    const mb = (n: number) => (n / 1e6).toFixed(1).replace('.', ',');
    this.label.textContent = `${t('loading.assets')}: ${label} · ${mb(loaded)} / ${mb(total)} MB`;
  }

  step(label: string, done: number, total: number): void {
    this.bar.style.width = ((done / Math.max(1, total)) * 100).toFixed(1) + '%';
    this.label.textContent = `${label} · ${done} / ${total}`;
  }

  error(id: string, url: string, message: string): void {
    const li = document.createElement('li');
    li.textContent = `${t('loading.error')} "${id}" (${url.startsWith('data:') ? 'embebido' : url}): ${message}. ${t('loading.continue')}`;
    this.errors.appendChild(li);
  }

  hide(delayMs = 250): void {
    const hasErrors = this.errors.children.length > 0;
    setTimeout(() => { this.el.classList.add('hidden'); setTimeout(() => this.el.remove(), 400); }, hasErrors ? 3500 : delayMs);
  }
}

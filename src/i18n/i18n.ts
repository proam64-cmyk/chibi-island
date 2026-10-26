import es from './es.json';
import en from './en.json';
import ja from './ja.json';

export type Lang = 'es' | 'en' | 'ja';
const tables: Record<Lang, Record<string, string>> = { es, en, ja };

export function detectLang(navLang: string | undefined): Lang {
  const l = (navLang ?? 'es').slice(0, 2).toLowerCase();
  return l === 'en' || l === 'ja' ? l : 'es';
}

let current: Lang = 'es';
export const setLang = (l: Lang) => { current = l; };
export const getLang = () => current;
/** Falls back to Spanish, then to the key itself, so a missing string is visible but never crashes. */
export const t = (key: string): string => tables[current][key] ?? tables.es[key] ?? key;
const ORDER: Lang[] = ['es', 'en', 'ja'];
/** Cycles ES → EN → JA and remembers the choice in this browser (if storage is available). */
export function cycleLang(): Lang {
  current = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  try { localStorage.setItem('chibi.lang', current); } catch { /* storage unavailable: keep for this session */ }
  return current;
}
export function storedLang(): Lang | null {
  try { const v = localStorage.getItem('chibi.lang'); return v === 'es' || v === 'en' || v === 'ja' ? v : null; } catch { return null; }
}
/** t() with {placeholders}. */
export const tf = (key: string, vars: Record<string, string>): string => t(key).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
export const missingKeys = (lang: Lang): string[] => Object.keys(tables.es).filter((k) => !(k in tables[lang]));

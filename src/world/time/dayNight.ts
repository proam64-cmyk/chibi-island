/**
 * Pure day/night curves (no three.js): light presets per hour, interpolated continuously.
 * Values in sRGB hex + intensities; `DayNight.ts` applies them to the scene.
 */
export interface LightPreset {
  zenith: string; horizon: string; sunColor: string; sunIntensity: number;
  hemiSky: string; hemiGround: string; hemiIntensity: number; fog: string; waterTint: number;
}

/** Key presets [hour, preset]; between keys everything is interpolated. Day = the approved Phase 1 look. */
export const LIGHT_KEYS: Array<[number, LightPreset]> = [
  [0, { zenith: '#0B1433', horizon: '#26315C', sunColor: '#9DB4FF', sunIntensity: 0.45, hemiSky: '#3A4C80', hemiGround: '#1E2B33', hemiIntensity: 0.55, fog: '#1D2647', waterTint: 0.35 }],
  [4.5, { zenith: '#0E1A40', horizon: '#2E3A66', sunColor: '#9DB4FF', sunIntensity: 0.4, hemiSky: '#3A4C80', hemiGround: '#1E2B33', hemiIntensity: 0.55, fog: '#222C52', waterTint: 0.35 }],
  [6, { zenith: '#5E7FC4', horizon: '#FFB38A', sunColor: '#FFC48A', sunIntensity: 1.2, hemiSky: '#A9C2EA', hemiGround: '#7C9A63', hemiIntensity: 0.7, fog: '#E8B9A0', waterTint: 0.75 }],
  [7.5, { zenith: '#4FA8F0', horizon: '#BFE6FF', sunColor: '#FFF4E0', sunIntensity: 2.5, hemiSky: '#BFE6FF', hemiGround: '#8FBF6A', hemiIntensity: 0.9, fog: '#BFE6FF', waterTint: 1 }],
  [16.5, { zenith: '#4FA8F0', horizon: '#BFE6FF', sunColor: '#FFF4E0', sunIntensity: 2.5, hemiSky: '#BFE6FF', hemiGround: '#8FBF6A', hemiIntensity: 0.9, fog: '#BFE6FF', waterTint: 1 }],
  [18.5, { zenith: '#5A6FC0', horizon: '#FF9E6B', sunColor: '#FFB070', sunIntensity: 1.6, hemiSky: '#C9A9D6', hemiGround: '#7E8A5C', hemiIntensity: 0.75, fog: '#F0A889', waterTint: 0.8 }],
  [20, { zenith: '#1E2456', horizon: '#6B4E7E', sunColor: '#C7A6FF', sunIntensity: 0.6, hemiSky: '#5A5A99', hemiGround: '#2C3540', hemiIntensity: 0.6, fog: '#3B3560', waterTint: 0.45 }],
  [21.5, { zenith: '#0B1433', horizon: '#26315C', sunColor: '#9DB4FF', sunIntensity: 0.45, hemiSky: '#3A4C80', hemiGround: '#1E2B33', hemiIntensity: 0.55, fog: '#1D2647', waterTint: 0.35 }],
  [24, { zenith: '#0B1433', horizon: '#26315C', sunColor: '#9DB4FF', sunIntensity: 0.45, hemiSky: '#3A4C80', hemiGround: '#1E2B33', hemiIntensity: 0.55, fog: '#1D2647', waterTint: 0.35 }],
];

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const mixHex = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };

export function presetAt(hour: number): LightPreset {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < LIGHT_KEYS.length - 2 && LIGHT_KEYS[i + 1][0] <= h) i++;
  const [h0, a] = LIGHT_KEYS[i], [h1, b] = LIGHT_KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
  const s = t * t * (3 - 2 * t);
  const out = {} as LightPreset;
  for (const k of Object.keys(a) as Array<keyof LightPreset>) {
    const va = a[k], vb = b[k];
    (out as unknown as Record<string, unknown>)[k] = typeof va === 'string' ? mixHex(va, vb as string, s) : (va as number) + ((vb as number) - (va as number)) * s;
  }
  return out;
}

/** Sun (day) or moon (night) direction: elevation in degrees and whether it is the sun. */
export function lightDirection(hour: number): { elevationDeg: number; azimuthDeg: number; isSun: boolean } {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 6 && h <= 19.5) {
    const t = (h - 6) / 13.5;                                  // 0 at sunrise … 1 at sunset
    return { elevationDeg: Math.max(4, Math.sin(Math.PI * t) * 62), azimuthDeg: 90 + 180 * t, isSun: true };
  }
  const n = h > 19.5 ? (h - 19.5) / 10.5 : (h + 4.5) / 10.5;   // 0 … 1 across the night
  return { elevationDeg: 18 + Math.sin(Math.PI * n) * 32, azimuthDeg: 90 + 180 * n, isSun: false };
}

/** Street-light level 0…1: switches on gradually 17:30–18:30, off 06:00–07:00 (V2.0 §7). */
export function streetLightLevel(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  if (h >= 12) return sm(17.5, 18.5, h);
  return 1 - sm(6, 7, h);
}

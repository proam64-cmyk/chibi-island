/**
 * 24-hour world clock (directive V2.0 §7). One game day lasts `dayLengthMin` real minutes
 * (default 48 → 1 game minute every 2 real seconds; decision D-12, configurable).
 */
export type DayPhase = 'dawn' | 'day' | 'evening' | 'night';
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export class WorldClock {
  /** Minutes since 00:00 of day 1. */
  totalMinutes: number;
  paused = false;
  constructor(public dayLengthMin = 48, startHour = 8) { this.totalMinutes = startHour * 60; }

  /** Game minutes that pass per real second. */
  get rate(): number { return 1440 / (this.dayLengthMin * 60); }
  update(dtSeconds: number): void { if (!this.paused) this.totalMinutes += dtSeconds * this.rate; }
  /** Debug / sleeping: jump forward or back by whole game hours. */
  skipHours(h: number): void { this.totalMinutes = Math.max(0, this.totalMinutes + h * 60); }

  get day(): number { return Math.floor(this.totalMinutes / 1440) + 1; }
  get minuteOfDay(): number { return ((this.totalMinutes % 1440) + 1440) % 1440; }
  get hours(): number { return Math.floor(this.minuteOfDay / 60); }
  get minutes(): number { return Math.floor(this.minuteOfDay % 60); }
  /** Hours as a decimal, 0 ≤ h < 24. */
  get hourF(): number { return this.minuteOfDay / 60; }
  get weekday(): (typeof WEEKDAYS)[number] { return WEEKDAYS[(this.day - 1) % 7]; }
  get label(): string { return `${String(this.hours).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')}`; }

  /** Dawn 05–07 · day 07–17 · evening 17–20 · night 20–05 (V2.0 §7). */
  get phase(): DayPhase {
    const h = this.hourF;
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }
}

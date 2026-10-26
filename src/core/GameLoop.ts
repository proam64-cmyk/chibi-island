import type { System } from './System';

/** requestAnimationFrame loop. dt is clamped so a hidden tab or a breakpoint never explodes the simulation. */
export class GameLoop {
  readonly maxDt = 1 / 20;
  private systems: System[] = [];
  private last = 0;
  private elapsed = 0;
  private running = false;
  private rafId = 0;

  add(system: System): void { this.systems.push(system); }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, this.maxDt);
      this.last = now;
      this.elapsed += dt;
      for (const s of this.systems) s.update(dt, this.elapsed);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void { this.running = false; cancelAnimationFrame(this.rafId); }

  dispose(): void {
    this.stop();
    for (const s of this.systems) s.dispose?.();
    this.systems = [];
  }
}

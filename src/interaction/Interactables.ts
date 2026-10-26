/**
 * Interaction targets (V1.0 §5 "E: interact", V2.0 §17). A prompt is shown only when a real action exists.
 * Pure logic: the scene registers targets, the player picks the best one each frame.
 */
export interface Interactable {
  id: string;
  x: number; y: number; z: number;
  /** Maximum distance (m) from the player. */
  radius: number;
  /** i18n key of the prompt, e.g. "interact.sit". */
  promptKey: string;
  /** Optional: only available when this returns true. */
  enabled?: () => boolean;
  action: () => void;
}

export class InteractionSystem {
  private items: Interactable[] = [];
  current: Interactable | null = null;

  add(item: Interactable): void { this.items.push(item); }
  get count(): number { return this.items.length; }

  /**
   * Picks the closest enabled target within its radius that is not behind the player
   * (angle to the facing direction < ~100°). `heading` 0 = facing +Z.
   */
  update(px: number, pz: number, heading: number): Interactable | null {
    let best: Interactable | null = null, bestScore = Infinity;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    for (const it of this.items) {
      if (it.enabled && !it.enabled()) continue;
      const dx = it.x - px, dz = it.z - pz, d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      const facing = d < 0.6 ? 1 : (dx * fx + dz * fz) / d;
      if (facing < -0.2) continue;
      const score = d * (1.6 - facing);
      if (score < bestScore) { bestScore = score; best = it; }
    }
    this.current = best;
    return best;
  }

  /** Runs the current target's action; returns false if there was none. */
  trigger(): boolean {
    if (!this.current) return false;
    this.current.action();
    return true;
  }
}

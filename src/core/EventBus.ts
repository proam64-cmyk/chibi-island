/** Small typed publish/subscribe bus so systems never hold references to each other. */
export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) { set = new Set(); this.listeners.set(type, set); }
    set.add(fn as Listener<never>);
    return () => this.off(type, fn);
  }

  once<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    const off = this.on(type, (p) => { off(); fn(p); });
    return off;
  }

  off<K extends keyof Events>(type: K, fn: Listener<Events[K]>): void {
    this.listeners.get(type)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of [...set]) (fn as Listener<Events[K]>)(payload);
  }

  listenerCount(type: keyof Events): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

/** Events used by the game. Extend per phase. */
export interface GameEvents {
  'assets:progress': { loaded: number; total: number; label: string };
  'assets:error': { id: string; url: string; message: string };
  'assets:done': { failed: string[] };
  'debug:toggle': { visible: boolean };
}

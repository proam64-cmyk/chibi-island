/**
 * Keyboard + mouse + touch input. Systems read a per-frame snapshot (`state`) and the
 * accumulated look/zoom deltas via `consumeLook()` / `consumeZoom()`.
 * The event target is injectable so this class can be unit-tested without a browser.
 */
export interface InputState {
  /** -1..1, + = right */
  moveX: number;
  /** -1..1, + = forward */
  moveY: number;
  run: boolean;
  jumpPressed: boolean;
  /** E / touch interact button, true for one frame. */
  interactPressed: boolean;
}

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
} as const;

type KeyLike = Event & { code?: string; repeat?: boolean; preventDefault(): void };
type PointerLike = Event & { pointerId?: number; pointerType?: string; clientX?: number; clientY?: number; button?: number };
type WheelLike = Event & { deltaY?: number; preventDefault(): void };

export class InputManager {
  readonly state: InputState = { moveX: 0, moveY: 0, run: false, jumpPressed: false, interactPressed: false };
  /** Touch joystick (−1…1, y = forward) and buttons; merged with the keyboard in update(). */
  virtual = { x: 0, y: 0, run: false };
  private interactQueued = false;
  /** Queue a jump / interaction from on-screen buttons. */
  queueJump(): void { this.jumpQueued = true; }
  queueInteract(): void { this.interactQueued = true; }
  /** Seconds since the last camera input (drag/zoom). */
  idleCameraTime = 0;
  /** Keys that toggle features, e.g. 'F3' → fired once per press. */
  private toggleHandlers = new Map<string, () => void>();

  private down = new Set<string>();
  private jumpQueued = false;
  private lookDX = 0;
  private lookDY = 0;
  private zoomDelta = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private disposers: Array<() => void> = [];

  constructor(keyTarget: EventTarget, pointerTarget: EventTarget) {
    this.listen(keyTarget, 'keydown', (e) => this.onKeyDown(e as KeyLike));
    this.listen(keyTarget, 'keyup', (e) => this.onKeyUp(e as KeyLike));
    this.listen(keyTarget, 'blur', () => this.down.clear());
    this.listen(pointerTarget, 'pointerdown', (e) => this.onPointerDown(e as PointerLike));
    this.listen(pointerTarget, 'pointermove', (e) => this.onPointerMove(e as PointerLike));
    this.listen(pointerTarget, 'pointerup', (e) => this.onPointerUp(e as PointerLike));
    this.listen(pointerTarget, 'pointercancel', (e) => this.onPointerUp(e as PointerLike));
    this.listen(pointerTarget, 'wheel', (e) => this.onWheel(e as WheelLike), { passive: false });
    this.listen(pointerTarget, 'contextmenu', (e) => e.preventDefault());
  }

  onToggle(code: string, fn: () => void): void { this.toggleHandlers.set(code, fn); }

  /** Called once per frame before gameplay systems read `state`. */
  update(dt: number): void {
    const axis = (pos: readonly string[], neg: readonly string[]) =>
      (pos.some((k) => this.down.has(k)) ? 1 : 0) - (neg.some((k) => this.down.has(k)) ? 1 : 0);
    let x = axis(MOVE_KEYS.right, MOVE_KEYS.left);
    let y = axis(MOVE_KEYS.forward, MOVE_KEYS.back);
    if (x === 0 && y === 0) { x = this.virtual.x; y = this.virtual.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.state.moveX = x;
    this.state.moveY = y;
    this.state.run = MOVE_KEYS.run.some((k) => this.down.has(k)) || this.virtual.run;
    this.state.jumpPressed = this.jumpQueued;
    this.jumpQueued = false;
    this.state.interactPressed = this.interactQueued;
    this.interactQueued = false;
    this.idleCameraTime += dt;
  }

  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return r;
  }

  consumeZoom(): number { const z = this.zoomDelta; this.zoomDelta = 0; return z; }

  isDown(code: string): boolean { return this.down.has(code); }

  dispose(): void { for (const d of this.disposers) d(); this.disposers = []; }

  // ── handlers ──────────────────────────────────────────────────────────
  private onKeyDown(e: KeyLike): void {
    const code = e.code ?? '';
    if (!code) return;
    if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      if (code === 'Space') this.jumpQueued = true;
      if (code === 'KeyE') this.interactQueued = true;
      this.toggleHandlers.get(code)?.();
    }
    this.down.add(code);
  }

  private onKeyUp(e: KeyLike): void { if (e.code) this.down.delete(e.code); }

  private onPointerDown(e: PointerLike): void {
    if (e.pointerId === undefined) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    this.pointers.set(e.pointerId, { x: e.clientX ?? 0, y: e.clientY ?? 0 });
    const target = e.target as (Element & { setPointerCapture?: (id: number) => void }) | null;
    target?.setPointerCapture?.(e.pointerId);
    if (this.pointers.size === 2) this.pinchDist = this.currentPinch();
  }

  private onPointerMove(e: PointerLike): void {
    if (e.pointerId === undefined) return;
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const x = e.clientX ?? 0, y = e.clientY ?? 0;
    if (this.pointers.size === 1) {
      this.lookDX += x - p.x;
      this.lookDY += y - p.y;
      this.idleCameraTime = 0;
    }
    p.x = x; p.y = y;
    if (this.pointers.size === 2) {
      const d = this.currentPinch();
      if (this.pinchDist > 0) this.zoomDelta += (this.pinchDist - d) * 0.02;
      this.pinchDist = d;
      this.idleCameraTime = 0;
    }
  }

  private onPointerUp(e: PointerLike): void {
    if (e.pointerId === undefined) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
  }

  private onWheel(e: WheelLike): void {
    e.preventDefault();
    this.zoomDelta += Math.sign(e.deltaY ?? 0) * 0.6;
    this.idleCameraTime = 0;
  }

  private currentPinch(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private listen(t: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    t.addEventListener(type, fn, opts);
    this.disposers.push(() => t.removeEventListener(type, fn, opts));
  }
}

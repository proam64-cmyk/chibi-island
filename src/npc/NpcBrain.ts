/**
 * NPC behaviour (Master Game System Prompt V1.0, Phase 4): deterministic finite-state machine, no three.js.
 * Decides WHERE the NPC goes and WHICH WAY it looks; animation and rendering live in Npc.ts.
 *
 *   WORKING ──(work time over)──► WALKING (patrol point) ──► IDLE (short pause) ──► … ──► RETURNING_TO_WORK ──► WORKING
 *      ▲                                   │ player within noticeRadius
 *      └──── player gone ◄── RESPONDING_TO_PLAYER ──(dialogue opened)──► TALKING ──(closed)──► RESPONDING / RETURNING
 */
export type NpcState = 'WORKING' | 'WALKING' | 'IDLE' | 'RESPONDING_TO_PLAYER' | 'TALKING' | 'RETURNING_TO_WORK';
export interface P2 { x: number; z: number }

export interface NpcBrainConfig {
  work: P2 & { heading: number };
  /** Patrol points visited in order between work periods (validated: off roads, outside buildings). */
  patrol: P2[];
  walkSpeed?: number;      // m/s
  noticeRadius?: number;   // m — the NPC stops and turns toward a player this close
  workTime?: [number, number]; // s, random range
  pauseTime?: number;      // s at each patrol point
  greetCooldown?: number;  // s between greetings
  seed?: number;
}

export interface BrainOutput { vx: number; vz: number; heading: number; state: NpcState; greet: boolean }

export function headingTo(from: P2, to: P2): number { return Math.atan2(to.x - from.x, to.z - from.z); }

export class NpcBrain {
  state: NpcState = 'WORKING';
  private timer: number;
  private next = 0;           // index in patrol
  private target: P2 | null = null;
  private heading: number;
  private greetTimer = 0;
  private wasNear = false;
  private rnd: () => number;
  readonly cfg: Required<NpcBrainConfig>;

  constructor(cfg: NpcBrainConfig) {
    this.cfg = { walkSpeed: 1.25, noticeRadius: 4, workTime: [6, 11], pauseTime: 2.5, greetCooldown: 25, seed: 7, ...cfg };
    let s = this.cfg.seed;
    this.rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    this.heading = cfg.work.heading;
    this.timer = this.workDuration();
  }

  private workDuration(): number { const [a, b] = this.cfg.workTime; return a + (b - a) * this.rnd(); }

  update(dt: number, pos: P2, player: P2 | null, talking: boolean): BrainOutput {
    const c = this.cfg;
    this.greetTimer = Math.max(0, this.greetTimer - dt);
    const dPlayer = player ? Math.hypot(player.x - pos.x, player.z - pos.z) : Infinity;
    let greet = false;

    // Player interaction overrides the routine.
    if (talking && player) {
      this.state = 'TALKING';
      this.heading = headingTo(pos, player);
      return { vx: 0, vz: 0, heading: this.heading, state: this.state, greet };
    }
    const near = dPlayer < c.noticeRadius, far = dPlayer > c.noticeRadius + 1.2;
    if (near) {
      if (!this.wasNear && this.greetTimer === 0) { greet = true; this.greetTimer = c.greetCooldown; }
      this.wasNear = true;
      this.state = 'RESPONDING_TO_PLAYER';
      this.heading = headingTo(pos, player!);
      return { vx: 0, vz: 0, heading: this.heading, state: this.state, greet };
    }
    if (this.state === 'RESPONDING_TO_PLAYER' || this.state === 'TALKING') {
      if (!far) return { vx: 0, vz: 0, heading: this.heading, state: this.state, greet };
      this.wasNear = false;
      this.state = 'RETURNING_TO_WORK'; this.target = c.work;
    }
    if (far) this.wasNear = false;

    switch (this.state) {
      case 'WORKING':
        this.heading = c.work.heading;
        this.timer -= dt;
        if (this.timer <= 0 && c.patrol.length) { this.state = 'WALKING'; this.next = 0; this.target = c.patrol[0]; }
        break;
      case 'IDLE':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.next++;
          if (this.next < c.patrol.length) { this.state = 'WALKING'; this.target = c.patrol[this.next]; }
          else { this.state = 'RETURNING_TO_WORK'; this.target = c.work; }
        }
        break;
      case 'WALKING':
      case 'RETURNING_TO_WORK': {
        const t = this.target!;
        const dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.15) {
          if (this.state === 'RETURNING_TO_WORK') { this.state = 'WORKING'; this.timer = this.workDuration(); }
          else { this.state = 'IDLE'; this.timer = c.pauseTime; }
          return { vx: 0, vz: 0, heading: this.heading, state: this.state, greet };
        }
        // Slow down near a player standing in the way (never walk into them).
        let speed = Math.min(c.walkSpeed, d / Math.max(dt, 1e-3));
        if (player) {
          const ahead = ((player.x - pos.x) * dx + (player.z - pos.z) * dz) / d;
          const side = Math.abs((player.x - pos.x) * dz - (player.z - pos.z) * dx) / d;
          if (ahead > 0 && ahead < 1.6 && side < 0.8) speed = 0;
        }
        this.heading = Math.atan2(dx, dz);
        return { vx: (dx / d) * speed, vz: (dz / d) * speed, heading: this.heading, state: this.state, greet };
      }
    }
    return { vx: 0, vz: 0, heading: this.heading, state: this.state, greet };
  }
}

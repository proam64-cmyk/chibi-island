import { CanvasTexture, Group, Sprite, SpriteMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RiggedCharacter } from '../characters/RiggedCharacter';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { InteractionSystem, Interactable } from '../interaction/Interactables';
import { NpcBrain, type NpcBrainConfig, type NpcState } from './NpcBrain';

/** A permanent NPC in the world: rigged model + brain + solid capsule + talk interaction + greeting bubble. */
export class Npc {
  readonly group = new Group();
  readonly character: RiggedCharacter;
  readonly brain: NpcBrain;
  private setCapsule: (x: number, y: number, z: number) => void;
  private heading: number;
  private speed = 0;
  private bubble: Sprite;
  private bubbleTimer = 0;
  readonly interaction: Interactable;
  talking = false;

  constructor(readonly id: string, gltf: GLTF, cfg: NpcBrainConfig, private ground: (x: number, z: number) => number,
    physics: PhysicsWorld, interaction: InteractionSystem, promptKey: string, onTalk: (npc: Npc) => void, private greetText: () => string) {
    this.character = new RiggedCharacter(gltf);
    this.brain = new NpcBrain(cfg);
    this.group.name = id;
    this.group.add(this.character.object);
    const { x, z } = cfg.work;
    this.group.position.set(x, ground(x, z), z);
    this.heading = cfg.work.heading;
    this.group.rotation.y = this.heading;
    this.setCapsule = physics.addNpcCapsule(x, this.group.position.y, z);
    this.bubble = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
    this.bubble.position.set(0, 1.85, 0); this.bubble.visible = false; this.group.add(this.bubble);
    this.interaction = { id, x, y: 0, z, radius: 2.6, promptKey, action: () => onTalk(this) };
    interaction.add(this.interaction);
  }

  get state(): NpcState { return this.brain.state; }

  private showBubble(text: string): void {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.strokeStyle = '#2E3550'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(6, 6, 500, 100, 40); g.fill(); g.stroke();
    g.fillStyle = '#2E3550'; g.font = 'bold 48px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 58);
    const mat = this.bubble.material as SpriteMaterial;
    mat.map?.dispose(); mat.map = new CanvasTexture(c); mat.needsUpdate = true;
    this.bubble.scale.set(1.6, 0.4, 1); this.bubble.visible = true; this.bubbleTimer = 2.8;
  }

  /** `player` = player feet position (x/z). */
  update(dt: number, player: { x: number; z: number }): void {
    const pos = this.group.position;
    const out = this.brain.update(dt, pos, player, this.talking);
    pos.x += out.vx * dt; pos.z += out.vz * dt;
    pos.y = this.ground(pos.x, pos.z);                       // never sinks into the terrain
    this.speed = Math.hypot(out.vx, out.vz);
    // Smooth turn (no instant 180°): max 4 rad/s.
    let d = out.heading - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += Math.sign(d) * Math.min(Math.abs(d), 4 * dt);
    this.group.rotation.y = this.heading;
    if (out.greet) this.showBubble(this.greetText());
    if (this.bubbleTimer > 0) { this.bubbleTimer -= dt; if (this.bubbleTimer <= 0) this.bubble.visible = false; }
    this.setCapsule(pos.x, pos.y, pos.z);
    this.interaction.x = pos.x; this.interaction.z = pos.z;
    this.character.update(dt, this.speed, true);
  }

  say(text: string): void { this.showBubble(text); }
}

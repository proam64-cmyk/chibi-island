import { AnimationAction, AnimationClip, AnimationMixer, BackSide, Bone, Box3, Group, LoopOnce, LoopRepeat, Mesh, MeshBasicMaterial, Object3D, Quaternion, QuaternionKeyframeTrack, SkinnedMesh, Vector3, VectorKeyframeTrack } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toon } from '../config/styleTokens';
import { worldScale } from '../config/worldScale';
import { tf } from '../i18n/i18n';
import { toToonMaterial } from '../render/materials/ToonMaterial';
import type { ReiValidation } from './ReiStatic';

/** Finds a Mixamo bone whatever prefix/sanitizing the loader applied ("mixamorig:LeftArm" → "mixamorigLeftArm"). */
function findBone(root: Object3D, suffix: string): Bone | null {
  let found: Bone | null = null;
  root.traverse((o) => { if (!found && (o as Bone).isBone && o.name.endsWith(suffix)) found = o as Bone; });
  return found;
}

/** Skinned outline: an inverted hull that follows the skeleton. */
function addSkinnedOutline(mesh: SkinnedMesh, worldWidth: number, scale: number): void {
  const mat = new MeshBasicMaterial({ color: toon.outlineCharacter.color, side: BackSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uW = { value: worldWidth / scale };
    sh.vertexShader = 'uniform float uW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uW;');
  };
  mat.customProgramCacheKey = () => 'outline_skinned';
  const outline = new SkinnedMesh(mesh.geometry, mat);
  outline.name = mesh.name + '_outline';
  outline.bind(mesh.skeleton, mesh.bindMatrix);
  outline.frustumCulled = false;
  mesh.parent!.add(outline);
}

/** Gentle idle from the bind A-pose: arms lowered close to the body and slow breathing (Meshy exports no idle). */
function makeIdleClip(root: Object3D): AnimationClip | null {
  root.updateMatrixWorld(true);
  const tracks: QuaternionKeyframeTrack[] = [];
  for (const side of ['Left', 'Right']) {
    const arm = findBone(root, `${side}Arm`), fore = findBone(root, `${side}ForeArm`);
    if (!arm || !fore || !arm.parent) continue;
    const a = arm.getWorldPosition(new Vector3()), f = fore.getWorldPosition(new Vector3());
    const dir = f.sub(a).normalize();
    const out = new Vector3(dir.x, 0, dir.z).normalize();
    const target = new Vector3(0, -Math.cos(0.24), 0).addScaledVector(out, Math.sin(0.24)).normalize();
    const R = new Quaternion().setFromUnitVectors(dir, target);
    const boneW = arm.getWorldQuaternion(new Quaternion()), parentW = arm.parent.getWorldQuaternion(new Quaternion());
    tracks.push(new QuaternionKeyframeTrack(`${arm.name}.quaternion`, [0], parentW.clone().invert().multiply(R).multiply(boneW).toArray()));
  }
  const chest = findBone(root, 'Spine2');
  if (chest) {
    const b = chest.quaternion.clone(), axis = new Vector3(1, 0, 0);
    const k = (deg: number) => b.clone().multiply(new Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180)).toArray();
    tracks.push(new QuaternionKeyframeTrack(`${chest.name}.quaternion`, [0, 1.6, 3.2], [...k(0), ...k(1.6), ...k(0)]));
  }
  return tracks.length ? new AnimationClip('Idle', 3.2, tracks) : null;
}

/** The game moves Rei; clips must not: keep the hips' horizontal position at its first-frame value (vertical bounce stays). */
function stripRootMotion(clip: AnimationClip, hipsName: string): void {
  for (const t of clip.tracks) {
    if (t.name !== `${hipsName}.position` || !(t instanceof VectorKeyframeTrack)) continue;
    const v = t.values, x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
  }
}

/**
 * Emote slots on keys (see main.ts). Each character uses whichever of its own clips match: Meshy exports differ
 * per character (Alana has 6 dances, Mía a pitching clip, E.J. a spin jump…). `loop` = repeats until the player moves.
 */
export const EMOTE_SLOTS = {
  dance: { match: /dance/i, loop: true },          // G cycles through every dance the character has
  backflip: { match: /backflip/i, loop: false },
  pitch: { match: /pitch/i, loop: false },
  punch: { match: /punch/i, loop: false },
  spin: { match: /spin/i, loop: false },
  happyJump: { match: /happy_?jump/i, loop: false },
} as const;
export type EmoteId = keyof typeof EMOTE_SLOTS;

/** Take-off and landing inside `Jump_with_Arms_Open` (measured on the hips track): airborne ≈ 1.45 → 2.15 s. */
const JUMP = { clip: 'Jump_with_Arms_Open', start: 1.35, land: 2.2, end: 2.7 };

/**
 * Any character rigged with Meshy Auto Rigging (Mixamo-style skeleton): toon materials, skinned outline,
 * idle/walk/run blended by speed, jump, emotes. Used for Alana now; NPCs and unlockables later.
 */
export class RiggedCharacter {
  readonly object = new Group();
  readonly mixer: AnimationMixer;
  readonly validation: ReiValidation;
  /** Confident strut instead of the normal walk (key M). */
  strut = false;
  private loco: { idle?: AnimationAction; walk?: AnimationAction; run?: AnimationAction; strut?: AnimationAction } = {};
  private clips = new Map<string, AnimationClip>();
  private emote: AnimationAction | null = null;
  private jumpAction: AnimationAction | null = null;
  private locoWeight = 1;
  private wasGrounded = true;

  constructor(gltf: GLTF) {
    const model = gltf.scene;
    this.object.name = 'RiggedCharacter';
    this.object.add(model);

    model.updateMatrixWorld(true);
    const raw = new Box3().setFromObject(model, true);
    const s = worldScale.reiHeight / Math.max(0.01, raw.max.y - raw.min.y);
    model.scale.multiplyScalar(s);
    model.position.y = -raw.min.y * s;
    model.updateMatrixWorld(true);

    const skinned: SkinnedMesh[] = [];
    model.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.material = toToonMaterial(Array.isArray(m.material) ? m.material[0] : m.material, 'character');
      m.castShadow = true;
      m.frustumCulled = false;
      if ((m as SkinnedMesh).isSkinnedMesh) skinned.push(m as SkinnedMesh);
    });
    const box = new Box3().setFromObject(model, true);
    const height = box.max.y - box.min.y, feet = box.min.y;
    for (const m of skinned) addSkinnedOutline(m, toon.outlineCharacter.width, s);
    this.validation = {
      loaded: true, height, feetOffset: feet,
      ok: Math.abs(height - worldScale.reiHeight) <= 0.02 && Math.abs(feet) <= 0.02,
      message: tf('rei.validation', { h: height.toFixed(3), e: worldScale.reiHeight.toFixed(2), f: (feet >= 0 ? '+' : '') + feet.toFixed(3) }),
    };

    const hips = findBone(model, 'Hips');
    for (const c of gltf.animations) { if (hips) stripRootMotion(c, hips.name); this.clips.set(c.name, c); }
    this.mixer = new AnimationMixer(model);
    const find = (part: string) => gltf.animations.find((a) => a.name.toLowerCase().includes(part));
    const setup = (c: AnimationClip | null | undefined) => {
      if (!c) return undefined;
      const a = this.mixer.clipAction(c);
      a.setLoop(LoopRepeat, Infinity).play();
      a.setEffectiveWeight(0);
      return a;
    };
    this.loco = { idle: setup(makeIdleClip(model)), walk: setup(find('walking')), run: setup(find('running')), strut: setup(find('strut')) };
    this.loco.idle?.setEffectiveWeight(1);
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.emote) this.stopEmote();
    });
  }

  get clipNames(): string[] { return ['idle', 'walk', 'run'].filter((k) => this.loco[k as 'idle' | 'walk' | 'run']); }
  /** Clips available for an emote slot. */
  emoteClips(id: EmoteId): AnimationClip[] { return [...this.clips.values()].filter((c) => EMOTE_SLOTS[id].match.test(c.name) && !/jump_with_arms/i.test(c.name)); }
  get availableEmotes(): EmoteId[] { return (Object.keys(EMOTE_SLOTS) as EmoteId[]).filter((k) => this.emoteClips(k).length > 0); }
  private danceIndex = 0;
  get emoting(): boolean { return this.emote !== null; }

  playEmote(id: EmoteId): boolean {
    const def = EMOTE_SLOTS[id], list = this.emoteClips(id);
    if (!list.length || this.jumpAction) return false;
    const clip = list[(id === 'dance' ? this.danceIndex++ : 0) % list.length];
    if (this.emote) this.emote.fadeOut(0.2);
    const a = this.mixer.clipAction(clip);
    a.reset().setLoop(def.loop ? LoopRepeat : LoopOnce, def.loop ? Infinity : 1);
    a.clampWhenFinished = !def.loop;
    a.setEffectiveWeight(1).fadeIn(0.25).play();
    this.emote = a;
    return true;
  }

  stopEmote(): void {
    if (!this.emote) return;
    this.emote.fadeOut(0.25);
    this.emote = null;
  }

  private startJump(): void {
    const clip = this.clips.get(JUMP.clip);
    if (!clip) return;
    this.stopEmote();
    const a = this.mixer.clipAction(clip);
    a.reset().setLoop(LoopOnce, 1);
    a.clampWhenFinished = true;
    a.time = JUMP.start;
    a.setEffectiveWeight(1).fadeIn(0.08).play();
    this.jumpAction = a;
  }

  /** Blends idle / walk / run from the ground speed (m/s); handles jump take-off/landing and emote cancelling. */
  update(dt: number, speed: number, grounded: boolean, velocityY = 0): void {
    if (this.wasGrounded && !grounded && velocityY > 0) this.startJump();
    this.wasGrounded = grounded;
    if (this.emote && speed > 0.3) this.stopEmote();               // moving cancels emotes
    if (this.jumpAction) {
      const t = this.jumpAction.time;
      const leave = grounded && (t >= JUMP.end || (t >= JUMP.land && speed > 0.3));
      if (leave) { this.jumpAction.fadeOut(0.2); this.jumpAction = null; }
    }
    const target = this.emote || this.jumpAction ? 0 : 1;
    this.locoWeight += (target - this.locoWeight) * Math.min(1, dt * (target ? 6 : 10));

    const s = grounded ? speed : speed * 0.4;
    const idle = Math.max(0, Math.min(1, 1 - s / 0.8));
    const run = Math.max(0, Math.min(1, (s - 2.8) / 1.4));
    const walk = Math.max(0, 1 - idle - run);
    const k = this.locoWeight;
    const useStrut = this.strut && !!this.loco.strut;
    this.loco.idle?.setEffectiveWeight(idle * k);
    if (this.loco.walk) { this.loco.walk.setEffectiveWeight(useStrut ? 0 : walk * k); this.loco.walk.timeScale = Math.max(0.6, s / worldScale.speed.walk); }
    if (this.loco.strut) { this.loco.strut.setEffectiveWeight(useStrut ? walk * k : 0); this.loco.strut.timeScale = Math.max(0.6, s / worldScale.speed.walk); }
    if (this.loco.run) { this.loco.run.setEffectiveWeight(run * k); this.loco.run.timeScale = Math.max(0.7, s / worldScale.speed.run); }
    this.mixer.update(dt);
  }
}

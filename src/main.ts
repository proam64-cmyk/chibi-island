import './style.css';
import { EventBus, type GameEvents } from './core/EventBus';
import { GameLoop } from './core/GameLoop';
import { detectProfile, qualityProfiles } from './config/performanceProfiles';
import { districts } from './config/islandPlan';
import { createRenderer } from './render/RendererManager';
import { InputManager } from './input/InputManager';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { PlayerController } from './characters/PlayerController';
import { type ReiValidation } from './characters/ReiStatic';
import { RiggedCharacter, type EmoteId } from './characters/RiggedCharacter';
import { HelpPanel } from './ui/HelpPanel';
import { AssetLoader } from './assets/AssetLoader';
import { phase1Manifest } from './assets/AssetManifest';
import { IslandScene } from './scene/scenes/IslandScene';
import { districtAt } from './world/island/islandHeight';
import { DiagnosticsPanel } from './debug/DiagnosticsPanel';
import { LoadingScreen } from './ui/LoadingScreen';
import { cycleLang, detectLang, setLang, storedLang, t } from './i18n/i18n';
import { initPhysics, PhysicsWorld } from './physics/PhysicsWorld';
import { InteractionSystem } from './interaction/Interactables';
import { WorldClock } from './world/time/WorldClock';
import { streetLightLevel } from './world/time/dayNight';
import { DayNight } from './render/DayNight';
import { PlazaProps } from './world/props/PlazaProps';
import { Hud } from './ui/Hud';
import { TouchControls } from './ui/TouchControls';
import { DialoguePanel, rinaTree } from './ui/DialoguePanel';
import { Npc } from './npc/Npc';
import { NPC_PLACEMENTS, placementBrain } from './npc/npcPlacements';
import { characters } from './config/characters';
import { groundHeight } from './world/island/islandHeight';
import type { FogExp2 } from 'three';

async function boot(): Promise<void> {
  setLang(storedLang() ?? detectLang(navigator.language));
  const app = document.getElementById('app')!;
  const bus = new EventBus<GameEvents>();
  const profile = qualityProfiles[detectProfile(navigator)];

  const renderer = createRenderer(app, profile);
  const world = new IslandScene(profile);
  const input = new InputManager(window, renderer.domElement);
  const player = new PlayerController(world.heightAt);
  world.scene.add(player.root);
  const cam = new ThirdPersonCamera(1, input, world.heightAt);
  const diagnostics = new DiagnosticsPanel(app, renderer);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = t('hint.controls');
  app.appendChild(hint);

  input.onToggle('F3', () => bus.emit('debug:toggle', { visible: diagnostics.toggle() }));
  input.onToggle('KeyL', () => { cycleLang(); hint.textContent = t('hint.controls'); world.markers.refreshLabels(); help.refresh(); hud.refresh(); touch?.refresh(); dialogue.refresh(); });
  input.onToggle('KeyT', () => { world.markers.visible = !world.markers.visible; });
  input.onToggle('KeyR', () => player.resetOdometer());
  input.onToggle('KeyC', () => player.toggleCapsule());
  const help = new HelpPanel(app);
  input.onToggle('KeyH', () => help.toggle());
  const emoteKeys: Array<[string, EmoteId]> = [['KeyG', 'dance'], ['KeyB', 'backflip'], ['KeyP', 'pitch'], ['KeyK', 'punch'], ['KeyQ', 'spin'], ['KeyJ', 'happyJump']];
  for (const [code, id] of emoteKeys) input.onToggle(code, () => { if (reiAnim && player.grounded && !player.seated) reiAnim.playEmote(id); });
  input.onToggle('KeyN', () => { if (reiAnim) reiAnim.strut = !reiAnim.strut; }); // M is reserved for the world map (D-9)
  // Hito A: clock, HUD, interaction, touch controls
  const clock = new WorldClock(48, 8);
  const hud = new Hud(app);
  const interaction = new InteractionSystem();
  const touch = TouchControls.wanted() ? new TouchControls(app, input) : null;
  input.onToggle('Comma', () => clock.skipHours(-1));   // development helpers (documented in H)
  input.onToggle('Period', () => clock.skipHours(1));
  const dialogue = new DialoguePanel(app);
  const npcs: Npc[] = [];
  input.onToggle('Escape', () => { hud.closeBoard(); dialogue.close(); });
  // Digits: travel (development) — or choose a dialogue answer while a conversation is open.
  districts.forEach((d, i) => input.onToggle(`Digit${(i + 1) % 10}`, () => {
    if (dialogue.open) { dialogue.choose(i); return; }
    player.teleport(...(d.spawn ?? [d.x, d.z]));
  }));

  const resize = () => {
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h, false);
    cam.resize(w / Math.max(1, h));
  };
  new ResizeObserver(resize).observe(app);
  resize();

  // Loading: island terrain, then assets
  const loading = new LoadingScreen(app);
  await initPhysics();
  const physics = new PhysicsWorld();
  world.physics = physics;
  player.physics = physics;
  await world.build((done, total) => loading.step(t('loading.terrain'), done, total));
  console.info('[terrain]', world.stats);
  bus.on('assets:progress', (p) => loading.progress(p.loaded, p.total, p.label));
  bus.on('assets:error', (e) => { loading.error(e.id, e.url, e.message); console.error('[assets]', e); });
  const assets = new AssetLoader(bus);
  let reiAnim: RiggedCharacter | null = null; // the player's rigged character (Alana)
  let plaza: PlazaProps | null = null;
  const dayNight = new DayNight(world.lighting, world.sky, world.scene.fog as FogExp2, world.ocean);
  let rei: ReiValidation = { loaded: false, height: 0, feetOffset: 0, ok: false, message: t('rei.notLoaded') };
  try {
    await assets.loadAll(phase1Manifest);
    const gltf = assets.gltf.get('chr_alana');
    if (gltf) {
      reiAnim = new RiggedCharacter(gltf);
      player.setAvatar(reiAnim.object, true);
      rei = reiAnim.validation;
      console.info('[Alana]', rei.ok ? 'OK' : 'FAIL', rei.message, 'emotes:', reiAnim.availableEmotes);
    }
    const stadium = assets.gltf.get('env_stadium');
    if (stadium) world.addStadium(stadium);
    console.info('[buildings] placed', world.addBuildings((id) => assets.gltf.get(id)));
    world.addVegetation({ palm: assets.gltf.get('veg_palm'), sakura: assets.gltf.get('veg_sakura') });
    plaza = new PlazaProps({ lamp: assets.gltf.get('prop_lamp'), bench: assets.gltf.get('prop_bench'), board: assets.gltf.get('prop_board') }, physics, interaction, {
      sit: (x, y, z, h, sx, sz) => player.sit(x, y, z, h, sx, sz),
      readBoard: () => hud.openBoard(clock),
    });
    world.scene.add(plaza.group);
    // Step 5: permanent NPCs — only VERIFIED characters whose workplace exists.
    for (const pl of NPC_PLACEMENTS) {
      const gltf = assets.gltf.get(pl.asset), rec = characters.find((c) => c.id === pl.characterId);
      if (!gltf || rec?.status !== 'VERIFIED') continue;
      const npc = new Npc(pl.characterId, gltf, placementBrain(pl), groundHeight, physics, interaction, 'interact.talk', (n) => {
        n.talking = true;
        dialogue.onClose = () => { n.talking = false; n.say(t(`${pl.dialogue}.bye`)); };
        dialogue.start(rec.name, rinaTree());
      }, () => t(`${pl.dialogue}.greet`));
      world.scene.add(npc.group);
      npcs.push(npc);
    }
    console.info('[npc]', npcs.map((n) => n.id));
    console.info('[vegetation]', world.vegetation?.counts);
  } catch (err) {
    console.error(err);
  }
  player.teleport(0, 6);
  loading.hide();

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const loop = new GameLoop();
  loop.add({
    name: 'frame',
    update: (dt, elapsed) => {
      input.update(dt);
      clock.update(dt);
      dayNight.apply(clock.hourF);
      plaza?.update(streetLightLevel(clock.hourF), cam.camera.position);
      hud.updateClock(clock);
      // Interaction: E closes the board, stands up, or runs the action in front of the player.
      for (const n of npcs) n.update(dt, player.position);
      const talkingNpc = npcs.find((n) => n.talking);
      if (dialogue.open && talkingNpc && Math.hypot(talkingNpc.group.position.x - player.position.x, talkingNpc.group.position.z - player.position.z) > 4.5) dialogue.close();
      const target = player.seated || hud.boardOpen || dialogue.open ? null : interaction.update(player.position.x, player.position.z, player.heading);
      if (input.state.interactPressed) {
        if (dialogue.open) dialogue.close();
        else if (hud.boardOpen) hud.closeBoard();
        else if (player.seated) player.standUp();
        else interaction.trigger();
      }
      if (hud.boardOpen && Math.hypot(input.state.moveX, input.state.moveY) > 0.3) hud.closeBoard(); // walking away closes it
      const promptKey = hud.boardOpen || dialogue.open ? null : player.seated ? 'interact.stand' : target?.promptKey ?? null;
      hud.setPrompt(promptKey && !touch ? t(promptKey) : null);
      touch?.setInteract(promptKey ? t(promptKey).replace(/^E[:：]\s*/, '') : null);
      world.ocean.update(elapsed);
      world.vegetation?.update(elapsed, cam.camera);
      player.update(dt, input.state, cam.yaw);
      reiAnim?.update(dt, player.speed, player.grounded, player.velocityY);
      cam.update(dt, { position: player.position, heading: player.heading, isMoving: player.isMoving });
      world.sky.position.copy(cam.camera.position);
      world.lighting.follow(player.position);
      renderer.render(world.scene, cam.camera);
      const d = districtAt(player.position.x, player.position.z);
      diagnostics.update(dt, {
        quality: profile.id,
        pixelRatio: renderer.getPixelRatio(),
        player: `x ${player.position.x.toFixed(0)} · y ${player.position.y.toFixed(1)} · z ${player.position.z.toFixed(0)} · ${player.speed.toFixed(1)} m/s`,
        rei: `${rei.ok ? '✓' : '✗'} ${rei.message}`,
        district: d ? t(d.nameKey) : t('debug.none'),
        trip: `${player.odometer.toFixed(0)} m · ${fmtTime(player.travelTime)}`,
        terrain: world.stats ? `${world.stats.chunks} chunks · ${world.stats.ms.toFixed(0)} ms` + (world.vegetation ? ` · 🌴${world.vegetation.counts.palm} 🌸${world.vegetation.counts.sakura} 🌳${world.vegetation.counts.tree} 🌿${world.vegetation.counts.bush}` : '') : '—',
        world: `${clock.label} (${clock.phase}) · colisionadores ${physics.colliders} · farolas ${plaza?.lampCount ?? 0} · recuperaciones ${player.recoveries} · NPC ${npcs.map((n) => `${n.id.replace('npc_', '')}:${n.state}`).join(' ') || '—'}`,
      });
    },
  });
  loop.start();
  Object.assign(window as unknown as Record<string, unknown>, { __chibi: { renderer, world, player, cam, clock, physics, interaction, rei: () => rei } });
}

boot().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.className = 'fatal';
  pre.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
  document.body.appendChild(pre);
});

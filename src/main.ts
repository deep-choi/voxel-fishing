import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';

// 개발 서버를 127.0.0.1로 열면 Firebase 구글 로그인이 막힌다 (허용 도메인은 localhost). 같은 포트의 localhost로 옮긴다
if (import.meta.env.DEV && location.hostname === '127.0.0.1') location.replace(location.href.replace('//127.0.0.1', '//localhost'));
import { Sound } from './audio';
import { BAITS, FLOATS, HOOKS, LINES, MAX_DEPLOYED_RODS, RODS, rodAction, type BaitId } from './game/data';
import { baitProduct } from './game/realCatalog';
import { ACTIVE_FISHERY, canEnterFishery, findFishery } from './game/fisheries';
import { SPECIES, type SpeciesId } from './game/data';
import type { OnlineService } from './game/online';
import { emptyOnlineState, type OnlineTab } from './game/onlineState';
import { tournamentAvailable } from './game/tournament';
import { Environment } from './game/environment';
import { mods } from './game/modifiers';
import { Tournament, TOURNAMENTS, TOURNAMENTS_OPEN } from './game/tournament';
import { Fishing } from './game/fishing';
import { MountedRod } from './game/mountedRods';
import { PlayerProgress } from './game/profile';
import { FishingGrounds } from './game/grounds';
import { VoxelFishModel as FishModel } from './render/voxelFishModel';
import { createPixelPass, type PixelLook } from './render/pixelPass';
import { Float, FishingLine, Hook, Rod, RodHands, Splashes, rodRestElevation, type RodPose } from './render/tackle';
import { Hud, type MenuModal } from './ui/hud';
import { loadSettings, saveSettings, touchEnabled } from './ui/settings';
import { NO_TOUCH, TouchControls, enterFullscreen, type TouchLayout } from './ui/touch';
import { heightAt, PLAYER, shoreDistance, WATER_Y } from './world/lake';
import { Mist } from './world/mist';
import { setupSky, shared } from './world/sky';
import { createTerrain } from './world/terrain';
import { createForest, createGrass, createReeds } from './world/vegetation';
import { createVoxelWorld } from './world/voxel';
import { createFisheryScenery } from './world/fisheryScenery';
import { Water } from './world/water';
import { DECK_Y, FISHING_POSITION_OFFSET, Platforms, type RodSlot } from './world/platforms';

// 진입점: 장면을 세우고, 입력 → 게임 규칙 → 화면·소리를 매 프레임 잇는다.

const params = new URLSearchParams(location.search);
if (params.has('map') && !canEnterFishery(params.get('map'))) {
  const url = new URL(location.href);
  url.searchParams.set('map', ACTIVE_FISHERY.id);
  history.replaceState(null, '', url.href);
  params.set('map', ACTIVE_FISHERY.id);
}
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// 그래픽 스타일: 기본 3D 도트 / ?style=smooth (사실적 시도) / ?style=voxel (마인크래프트풍)
// 그래픽 시안: 도트 계열은 해상도(scale)와 색 처리만 다르다
const PIXEL_LOOKS: Record<string, { scale: number; look: PixelLook }> = {
  // scale 0 = 원래 해상도로 그리고 블록 평균으로 도트를 만든다
  // 밝기 단계는 끈다: 물 같은 매끈한 그라데이션에 등고선이 생기고 물결에 경계가 떨려 자글거린다
  cozy: { scale: 0, look: { levels: 0, dither: 0, sat: 1.08, block: 4 } },
  pixel: { scale: 1 / 3, look: { levels: 16, dither: 0, sat: 1.1 } },
  chunky: { scale: 1 / 5, look: { levels: 10, dither: 0, sat: 1.15 } },
  soft: { scale: 1 / 2.5, look: { levels: 0, dither: 0, sat: 1.05 } },
};
const style = params.get('style') ?? 'voxel';
document.body.classList.toggle('voxel', style === 'voxel');
const pixelPreset = PIXEL_LOOKS[style];
const pixelStyle = !!pixelPreset;
// 도트: 낮은 해상도로 그리고, 확대할 때 픽셀이 뭉개지지 않게
renderer.setPixelRatio(pixelPreset && pixelPreset.scale > 0 ? pixelPreset.scale : Math.min(devicePixelRatio, 1.5));
if (pixelPreset?.look.block) pixelPreset.look.block = Math.round(pixelPreset.look.block * renderer.getPixelRatio());
if (pixelStyle) {
  renderer.domElement.style.imageRendering = 'pixelated';
  document.body.classList.add('pixel');
}
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.03, 12000);
scene.add(camera);
const sky = setupSky(scene, renderer);

// 스타일 비교: ?style=voxel (마인크래프트풍) / ?style=pixel (저해상도 3D 도트)
if (style === 'voxel') scene.add(createVoxelWorld());
else scene.add(createTerrain(), createForest(), createReeds(), createGrass());
const platforms = new Platforms();
scene.add(platforms.group);
const fisheryScenery = createFisheryScenery();
scene.add(fisheryScenery);
const fisheryStars = fisheryScenery.getObjectByName('fishery-stars');
const water = new Water();
scene.add(water.mesh);
if (style === 'cozy') {
  // 해 쪽을 봐도 눈부시지 않게: 해 주변 빛무리와 해 원반을 줄이고 노출을 낮춘다
  const su = sky.sky.material.uniforms;
  su.mieCoefficient.value = 0.0008;
  su.mieDirectionalG.value = 0.65;
  su.turbidity.value = 3.5;
  su.showSunDisc.value = 0;
  renderer.toneMappingExposure = 0.78;
  (water.mesh.material as THREE.ShaderMaterial).uniforms.uSunColor.value.multiplyScalar(0.2);
  // 잔물결을 줄여 숲이 거울처럼 비치게
  (water.mesh.material as THREE.ShaderMaterial).uniforms.uWind.value = 0.35;
}
if (style === 'voxel') {
  // 마인크래프트풍: 맑고 파란 물
  const u = (water.mesh.material as THREE.ShaderMaterial).uniforms;
  u.uDeep.value.set('#1d4f8a');
  u.uShallow.value.set('#3f86b8');
  u.uWind.value = 0.28;
  u.uReflection.value = 0.35;
  u.uGlint.value = 0.08;
  u.uSunColor.value.multiplyScalar(0.25);
  sky.sky.material.uniforms.showSunDisc.value = 0;
  sky.sky.material.uniforms.mieCoefficient.value = 0.0008;
  renderer.toneMappingExposure = 0.92;
}
const mist = new Mist();
scene.add(mist.group);
const mapWater = (water.mesh.material as THREE.ShaderMaterial).uniforms;
mapWater.uDeep.value.set(ACTIVE_FISHERY.palette.deep);
mapWater.uShallow.value.set(ACTIVE_FISHERY.palette.shallow);
mapWater.uWind.value = ACTIVE_FISHERY.wind;
if (scene.fog instanceof THREE.FogExp2) {
  scene.fog.color.set(ACTIVE_FISHERY.palette.fog);
  scene.fog.density = ACTIVE_FISHERY.fogDensity;
}
document.documentElement.style.setProperty('--fishery-accent', ACTIVE_FISHERY.palette.accent);
try { localStorage.setItem('fishing-map-v1', ACTIVE_FISHERY.id); } catch { /* URL에서도 맵을 선택할 수 있다 */ }

const rod = new Rod();
const float = new Float();
const line = new FishingLine();
const leader = new FishingLine();
const hook = new Hook();
const hands = new RodHands();
const hookMouth = new THREE.Vector3();
const splashes = new Splashes();
scene.add(rod.group, float.group, line.line, leader.line, hook.group, hands.group, splashes.points);
// 줄과 대는 수면 반사에서 뺀다 (반사 카메라는 레이어 0만 본다)
const NO_REFLECT = 1;
line.line.layers.set(NO_REFLECT);
leader.line.layers.set(NO_REFLECT);
hook.group.traverse(o => o.layers.set(NO_REFLECT));
hands.group.traverse(o => o.layers.set(NO_REFLECT));
leader.line.visible = false;
rod.group.traverse((o) => o.layers.set(NO_REFLECT));
camera.layers.enable(NO_REFLECT);

const sceneTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: pixelStyle ? 0 : 4 });
// 도트 외곽선은 깊이를 읽는다: 장면을 그리는 첫 버퍼에 깊이 텍스처를 붙인다
if (pixelStyle) sceneTarget.depthTexture = new THREE.DepthTexture(innerWidth, innerHeight);
const composer = new EffectComposer(renderer, sceneTarget);
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));
if (style !== 'voxel') composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), pixelStyle ? 0.08 : 0.14, 0.5, 1.2));
composer.addPass(new OutputPass());
const pixelPass = pixelPreset ? createPixelPass(composer.renderTarget1.depthTexture!, camera, pixelPreset.look) : null;
if (pixelPass) composer.addPass(pixelPass);

const pipCam = new THREE.PerspectiveCamera(20, 200 / 280, 0.02, 3000);
pipCam.layers.enable(NO_REFLECT);

const player = new PlayerProgress();
const grounds = new FishingGrounds();
const env = new Environment();
sky.setDaylight(Math.max(ACTIVE_FISHERY.id === 'moon' ? 0.22 : 0, env.daylight));
if (fisheryStars) fisheryStars.visible = env.night;
const settings = loadSettings();
let tournament: Tournament | null = null;
const idleGame = new Fishing(PLAYER, player, grounds);
idleGame.setRig(player.data.rig);
let game = idleGame;
// 기본은 일반 낚시. 기능 확인이 필요할 때만 ?fast=1로 디버그 모드를 켠다.
idleGame.fastTest = params.get('fast') === '1';
const mounted = new Map<string, MountedRod>();
let active: MountedRod | null = null;
let handBlend = 0;
let parking = false;
const sound = new Sound();
sound.setVolume(settings.volume);
let onlineService: OnlineService | null = null;
let onlinePromise: Promise<OnlineService> | null = null;
function connectOnline() {
  return onlinePromise ??= import('./game/online').then(({ OnlineService }) => {
    onlineService = new OnlineService();
    onlineService.subscribe(state => hud.setOnline(state));
    return onlineService;
  }).catch(error => {
    onlinePromise = null;
    hud.setOnline({ ...emptyOnlineState(), ready: true, error: '온라인 연결에 실패했어요. 다시 로그인해 주세요' });
    throw error;
  });
}

// ── 입력 ─────────────────────────────────

const EYE_HEIGHT = 1.55;
const eye = new THREE.Vector3(PLAYER.x, DECK_Y + EYE_HEIGHT, PLAYER.z);
const walk = { w: false, a: false, s: false, d: false, t: 0, warnAt: -10 };
let yaw = 0;
let pitch = -0.08;
let zoom = false;
let brokenWarnAt = -1e9;
let fov = 55;
const input = { primary: false, lift: false, hookset: false, retrieve: false };

const canvas = renderer.domElement;
const locked = () => document.pointerLockElement === canvas;
const exploring = () => hud.started && !hud.chatting && hud.modal === 'none' && game.phase !== 'landed';
const playing = () => exploring() && active !== null && !parking;
function lock() {
  // 터치 조작에서는 마우스 잠금을 쓰지 않는다
  if (document.body.classList.contains('touch')) return;
  try {
    const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  } catch {
    /* 잠금 불가: 그래도 클릭으로 플레이 */
  }
}

const hud = new Hud(document.getElementById('hud')!, game, player, env, settings, {
  start() {
    sound.start();
    lock();
    applyTouch();
    // 모바일: 입장 버튼을 누른 순간 가로 전체 화면으로
    if (document.body.classList.contains('touch')) enterFullscreen();
    if (game.phase === 'landed' && !landing) hud.showCatch(game.lastCatch);
  },
  sessionEnded() {
    input.primary = input.lift = input.hookset = input.retrieve = false;
    walk.w = walk.a = walk.s = walk.d = false;
    zoom = false;
    hud.showCatch(null);
    applyTouch();
    if (locked()) document.exitPointerLock();
  },
  chatFocus() {
    input.primary = input.lift = input.hookset = input.retrieve = false;
    walk.w = walk.a = walk.s = walk.d = false;
    if (locked()) document.exitPointerLock();
  },
  resume() {
    if (hud.started) { sound.start(); lock(); }
  },
  keep(k) {
    finishCatch(k);
  },
  travel(id) { travelTo(id); },
  fishery(id) { travelFishery(id); },
  online(action, value = '') {
    void connectOnline().then(async service => {
      if (action === 'login') await service.login();
      if (action === 'logout') await service.logout();
      if (action === 'enter') await service.enterFishery();
      if (action === 'nickname') await service.setNickname(value);
      if (action === 'send' && await service.sendChat(value)) hud.clearChatDraft();
      if (action === 'view') {
        const view = JSON.parse(value) as { tab: string | null; species: string; scope: string };
        service.view(view.tab && ['account', 'chat', 'ranking'].includes(view.tab) ? view.tab as OnlineTab : null,
          Object.hasOwn(SPECIES, view.species) ? view.species as SpeciesId : 'crucian', findFishery(view.scope)?.id ?? 'all');
      }
    }).catch(() => hud.toast('온라인 연결에 실패했어요. 다시 시도해 주세요', 'bad'));
  },
  rig(kind, id, target) { changeRig(kind, id, rigGameOf(target)); },
  rigGame(target) { return rigGameOf(target); },
  buy(kind, id) { hud.toast(player.buy(kind, id)); },
  sell() { hud.toast(`살림망 판매 +${player.sellKeepnet()}원`, 'good'); },
  sellOne(id) { hud.toast(player.sellFish(id), 'good'); },
  release(id) { hud.toast(player.releaseFromKeepnet(id)); },
  gather() { hud.toast(player.gatherWorms()); },
  menu(m) { toggleModal(m); },
  craft(id) { hud.toast(player.craftFeed(id), 'good'); },
  take(number) { takeRod(number); },
  feed() { feed(); },
  equip(kind, id) { hud.toast(player.equip(kind, id)); },
  repair(key) { hud.toast(player.repair(key)); },
  deploy(rodId) { deployRod(rodId); },
  recall(slotId) { removeRod(mounted.get(slotId)); },
  learn(id) { hud.toast(player.learn(id), 'good'); },
  claim(kind, id) { hud.toast(kind === 'quest' ? player.claimQuest(id) : player.claimAchievement(id), 'good'); },
  join(id) { joinTournament(id); },
  quit() {
    if (!tournament) return;
    tournament = null; hud.setTournament(null); hud.toast('대회를 포기했어요. 참가비는 돌려받지 못해요', 'bad');
  },
  setting(key, value) {
    if (key === 'sensitivity') settings.sensitivity = Number(value);
    if (key === 'volume') { settings.volume = Number(value); sound.setVolume(settings.volume); }
    if (key === 'touch') { settings.touch = value as typeof settings.touch; applyTouch(); }
    if (key === 'vibrate') settings.vibrate = value === '1';
    saveSettings(settings);
  },
  reset() {
    try { localStorage.removeItem('fishing-player-v1'); localStorage.removeItem('fishing-best'); } catch { /* 지울 수 없어도 새로고침 */ }
    location.reload();
  },
});

// 로그인 상태를 먼저 복원한다. 기존 닉네임이 있으면 기본 맵에 자동 입장한다.
void connectOnline().catch(() => hud.toast('로그인 연결을 다시 시도해 주세요', 'bad'));

// ── 모바일 터치 ───────────────────────────
const touch = new TouchControls(document.getElementById('hud')!, {
  move(x, y) { walk.w = y > 0.35; walk.s = y < -0.35; walk.d = x > 0.35; walk.a = x < -0.35; },
  look(dx, dy) {
    if (!exploring()) return;
    const s = 0.0045 * settings.sensitivity * (fov / 55);
    yaw -= dx * s;
    pitch = THREE.MathUtils.clamp(pitch - dy * s, -1.1, 0.6);
  },
  hold(key, down) {
    if (game.phase === 'landed') return;
    if (key === 'primary') {
      input.primary = down && playing();
      if (down && playing() && (game.phase === 'waiting' || game.phase === 'settling')) input.hookset = true;
    } else {
      input.lift = down && playing();
      if (down && playing()) input.hookset = true;
    }
  },
  tap(action) {
    if (action === 'interact') { if (game.phase === 'landed') finishCatch(true); else if (exploring()) interactSlot(); }
    if (action === 'retrieve') { if (game.phase === 'landed') finishCatch(false); else if (playing()) input.retrieve = true; }
    if (action === 'zoom' && exploring()) zoom = !zoom;
    if (action === 'stow' && exploring()) removeRod();
  },
});
function applyTouch() {
  const on = touchEnabled(settings);
  document.body.classList.toggle('touch', on);
  touch.visible = on && hud.started;
  if (on && locked()) document.exitPointerLock();
}
applyTouch();

/** 터치 버튼: 지금 할 수 있는 동작만. 손에 든 대의 단계에 따라 큰 버튼이 던지기 → 챔질 → 세우기로 바뀐다 */
function touchLayout(interact: string, nearRod: boolean): TouchLayout {
  if (!exploring() || landing || parking) return NO_TOUCH;
  if (active) {
    switch (game.phase) {
      case 'ready': return { main: 'cast', alt: null, chips: ['park', 'stow', 'zoom'], zoomOn: zoom };
      case 'charging': return { main: 'cast', alt: null, chips: [] };
      case 'casting': case 'flying': return { main: 'hookset', alt: null, chips: [], dim: true };
      case 'settling': case 'waiting': return { main: 'hookset', alt: 'retrieve', chips: ['park', 'zoom'], zoomOn: zoom };
      case 'fighting': return { main: 'raise', alt: 'lower', chips: [] };
      default: return NO_TOUCH;
    }
  }
  // 대를 들지 않았을 때도 망원은 늘 쓸 수 있다
  return { main: interact ? 'interact' : null, alt: null, chips: nearRod ? ['stow', 'zoom'] : ['zoom'], zoomOn: zoom, label: interact };
}

function feed() {
  if (!exploring()) return;
  if (!active || !game.feed()) hud.toast('찌가 물에 있을 때 집어 떡밥을 뿌릴 수 있어요. 떡밥 재고도 확인하세요');
}
function joinTournament(id: string) {
  const def = TOURNAMENTS.find(t => t.id === id);
  if (!def) return;
  if (!tournamentAvailable(def)) { hud.toast('이 낚시터에는 대회 대상 어종이 없어요'); return; }
  if (tournament) { hud.toast('이미 대회에 참가 중이에요'); return; }
  if (def.level > player.level) { hud.toast(`레벨 ${def.level}부터 참가할 수 있어요`); return; }
  if (!player.payEntry(def.entry)) { hud.toast('참가비가 부족해요', 'bad'); return; }
  tournament = new Tournament(def);
  hud.setTournament(tournament);
  hud.toast(`${def.name} 시작! ${def.minutes}분 동안 겨룹니다`, 'good');
}
function finishTournament(t: Tournament) {
  const rank = t.rank;
  const prize = t.def.prizes[rank - 1] ?? 0;
  player.finishTournament({ id: t.def.id, name: t.def.name, at: Date.now(), rank, of: t.entries.length, prize, score: t.scoreText(t.player.score) });
  hud.toast(`${t.def.name} 종료 · ${rank}위${prize ? ` · 상금 +${prize}원` : ''}`, rank <= 3 ? 'good' : 'info');
  tournament = null;
  hud.setTournament(null);
}

document.addEventListener('pointerlockchange', () => {
  input.primary = input.lift = false;
  if (!locked() && hud.started && !hud.chatting && hud.modal === 'none' && game.phase !== 'landed') hud.open('pause');
});
document.addEventListener('mousemove', (e) => {
  if (!locked()) return;
  const s = 0.0021 * settings.sensitivity * (fov / 55);
  yaw -= e.movementX * s;
  pitch = THREE.MathUtils.clamp(pitch - e.movementY * s, -1.1, 0.6);
});
canvas.addEventListener('mousedown', (e) => {
  if (!hud.started) return;
  if (hud.chatting) { hud.closeChat(); return; }
  if (hud.modal === 'none') sound.start();
  if (!locked() && hud.modal === 'none') lock();
  if (!playing()) return;
  if (e.button === 0) {
    input.primary = true;
    if (game.phase === 'waiting' || game.phase === 'settling') input.hookset = true;
  }
  if (e.button === 2) {
    input.lift = true;
    input.hookset = true;
  }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) input.primary = false;
  if (e.button === 2) input.lift = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && (e.target.matches('input, textarea') || e.target.isContentEditable)) return;
  if (['Tab', 'Space', 'KeyM'].includes(e.code)) e.preventDefault();
  if (!hud.started) return;
  if (e.code === 'Enter' && !e.repeat && !e.isComposing) { e.preventDefault(); hud.focusChat(); return; }
  if (game.phase === 'landed') {
    if (e.code === 'KeyE') finishCatch(true);
    if (e.code === 'KeyR') finishCatch(false);
    return;
  }
  if (e.code === 'KeyW') walk.w = true;
  if (e.code === 'KeyA') walk.a = true;
  if (e.code === 'KeyS') walk.s = true;
  if (e.code === 'KeyD') walk.d = true;
  if (e.code === 'KeyC') toggleModal('setup');
  if (e.code === 'Tab') toggleModal('keepnet');
  if (e.code === 'KeyM' && !e.repeat) toggleModal('platforms');
  if (e.code === 'KeyB' && !e.repeat) toggleModal('shop');
  if (e.code === 'KeyN' && !e.repeat) toggleModal('market');
  if (e.code === 'KeyJ' && !e.repeat) toggleModal('records');
  if (e.code === 'KeyL' && !e.repeat) toggleModal('onlineRanking');
  if ((e.code === 'KeyG' || e.code === 'Digit4') && !e.repeat) feed();
  if (e.code === 'KeyQ' && !e.repeat) toggleModal('quests');
  if (e.code === 'KeyK' && !e.repeat) toggleModal('skills');
  if (e.code === 'KeyT' && !e.repeat && TOURNAMENTS_OPEN) toggleModal('tournament');
  if (e.code === 'KeyO' && !e.repeat) toggleModal('settings');
  if (e.code === 'KeyV' && !e.repeat) toggleModal('collection');
  if (e.code === 'KeyI' && !e.repeat) toggleModal('inventory');
  if (exploring() && !e.repeat && e.code === 'Digit0') parkRod();
  if (exploring() && !e.repeat && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) takeRod(Number(e.code.slice(-1)));
  if (exploring() && !e.repeat && e.code === 'KeyE') interactSlot();
  if (exploring() && !e.repeat && e.code === 'KeyF') removeRod();
  // 망원: 대를 들지 않아도 둘러보며 확대할 수 있다
  if (exploring() && !e.repeat && e.code === 'KeyZ') zoom = !zoom;
  if (!playing()) return;
  if (e.code === 'KeyR' && !e.repeat) input.retrieve = true;
  if (e.code === 'Space' && !e.repeat) input.hookset = true;
});
addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') walk.w = false;
  if (e.code === 'KeyA') walk.a = false;
  if (e.code === 'KeyS') walk.s = false;
  if (e.code === 'KeyD') walk.d = false;
});
function toggleModal(m: MenuModal) {
  if (hud.modal === m) {
    hud.close();
    return;
  }
  if ((m === 'shop' || m === 'market') && platforms.nearStall(PLAYER.x, PLAYER.z)?.id !== m) {
    hud.toast(`${m === 'shop' ? '낚시점' : '어시장'}은 관리동에 있어요 · M 지도에서 관리동으로 이동하세요`);
    return;
  }
  input.primary = input.lift = false;
  hud.open(m);
  if (locked()) document.exitPointerLock();
}

const busy = () => parking || ['charging', 'casting', 'flying', 'fighting', 'landed'].includes(game.phase);
function savePlacement() {
  player.data.placed = [...player.data.placed.filter(p => (p.fisheryId ?? 'willow') !== ACTIVE_FISHERY.id),
    ...Array.from(mounted.values(), m => ({ slotId: m.slot.id, ownerId: m.game.ownerId, rig: m.game.rig, fisheryId: ACTIVE_FISHERY.id }))];
  player.save();
}
function travelFishery(id: string) {
  const target = findFishery(id);
  if (target && !canEnterFishery(target.id)) { hud.toast('이 낚시터는 아직 준비 중이에요'); return; }
  if (!target || target.id === ACTIVE_FISHERY.id) return;
  if (busy() || Array.from(mounted.values()).some(m => m.game.phase === 'fighting' || m.game.phase === 'landed')) { hud.toast('진행 중인 캐스팅이나 물고기 처리를 마친 뒤 낚시터를 옮겨 주세요'); return; }
  if (tournament) { hud.toast('대회를 마치거나 포기한 뒤 낚시터를 옮겨 주세요'); return; }
  // 다른 맵의 설치 위치는 설정으로 보관한다. 진행 중 입질은 이동 후 이어지지 않는다.
  savePlacement();
  if (player.saveFailed) { hud.toast('진행 저장에 실패했어요. 낚시터 이동을 멈췄습니다', 'bad'); return; }
  const url = new URL(location.href);
  url.searchParams.set('map', target.id);
  location.assign(url.href);
}
/** 채비 창의 대: 자리 id면 그 대, 'default'면 새로 꺼낼 대의 기본 채비 */
function rigGameOf(target: string) {
  return target === 'default' ? idleGame : mounted.get(target)?.game ?? game;
}
/** 채비 바꾸기: 고른 대(g)만 바뀐다. 기본 채비를 바꾸면 새로 꺼내는 대가 그 채비로 나온다 */
function changeRig(kind: string, id: string, g: Fishing = game) {
  if (!g.canRig) return;
  if (kind === 'rod') {
    const rod = RODS.find(r => r.id === id);
    if (!rod) return;
    const used = Array.from(mounted.values()).filter(m => m.game !== g && m.game.rodId === id).length;
    if ((player.data.rods[id] ?? 0) <= used) { hud.toast('사용 가능한 낚싯대가 없어요. 상점에서 구매하세요'); return; }
    g.rodId = id; g.depthSet = Math.min(g.depthSet, rod.line);
  }
  if (kind === 'float' && FLOATS.some(f => f.id === id) && player.data.floats.includes(id)) g.floatId = id;
  if (kind === 'hook' && HOOKS.some(h => h.id === id) && player.data.hooks.includes(id)) g.hookId = id;
  if (kind === 'bait' && Object.hasOwn(BAITS, id)) { g.bait = id as BaitId; g.baitProductId = undefined; }
  if (kind === 'baitProduct') {
    const product = baitProduct(id);
    if (!product || !(player.data.baitProducts[id] > 0)) return;
    if (product.baseBait === 'chum') g.chumProductId = id;
    else { g.bait = product.baseBait; g.baitProductId = id; }
  }
  if (kind === 'chum') g.chumProductId = undefined;
  if (kind === 'line') {
    const idx = Math.max(0, Math.min(LINES.length - 1, Number(id)));
    if (player.data.lines.includes(LINES[idx].id)) g.lineIdx = idx;
  }
  if (kind === 'depth') g.depthSet = Math.max(0.3, Math.min(g.rod.line, Number(id)));
  if (g === idleGame) player.data.rig = g.rig;
  Array.from(mounted.values()).find(m => m.game === g)?.renderNow();
  savePlacement();
}
function selectRod(next: MountedRod | null) {
  if (active) { active.group.visible = true; active.renderNow(); }
  dropFishModel();
  active = next;
  parking = false;
  handBlend = 0;
  game = next?.game ?? idleGame;
  if (next) {
    next.group.visible = false;
    yaw = next.slot.yaw; pitch = -0.15;
    if (game.fish) {
      fishModel = new FishModel(game.fish.sp.look, game.fish.cm / 100);
      scene.add(fishModel.group);
    }
    if (game.phase === 'landed' && game.lastCatch) {
      heldFish = new FishModel(game.lastCatch.species.look, game.lastCatch.cm / 100);
      camera.add(heldFish.group); hud.showCatch(game.lastCatch);
      if (locked()) document.exitPointerLock();
    }
  }
  hud.setGame(game);
  hang.init = false;
  rodYaw = next?.slot.yaw ?? 0; rodElev = next ? rodRestElevation(next.game.rod.length, next.pose.butt.y) : 0;
  input.primary = input.lift = input.hookset = input.retrieve = false;
}

function interactSlot() {
  if (active) { parkRod(); return; }
  const stall = platforms.nearStall(PLAYER.x, PLAYER.z);
  if (stall) { toggleModal(stall.id); return; }
  const slot = platforms.nearestSlot(PLAYER.x, PLAYER.z);
  if (!slot) return;
  prepareSlot(slot);
}

/** 한 좌대의 왼쪽·가운데·오른쪽 자리는 서로 독립된 채비와 입질을 가진다. */
function prepareSlot(slot: RodSlot, rodId?: string) {
  if (busy()) { hud.toast('지금 낚시를 마친 뒤 선택할 수 있어요'); return; }
  let next = mounted.get(slot.id);
  if (!next) {
    if (mounted.size >= MAX_DEPLOYED_RODS) { hud.toast('플레이어당 낚싯대는 총 3대까지 펼칠 수 있어요. F 또는 가방에서 한 대를 회수하세요'); return; }
    let rig = rodId ? { ...player.data.rig, rodId } : player.data.rig;
    const available = (id: string) => (player.data.rods[id] ?? 0) > Array.from(mounted.values()).filter(m => m.game.rodId === id).length;
    if (!available(rig.rodId)) {
      const replacement = RODS.find(r => available(r.id));
      if (!replacement) { hud.toast('보유 낚싯대를 모두 설치했어요. 회수하거나 상점에서 구매하세요'); return; }
      rig = { ...rig, rodId: replacement.id };
    }
    next = new MountedRod(slot, player, grounds, rig);
    next.game.biteBoost = idleGame.biteBoost;
    next.game.fastTest = idleGame.fastTest;
    mounted.set(slot.id, next);
    scene.add(next.group);
    connectGame(next.game);
    savePlacement();
  }
  selectRod(next);
}

function parkRod() {
  if (!active || busy()) return;
  if (!platforms.canReachSlot(PLAYER.x, PLAYER.z, active.slot)) { hud.toast('자신의 좌대에서 거치하세요'); return; }
  parking = true;
  input.primary = input.lift = input.hookset = input.retrieve = false;
}

function takeRod(number: number) {
  if (!Number.isInteger(number) || number < 1 || number > MAX_DEPLOYED_RODS) return;
  const here = platforms.current(PLAYER.x, PLAYER.z);
  const slot = here?.slots[number - 1];
  const next = slot ? mounted.get(slot.id) : Array.from(mounted.values())[number - 1];
  if (next && next === active) return;
  if (active || busy()) { hud.toast('E로 들고 있는 낚싯대를 먼저 거치하세요'); return; }
  if (slot) prepareSlot(slot);
  else if (next) {
    if (!platforms.canReachSlot(PLAYER.x, PLAYER.z, next.slot)) { hud.toast(`${next.slot.platform}번 좌대로 이동하세요`); return; }
    selectRod(next);
  } else { hud.toast('좌대로 이동한 뒤 낚싯대를 꺼내세요'); return; }
  if (hud.modal !== 'none') hud.close();
}

/** 가방에서 그 낚싯대를 꺼내 지금 좌대의 빈 받침대 자리에 든다 */
function deployRod(rodId: string) {
  const here = platforms.current(PLAYER.x, PLAYER.z);
  if (!here) { hud.toast('좌대로 이동한 뒤 꺼내세요'); return; }
  if (active) { hud.toast('E로 들고 있는 낚싯대를 먼저 거치하세요'); return; }
  const free = here.slots.find(s => !mounted.has(s.id));
  if (!free) { hud.toast('이 좌대의 받침대 세 자리가 모두 찼어요'); return; }
  hud.close();
  prepareSlot(free, rodId);
}

/** 낚싯대 회수: 물에 있는 채비를 걷고 받침대에서 내려 가방에 넣는다 (F, 가방의 회수 버튼) */
function removeRod(target?: MountedRod) {
  const slot = platforms.nearestSlot(PLAYER.x, PLAYER.z);
  const placed = target ?? active ?? (slot && mounted.get(slot.id));
  if (!placed) return;
  if (placed === active ? busy() : placed.game.phase === 'fighting') { hud.toast('물고기를 끌어낸 뒤 회수할 수 있어요'); return; }
  if (!placed.game.reelIn()) { hud.toast('지금은 회수할 수 없어요'); return; }
  if (active === placed) selectRod(null);
  mounted.delete(placed.slot.id);
  placed.dispose();
  savePlacement();
  const left = (player.data.rods[placed.game.rodId] ?? 0) - Array.from(mounted.values()).filter(m => m.game.rodId === placed.game.rodId).length;
  hud.toast(`${placed.game.rod.name}을(를) 가방에 넣었어요 · 가방에 ${left}대`, 'good');
}

function travelTo(id: number) {
  if (active) { hud.toast('E로 낚싯대를 거치한 뒤 이동하세요'); return; }
  if (busy()) { hud.toast('지금 낚시를 마친 뒤 이동할 수 있어요'); return; }
  const p = platforms.platforms.find(p => p.id === id);
  if (!p && id !== 0) return;
  selectRod(null);
  // 0번은 관리동: 다리 쪽에서 들어와 왼쪽 낚시점, 오른쪽 어시장을 본다
  if (p) { PLAYER.x = p.x; PLAYER.z = p.z - FISHING_POSITION_OFFSET; }
  else { PLAYER.x = platforms.office.x; PLAYER.z = platforms.office.z + 2.2; }
  eye.set(PLAYER.x, DECK_Y + EYE_HEIGHT, PLAYER.z);
  yaw = 0; pitch = -0.08;
  walk.w = walk.a = walk.s = walk.d = false;
  hud.close();
}

// ── 게임 이벤트 → 화면·소리 ─────────────────────

let fishModel: FishModel | null = null;
let heldFish: FishModel | null = null;

function connectGame(source: Fishing) { source.on((e) => {
  // 입질은 알리지 않는다: 소리·진동·안내 없이 오로지 찌를 보고 알아챈다
  // 파이팅이 끝나면 닳은 장비 상태를 저장한다
  if (e.type === 'lost' && e.reason === 'rod') player.addWear(`rod:${source.rodId}`, 1);
  if (e.type === 'landed' || e.type === 'lost') player.save();
  if (source !== game) {
    if (e.type === 'ripple') water.ripple(e.x, e.z, e.size);
    if (e.type === 'splash') splashes.burst(e.x, e.z, e.size);
    if (e.type === 'hooked') hud.toast('다른 좌대의 낚싯대에 물고기가 걸렸어요!', 'good');
    return;
  }
  switch (e.type) {
    case 'cast':
      sound.cast(e.power);
      break;
    case 'splash':
      splashes.burst(e.x, e.z, e.size);
      // 물고기가 퍼덕이는 첨벙 소리는 나중에 녹음 소리로 넣는다. 지금은 찌가 떨어지는 소리만
      if (game.phase !== 'fighting') sound.splash(e.size, Math.hypot(e.x - eye.x, e.z - eye.z));
      break;
    case 'ripple':
      water.ripple(e.x, e.z, e.size);
      break;
    case 'hookset':
      // 헛챔질: 대가 가볍게 튀고 채비가 물을 털며 대 끝으로 날아온다
      if (!e.hit && game.floatInWater && !game.floatOnLand) {
        missFly = { from: new THREE.Vector3(game.float.x, WATER_Y, game.float.z), t: 0 };
        splashes.burst(game.float.x, game.float.z, 0.3);
      }
      break;
    case 'hooked': {
      const f = game.fish!;
      fishModel?.dispose();
      fishModel = new FishModel(f.sp.look, f.cm / 100);
      scene.add(fishModel.group);
      // 걸림: 대가 고기 쪽으로 "턱" 휘며 멈칫한다. 클수록 묵직하다
      const kp = THREE.MathUtils.clamp(0.4 + f.kg * 0.35, 0.4, 1.6);
      rod.kick(new THREE.Vector3(f.pos.x - rod.tip.x, f.pos.y - rod.tip.y, f.pos.z - rod.tip.z).normalize(), 3 + kp * 3);
      rodElev -= 0.1 * kp;
      jolt = kp;
      if (settings.vibrate) navigator.vibrate?.(Math.round(50 + kp * 60));
      break;
    }
    case 'lost':
      if (e.reason !== 'unhook') sound.snap();
      dropFishModel();
      break;
    case 'landed': {
      if (fishModel) startLanding();
      else holdCatch();
      input.primary = input.lift = false;
      break;
    }
    case 'toast':
      hud.toast(e.text, e.tone);
      break;
    case 'finished':
      hud.showCatch(null);
      if (heldFish) {
        camera.remove(heldFish.group);
        heldFish.dispose();
        heldFish = null;
      }
      if (!e.keep) splashes.burst(PLAYER.x, PLAYER.z - 3.6, 0.4);
      break;
  }
}); }
connectGame(idleGame);
// 설치 위치와 채비를 복원한다. 진행 중인 입질·파이팅은 새 세션에서 시작하지 않는다.
for (const saved of player.data.placed) {
  if ((saved.fisheryId ?? 'willow') !== ACTIVE_FISHERY.id) continue;
  if (mounted.size >= MAX_DEPLOYED_RODS) break;
  const slot = platforms.slots.find(s => s.id === saved.slotId);
  const count = Array.from(mounted.values()).filter(m => m.game.rodId === saved.rig.rodId).length;
  if (!slot || mounted.has(slot.id) || count >= (player.data.rods[saved.rig.rodId] ?? 0)) continue;
  const placed = new MountedRod(slot, player, grounds, saved.rig);
  placed.game.biteBoost = idleGame.biteBoost;
  placed.game.fastTest = idleGame.fastTest;
  mounted.set(slot.id, placed); scene.add(placed.group); connectGame(placed.game);
}

function dropFishModel() {
  if (!fishModel) return;
  scene.remove(fishModel.group);
  fishModel.dispose();
  fishModel = null;
}

function finishCatch(keep: boolean) {
  if (game.phase !== 'landed' || landing) return;
  const c = game.lastCatch!;
  if (keep && player.tooSmall(c)) { hud.toast('금지 체장 미만이라 놓아줘야 해요', 'bad'); return; }
  if (keep && player.keepnet.length >= player.keepnetSpec.capacity) { hud.toast('살림망이 가득 찼어요. 판매하거나 놓아주세요', 'bad'); return; }
  const level = player.level;
  const { xp, bounty } = player.recordCatch(c, keep, active?.slot.platform ?? 0);
  void onlineService?.submitCatch(c).catch(() => hud.toast('온라인 랭킹 저장을 못 했어요. 개인 기록은 저장됐습니다', 'bad'));
  game.finishCatch(keep);
  if (tournament?.submit(c.species.id, c.cm, c.kg)) hud.toast(`대회 기록 반영 · 현재 ${tournament.rank}위`, 'good');
  hud.toast(`+${xp} 경험치 · ${keep ? '살림망에서 판매할 수 있어요' : bounty ? `교란종 수매 +${bounty}원` : '방생 기록 완료'}`, 'good');
  if (player.level > level) hud.toast(`레벨 업! Lv.${player.level} · 기술 포인트 +1 (K)`, 'good');
  if (!locked()) lock();
}

// ── 낚싯대 자세 ─────────────────────────────

let rodYaw = 0;
/** 고기에게 끌려간 대 방향 (라디안) */
let rodDrag = 0;
/** 챔질 순간 화면 덜컹임 (감쇠) */
let jolt = 0;
let lastVibe = 0;
/** 헛챔질로 물에서 날아오는 채비 */
let missFly: { from: THREE.Vector3; t: number } | null = null;
/** 앞치기 대 각도: 채비를 쥐고 있을 때 / 놓으며 살짝 들어 올린 끝 */
const CAST_HOLD_ELEV = 0.32, CAST_END_ELEV = 0.55;
/** 대 각도 (라디안): 파이팅 중 좌클릭으로 세우고 우클릭으로 숙인다 */
let rodElev = 0;
let recover = 1;
const pose: RodPose = { butt: new THREE.Vector3(), dir: new THREE.Vector3() };
const restTip = new THREE.Vector3();
const handButt = new THREE.Vector3();
const hang = { p: new THREE.Vector3(), prev: new THREE.Vector3(), init: false };

function updatePose(dt: number) {
  if (active) {
    handBlend = THREE.MathUtils.clamp(handBlend + dt * (parking ? -5 : 5), 0, 1);
    if (parking && handBlend <= 0) selectRod(null);
  }
  const restElev = active ? rodRestElevation(game.rod.length, active.pose.butt.y) : 0;
  const aiming = game.phase === 'charging' || game.phase === 'casting' || game.phase === 'fighting';
  // 받침틀에서 이 대가 향하던 방향을 기준으로 좌우를 겨눈다
  const base = active?.slot.yaw ?? 0;
  const aim = active ? aiming ? THREE.MathUtils.clamp(yaw, base - 0.65, base + 0.65) : base : yaw - 0.06;
  // 고기가 옆으로 달리면 대 끝이 그쪽으로 끌려간다
  let dragTarget = 0;
  if (game.phase === 'fighting' && game.fish) {
    const fishYaw = Math.atan2(-(game.fish.pos.x - eye.x), -(game.fish.pos.z - eye.z));
    const diff = Math.atan2(Math.sin(fishYaw - aim), Math.cos(fishYaw - aim));
    dragTarget = THREE.MathUtils.clamp(diff * Math.min(1, game.tension / game.rod.power) * 0.6, -0.45, 0.45);
  }
  rodDrag += (dragTarget - rodDrag) * Math.min(1, dt * 3);
  rodYaw += (aim + rodDrag - rodYaw) * Math.min(1, dt * 7);
  if (game.phase === 'fighting') {
    // 무거울수록 대가 천천히 세워진다
    if (input.primary) rodElev += dt * 0.75 * Math.max(0.15, 1 - game.tension / (game.rod.power * 1.35));
    if (input.lift) rodElev -= dt * 0.9;
    // 고기가 대를 끌고 들어간다: 좌클릭으로 버티지 않으면 장력만큼 대가 숙여진다
    rodElev -= dt * 0.8 * Math.max(0, game.tension / game.rod.power - (input.primary ? 0.95 : 0.3));
    rodElev = THREE.MathUtils.clamp(rodElev, restElev, 1.4);
  } else if (landing) {
    rodElev += (1.15 - rodElev) * Math.min(1, dt * 3 / (1 + landing.kg));
  } else {
    // 받침틀에 걸쳐 둔 듯 거의 눕혀 둔다
    rodElev += (restElev - rodElev) * Math.min(1, dt * 3);
  }
  let elev = rodElev;
  // 앞치기: 대는 머리 위로 휘두르지 않는다. 채비를 쥔 채 대를 조금 세웠다가, 놓으면서 살짝 들어 올린다
  if (game.phase === 'charging') elev = CAST_HOLD_ELEV + game.castPower * 0.1;
  else if (game.phase === 'casting') {
    elev = CAST_HOLD_ELEV + 0.1 + (CAST_END_ELEV - CAST_HOLD_ELEV - 0.1) * Math.sin(game.castSwing * Math.PI / 2);
    recover = 0;
  } else {
    recover = Math.min(1, recover + dt * 1.2);
    if (recover < 1) elev = CAST_END_ELEV + (elev - CAST_END_ELEV) * THREE.MathUtils.smoothstep(recover, 0, 1);
  }
  if (game.sinceJerk < 0.4) elev += 0.42 * Math.sin((Math.PI * game.sinceJerk) / 0.4);
  if (game.phase === 'fighting') {
    const ratio = Math.min(1, game.tension / game.rod.power);
    elev += Math.sin(shared.uTime.value * 10) * 0.015 * ratio;
    // 바늘털이: 대와 손이 함께 덜컹거린다
    if (game.fish?.behavior === 'shake') elev += Math.sin(shared.uTime.value * 31) * 0.03 * (0.3 + ratio);
  }
  const c = Math.cos(elev);
  pose.dir.set(-Math.sin(rodYaw) * c, Math.sin(elev), -Math.cos(rodYaw) * c).normalize();
  const fwd = new THREE.Vector3(-Math.sin(rodYaw), 0, -Math.cos(rodYaw));
  const right = new THREE.Vector3(Math.cos(rodYaw), 0, -Math.sin(rodYaw));
  pose.butt.copy(eye).addScaledVector(right, 0.24).addScaledVector(fwd, 0.3);
  pose.butt.y -= 0.46;
  if (active) {
    handButt.copy(eye).addScaledVector(right, 0.3).addScaledVector(fwd, 0.48);
    handButt.y -= 0.7;
    pose.butt.copy(active.pose.butt).lerp(handButt, THREE.MathUtils.smoothstep(handBlend, 0, 1));
  }
  restTip.copy(pose.butt).addScaledVector(pose.dir, game.rod.length);
}

// ── 화면 갱신 ───────────────────────────────

const lineEnd = new THREE.Vector3();
const castHand = new THREE.Vector3();
const castBelow = new THREE.Vector3();
const pull = new THREE.Vector3();

function updateTackle(dt: number) {
  rod.group.visible = float.group.visible = line.line.visible = active !== null;
  hook.group.visible = leader.line.visible = active !== null && game.phase === 'fighting' && fishModel !== null;
  if (!active) { hands.group.visible = false; return; }
  const ph = game.phase;
  // 대를 먼저 그려야 휜 끝 위치가 나온다. 당김 방향은 직전 줄 끝 기준
  pull.subVectors(lineEnd, restTip);
  const hasPull = (game.floatInWater || landing !== null || ph === 'charging') && pull.lengthSq() > 0.01;
  if (hasPull) pull.normalize();
  const bend = landing ? Math.min(0.95, 0.25 + landing.kg * 0.25) : ph === 'charging' ? 0.04 + game.castPower * 0.18 : ph === 'fighting' ? Math.min(1, Math.pow(game.tension / game.rod.power, 0.55)) : ph === 'waiting' || ph === 'settling' ? 0.03 : 0;
  const shaking = ph === 'fighting' && game.fish?.behavior === 'shake';
  const quiver = ph === 'fighting' ? Math.min(1, game.tension / game.rod.power) * (shaking ? 1 : 0.2) : 0;
  rod.update(pose, hasPull ? pull : null, bend, game.rod.length, dt, game.rod.flex, rodAction(game.rodId), quiver);
  // 모바일: 바늘털이마다 짧은 진동
  if (shaking && settings.vibrate && shared.uTime.value - lastVibe > 0.5) { navigator.vibrate?.([20, 30, 20]); lastVibe = shared.uTime.value; }
  hands.update(pose, hud.started && handBlend > 0.25 && (ph !== 'landed' || landing !== null));
  float.setSpec(game.floatSpec);
  updateHookedFish(dt);

  const hanging = ph === 'ready' || ph === 'charging' || ph === 'casting' || ph === 'landed';
  if (ph === 'charging' || ph === 'casting') {
    camera.updateMatrixWorld();
    castHand.set(-0.26, -0.5, -0.42);
    camera.localToWorld(castHand);
    if (ph === 'charging') {
      lineEnd.copy(castHand);
      float.hang(castHand.x, castHand.y + 0.12, castHand.z, 0, 0);
    } else {
      // 손에서 놓은 채비가 수면 가까이 낮게 흔들리며 대 끝 아래로 나간다
      const s = game.castSwing;
      castBelow.copy(rod.tip);
      castBelow.y = Math.max(WATER_Y + 0.15, rod.tip.y - 0.6);
      lineEnd.lerpVectors(castHand, castBelow, s);
      lineEnd.y -= Math.sin(s * Math.PI) * Math.min(0.5, castHand.y - WATER_Y - 0.1);
      const d = new THREE.Vector3().subVectors(lineEnd, rod.tip);
      float.hang(lineEnd.x, lineEnd.y + 0.12, lineEnd.z, Math.atan2(d.z, -d.y) * 0.4, -Math.atan2(d.x, -d.y) * 0.4);
    }
    line.update(rod.tip, lineEnd, 0);
    hang.init = false;
  } else if (missFly && ph === 'ready') {
    // 물에서 들린 채비가 대 끝 아래로 호를 그리며 날아온다. 끝나면 그 기세로 진자가 이어진다
    missFly.t += dt / 0.4;
    const s = Math.min(1, missFly.t);
    const L = Math.min(0.9, Math.max(0.12, rod.tip.y - WATER_Y - 0.08));
    castBelow.copy(rod.tip).y -= L;
    const prev = lineEnd.clone();
    lineEnd.lerpVectors(missFly.from, castBelow, 1 - (1 - s) ** 2);
    lineEnd.y += Math.sin(s * Math.PI) * 0.7;
    const d = new THREE.Vector3().subVectors(lineEnd, rod.tip);
    float.hang(lineEnd.x, lineEnd.y, lineEnd.z, Math.atan2(d.z, -d.y), -Math.atan2(d.x, -d.y));
    line.update(rod.tip, lineEnd, 0);
    float.group.visible = line.line.visible = true;
    if (s >= 1) {
      missFly = null;
      hang.p.copy(lineEnd);
      hang.prev.copy(prev);
      hang.init = true;
    }
  } else if (hanging) {
    // 대 끝에 매달린 찌: 줄 길이 0.9m 진자
    const L = Math.min(0.9, Math.max(0.12, rod.tip.y - WATER_Y - 0.08));
    if (!hang.init) {
      hang.p.copy(rod.tip).y -= L;
      hang.prev.copy(hang.p);
      hang.init = true;
    }
    const vel = new THREE.Vector3().subVectors(hang.p, hang.prev).multiplyScalar(0.985);
    hang.prev.copy(hang.p);
    hang.p.add(vel);
    hang.p.y -= 9.8 * dt * dt;
    const d = new THREE.Vector3().subVectors(hang.p, rod.tip);
    d.setLength(L);
    hang.p.copy(rod.tip).add(d);
    const sx = Math.atan2(d.z, -d.y);
    const sz = -Math.atan2(d.x, -d.y);
    float.hang(hang.p.x, hang.p.y, hang.p.z, sx, sz);
    lineEnd.copy(hang.p);
    line.update(rod.tip, lineEnd, 0);
    float.group.visible = ph !== 'landed';
    line.line.visible = ph !== 'landed';
  } else {
    hang.init = false;
    float.group.visible = true;
    line.line.visible = true;
    const fp = game.float;
    const dx = fp.x - PLAYER.x;
    const dz = fp.z - PLAYER.z;
    const dl = Math.hypot(dx, dz) || 1;
    const away = Math.atan2(-dz / dl, dx / dl);
    // 옆으로 끌리는 입질
    const ox = (-dz / dl) * game.floatSide;
    const oz = (dx / dl) * game.floatSide;
    if (ph === 'flying') {
      float.place(fp.x, fp.y, fp.z, 0.6, away);
      lineEnd.copy(fp);
    } else {
      const y = game.floatOnLand ? fp.y : WATER_Y + game.floatDy;
      float.place(fp.x + ox, y, fp.z + oz, game.floatTilt, away);
      lineEnd.set(fp.x + ox, Math.max(y, WATER_Y), fp.z + oz);
    }
    if (ph === 'fighting' && fishModel) {
      fishModel.getMouth(hookMouth);
      hook.place(hookMouth, rod.tip, lineEnd);
      line.update(rod.tip, float.group.position, game.slack * 0.1);
      leader.update(float.group.position, lineEnd, 0, false);
    } else line.update(rod.tip, lineEnd, game.slack);
  }
  updateLanding(dt);

  // 손에 든 고기: 카메라 앞에서 파닥인다
  if (heldFish) {
    const t = shared.uTime.value;
    const len = heldFish.group.scale.x;
    heldFish.group.position.set(-0.05, -0.06 - len * 0.1, -Math.max(0.42, len * 1.25));
    heldFish.group.rotation.set(0.32 + 0.08 * Math.sin(t * 0.7), 0.55 + 0.1 * Math.sin(t * 0.5), 0.05);
    const flop = Math.max(0, Math.sin(t * 0.9)) ** 6;
    heldFish.amp = 0.02 + flop * 0.12;
    heldFish.freq = 1 + flop * 4;
    heldFish.update(dt);
  }
}

// ── 끌어내기 연출 ─────────────────────────────
// 지친 고기가 바늘을 문 채 수면으로 떠올라 발 앞까지 끌려오고, 물 밖으로 들려 손에 잡힌다.

let landing: { model: FishModel; t: number; dur: number; from: THREE.Vector3; mid: THREE.Vector3; splash: number; lifted: boolean; kg: number } | null = null;
const landMouth = new THREE.Vector3();
const landHand = new THREE.Vector3();
const landEye = new THREE.Vector3();

function startLanding() {
  const model = fishModel!;
  fishModel = null;
  const from = model.getMouth(new THREE.Vector3());
  // 발 앞 수면: 좌대 끝에 가려지지 않게 눈에서 3.8~4.5m 앞
  const dx = from.x - eye.x, dz = from.z - eye.z, d = Math.hypot(dx, dz) || 1;
  const reach = THREE.MathUtils.clamp(d, 3.8, 4.5);
  const kg = game.lastCatch?.kg ?? 0.3;
  const mid = new THREE.Vector3(eye.x + dx / d * reach, WATER_Y + 0.03, eye.z + dz / d * reach);
  landing = { model, t: 0, dur: THREE.MathUtils.clamp(1.6 + Math.abs(d - reach) * 0.4 + Math.max(0, -from.y) * 0.8 + kg * 0.6, 1.8, 4.5), from, mid, splash: 0, lifted: false, kg };
}

function updateLanding(dt: number) {
  if (!landing || !hud.started) return;
  const L = landing, m = L.model;
  L.t += dt;
  const s = Math.min(1, L.t / L.dur), split = 0.6;
  camera.updateMatrixWorld();
  landHand.set(-0.02, -0.14, -0.55);
  camera.localToWorld(landHand);
  m.group.rotation.order = 'YZX';
  if (s < split) {
    // 1) 물속에서 떠오르며 발 앞으로 끌려온다. 머리는 나를 향하고 꼬리가 뒤에서 퍼덕인다
    const k = THREE.MathUtils.smoothstep(s / split, 0, 1);
    landMouth.lerpVectors(L.from, L.mid, k);
    landMouth.y = THREE.MathUtils.lerp(L.from.y, L.mid.y, Math.min(1, s / split * 2));
    m.group.rotation.set(Math.sin(L.t * 14) * 0.15, Math.atan2(-(L.mid.z - L.from.z), L.mid.x - L.from.x), 0.1);
    m.amp = 0.1; m.freq = 3.4;
    L.splash -= dt;
    if (L.splash <= 0 && landMouth.y > WATER_Y - 0.2) { splashes.burst(landMouth.x, landMouth.z, 0.3); L.splash = 0.3; }
  } else {
    // 2) 물 밖으로 들려 올라와 손으로: 머리가 위로, 꼬리는 아래로 매달려 파닥인다
    const k = THREE.MathUtils.smoothstep((s - split) / (1 - split), 0, 1);
    if (!L.lifted) { L.lifted = true; splashes.burst(L.mid.x, L.mid.z, 0.6); }
    landMouth.lerpVectors(L.mid, landHand, k);
    landMouth.y += Math.sin(k * Math.PI) * 0.3;
    m.group.rotation.set(Math.sin(L.t * 11) * 0.25, Math.atan2(-(landHand.z - L.mid.z), landHand.x - L.mid.x), 1.25 * Math.min(1, k * 2));
    m.amp = 0.16; m.freq = 4.5;
  }
  m.update(dt);
  m.attachMouth(landMouth);
  // 시선이 끌려오는 고기를 따라 내려간다
  const lookDown = THREE.MathUtils.clamp(Math.atan2(landMouth.y - eye.y, Math.hypot(landMouth.x - eye.x, landMouth.z - eye.z)), -0.9, 0.1);
  if (s < split) pitch += (lookDown - pitch) * Math.min(1, dt * 4);
  // 대 끝 → 찌 → 목줄 → 입에 걸린 바늘
  const toTip = landEye.subVectors(rod.tip, landMouth);
  const span = toTip.length();
  const fp = landMouth.clone().addScaledVector(toTip.normalize(), Math.min(0.5, span * 0.35));
  const fd = new THREE.Vector3().subVectors(fp, rod.tip);
  float.hang(fp.x, fp.y, fp.z, Math.atan2(fd.z, -fd.y), -Math.atan2(fd.x, -fd.y));
  float.group.visible = line.line.visible = hook.group.visible = leader.line.visible = true;
  hook.place(landMouth, rod.tip, hookMouth);
  line.update(rod.tip, float.group.position, 0);
  leader.update(float.group.position, hookMouth, 0, false);
  lineEnd.copy(landMouth);
  if (s >= 1) {
    landing = null;
    scene.remove(m.group);
    m.dispose();
    holdCatch();
  }
}

/** 손에 든 고기와 조과 카드 */
function holdCatch() {
  const c = game.lastCatch;
  if (!c || game.phase !== 'landed' || heldFish) return;
  heldFish = new FishModel(c.species.look, c.cm / 100);
  camera.add(heldFish.group);
  hud.showCatch(c);
  if (locked()) document.exitPointerLock();
}

function updateHookedFish(dt: number) {
  if (!fishModel || !game.fish) return;
  const f = game.fish;
  const speed = f.vel.length();
  // 당겨질 때 입이 줄 쪽을 향한다. 몸통과 꼬리가 뒤에서 저항한다.
  const dx = rod.tip.x - f.pos.x, dz = rod.tip.z - f.pos.z;
  const heading = Math.atan2(-dz, dx);
  const turn = Math.atan2(Math.sin(heading - fishModel.group.rotation.y), Math.cos(heading - fishModel.group.rotation.y));
  fishModel.group.rotation.order = 'YZX';
  fishModel.group.rotation.y += turn * Math.min(1, dt * 10);
  fishModel.group.rotation.z = Math.atan2(rod.tip.y - f.pos.y, Math.hypot(dx, dz)) * 0.25;
  fishModel.group.rotation.x = Math.sin(shared.uTime.value * 9) * 0.12 * f.stamina;
  fishModel.amp = 0.025 + 0.06 * f.stamina;
  fishModel.freq = 1.5 + Math.min(4, speed * 1.5);
  fishModel.bend = THREE.MathUtils.clamp(-turn * 0.4, -0.3, 0.3);
  fishModel.update(dt);
  fishModel.attachMouth(f.pos);
}

// 걷기: 땅 위에서만, 채비를 걷어 들였을 때만
function updateWalk(dt: number, t: number) {
  const ix = (walk.d ? 1 : 0) - (walk.a ? 1 : 0);
  const iz = (walk.w ? 1 : 0) - (walk.s ? 1 : 0);
  let moving = false;
  if ((ix || iz) && exploring()) {
    if (busy() || active && game.phase !== 'ready') {
      if (t - walk.warnAt > 3) {
        hud.toast('E로 대를 거치한 뒤 이동하세요', 'info');
        walk.warnAt = t;
      }
    } else {
      // 걷기 시작하면 망원이 풀린다
      zoom = false;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      let dx = fx * iz + -fz * ix;
      let dz = fz * iz + fx * ix;
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * 4.2 * dt;
      dz = (dz / len) * 4.2 * dt;
      const h0 = platforms.surfaceAt(PLAYER.x, PLAYER.z) ?? heightAt(PLAYER.x, PLAYER.z);
      const ok = (x: number, z: number) => (!active || platforms.canReachSlot(x, z, active.slot)) && (platforms.surfaceAt(x, z) !== null
        ? platforms.canWalk(x, z)
        : shoreDistance(x, z) > 0.8 && Math.abs(heightAt(x, z) - h0) < 0.4 && heightAt(x, z) < 30);
      // 막히면 축 하나로 미끄러지듯 이동
      if (ok(PLAYER.x + dx, PLAYER.z + dz)) {
        PLAYER.x += dx;
        PLAYER.z += dz;
        moving = true;
      } else if (ok(PLAYER.x + dx, PLAYER.z)) {
        PLAYER.x += dx;
        moving = true;
      } else if (ok(PLAYER.x, PLAYER.z + dz)) {
        PLAYER.z += dz;
        moving = true;
      }
    }
  }
  if (moving) walk.t += dt;
  const bob = moving ? Math.abs(Math.sin(walk.t * 7)) * 0.04 : 0;
  const ground = (platforms.surfaceAt(PLAYER.x, PLAYER.z) ?? heightAt(PLAYER.x, PLAYER.z)) + EYE_HEIGHT + bob;
  eye.x = PLAYER.x;
  eye.z = PLAYER.z;
  eye.y += (ground - eye.y) * Math.min(1, dt * 12);
}

function updateCamera(dt: number, t: number) {
  if (!hud.started) {
    camera.position.set(66, 42, platforms.platforms[0].z + 76);
    camera.lookAt(0, 0, platforms.platforms[0].z - 37);
    return;
  }
  // 앉아서 숨 쉬는 정도의 미세한 흔들림
  camera.position.set(eye.x + Math.sin(t * 0.37) * 0.006, eye.y + Math.sin(t * 0.9) * 0.008, eye.z);
  const load = game.phase === 'fighting' ? Math.min(1, game.tension / game.rod.power) : 0;
  camera.position.y += Math.sin(t * 13) * load * 0.008;
  camera.position.x += Math.sin(t * 9) * load * 0.006;
  camera.rotation.order = 'YXZ';
  jolt *= Math.exp(-dt * 7);
  const shakeCam = game.phase === 'fighting' && game.fish?.behavior === 'shake' ? load : 0;
  camera.rotation.set(pitch + Math.sin(t * 11) * load * 0.004 + Math.sin(t * 29) * (jolt * 0.012 + shakeCam * 0.004) - jolt * 0.01,
    yaw + Math.sin(t * 8) * load * 0.003 + Math.sin(t * 23) * shakeCam * 0.003, 0);
  const targetFov = zoom ? 18 : 55;
  fov += (targetFov - fov) * Math.min(1, dt * 6);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

/** 찌 확대 창: 끔. 찌는 Z 망원으로 직접 본다 */
const SHOW_PIP = false;
function renderPip() {
  if (!SHOW_PIP) return false;
  const show = hud.started && active !== null && (game.phase === 'settling' || game.phase === 'waiting') && !game.floatOnLand;
  if (!show) return false;
  const r = hud.pipRect;
  const fp = game.float;
  const dir = new THREE.Vector3(PLAYER.x - fp.x, 0, PLAYER.z - fp.z).normalize();
  // 찌톱 높이 (m): 마디 하나 약 2cm. 장찌는 길고 단찌는 짧다
  const top = Math.max(0.02, game.floatDy + (game.floatSpec.notches ?? 10) * 0.02 * game.floatSpec.scale);
  const look = WATER_Y + Math.min(0.1, top * 0.6) + Math.max(0, top - 0.16) * 0.6;
  pipCam.position.set(fp.x + dir.x * 1.1, look + 0.08, fp.z + dir.z * 1.1);
  pipCam.lookAt(fp.x, look, fp.z);
  pipCam.aspect = r.w / r.h;
  pipCam.updateProjectionMatrix();
  const y = innerHeight - r.y - r.h;
  renderer.setScissorTest(true);
  renderer.setScissor(r.x, y, r.w, r.h);
  renderer.setViewport(r.x, y, r.w, r.h);
  renderer.render(scene, pipCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  return true;
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  if (pixelPass) pixelPass.uniforms.uRes.value.set(composer.renderTarget1.width, composer.renderTarget1.height);
  water.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
}
addEventListener('resize', resize);
resize();

// ── 시간·날씨·컨디션 → 낚시 보정값 ─────────────────

mods.bite = sp => env.biteMul(sp);
mods.lineStrength = id => (1 - 0.4 * player.wearOf(`line:${id}`)) * (1 + 0.04 * player.data.skills.strength);
mods.rodPower = id => 1 - 0.3 * player.wearOf(`rod:${id}`);

function updateWorld(dt: number) {
  env.update(dt);
  if (fisheryStars) fisheryStars.visible = env.night;
  const d = player.data;
  const fighting = active !== null && game.phase === 'fighting';
  mods.hookWindow = d.skills.hookset * 0.06 - (env.night && !game.floatSpec.glow ? 0.15 : 0);
  mods.chum = 1 + 0.15 * d.skills.chum;
  mods.wave = { clear: 1, cloudy: 1.5, rain: 2.6, fog: 0.8 }[env.weather] ?? 1;
  mods.netMaxKg = player.netSpec.maxKg;
  // 파이팅 중 장력이 클수록 원줄과 낚싯대가 닳는다
  if (fighting) {
    const line = LINES[game.lineIdx], rodBase = RODS.find(r => r.id === game.rodId)!;
    player.addWear(`line:${line.id}`, dt * (game.tension / line.strength) ** 3 * 0.004);
    player.addWear(`rod:${rodBase.id}`, dt * Math.min(1.5, game.tension / rodBase.power) ** 3 * 0.002);
  }
  if (tournament) {
    tournament.update(dt);
    if (tournament.done) finishTournament(tournament);
  }
  // 밤: 해·하늘빛을 줄이고 케미·전자찌를 밝힌다
  sky.setDaylight(Math.max(ACTIVE_FISHERY.id === 'moon' ? 0.22 : 0, env.daylight));
  // 해 질 녘부터 어두울수록 서서히 밝아진다. 야광찌가 아니면 밤에 거의 안 보인다
  const dark = THREE.MathUtils.smoothstep(1 - env.daylight, 0.25, 0.75);
  sound.setAmbience(dark, env.weather === 'rain');
  const glowOn = (g: Fishing) => {
    const s = g.floatSpec, lit = s.glow ?? 0;
    // 변색 전자찌: 찌가 올라오면 색이 바뀐다
    const color = s.shift && g.floatRise > 0.03 ? s.shift : s.glowColor ?? (s.light === 'electro' ? '#ff5a3c' : '#d4ff6a');
    return [lit ? 0.35 + lit * dark * 2.5 : 0.35 - 0.2 * dark, lit ? Math.min(1, dark * 1.6) : 0, color] as const;
  };
  float.setGlow(...glowOn(game));
  for (const placed of mounted.values()) placed.float.setGlow(...glowOn(placed.game));
}

// ── 루프 ──────────────────────────────────

const timer = new THREE.Timer();
timer.connect(document);
let simTime = 0;

function frame(dt: number, render = true) {
  const paused = !hud.started || hud.modal === 'pause';
  simTime += dt;
  const t = simTime;
  shared.uTime.value = t;

  updateWalk(dt, t);
  updatePose(dt);
  if (!paused) {
    if (hud.started) updateWorld(dt);
    grounds.update(dt);
    // 챔질(대를 드는 순간) 망원이 풀린다
    if (input.hookset && playing() && handBlend >= 0.85) zoom = false;
    // 부러진 낚싯대는 수리하기 전까지 던질 수 없다
    const broken = game.phase === 'ready' && player.wearOf(`rod:${game.rodId}`) >= 1;
    if (broken && input.primary && playing() && performance.now() - brokenWarnAt > 3000) {
      hud.toast('부러진 낚싯대예요 · 관리동 낚시점에서 수리할 수 있어요', 'bad');
      brokenWarnAt = performance.now();
    }
    game.update({
      dt,
      primary: input.primary && playing() && handBlend >= 0.85 && !broken,
      lift: input.lift && playing() && handBlend >= 0.85,
      hookset: input.hookset && playing() && handBlend >= 0.85,
      retrieve: input.retrieve && playing() && handBlend >= 0.85,
      aimYaw: active ? rodYaw : rodYaw + 0.06,
      tip: restTip,
      rodDir: pose.dir,
    });
    for (const placed of mounted.values()) placed.update(dt, placed === active);
  }
  if (!playing() || handBlend >= 0.85) input.hookset = input.retrieve = false;
  updateTackle(dt);
  updateCamera(dt, t);
  splashes.update(dt);
  mist.update(t);
  sky.update(t);
  sky.follow(eye);
  const audibleFight = hud.modal === 'none' && active !== null && game.phase === 'fighting';
  const f = audibleFight ? game.fish : null;
  sound.update(dt, audibleFight ? game.tension / game.line.strength : 0, f?.behavior === 'shake' ? 1 : 0, f && f.pos.y > -1.2 ? Math.max(0, f.vel.length() - 0.8) / 2.5 : 0);
  if (!render) return;
  composer.render();
  const pipOn = renderPip();
  const near = platforms.nearestSlot(PLAYER.x, PLAYER.z);
  const here = platforms.current(PLAYER.x, PLAYER.z);
  hud.setPlatforms(platforms.platforms.map(p => ({ id: p.id, name: p.name,
    rods: p.slots.filter(s => mounted.has(s.id)).length,
    bites: p.slots.filter(s => mounted.get(s.id)?.game.phase === 'fighting').length,
  })), here?.id ?? null);
  const nearRod = near ? mounted.get(near.id) : undefined;
  const stallNear = platforms.nearStall(PLAYER.x, PLAYER.z);
  const prompt = active
    ? !parking && (game.phase === 'waiting' || game.phase === 'settling') ? '<kbd>E</kbd> 거치' : ''
    : stallNear ? `<kbd>E</kbd> ${stallNear.name}`
    : nearRod ? '<kbd>E</kbd> 들기'
    : near && mounted.size < MAX_DEPLOYED_RODS ? '<kbd>E</kbd> 낚싯대 꺼내기' : '';
  hud.setInteraction(prompt, active ? `${active.slot.platform}번 좌대 · 낚싯대 ${active.slot.number}` : null);
  if (document.body.classList.contains('touch')) {
    const label = stallNear ? stallNear.name : nearRod ? '들기' : near && mounted.size < MAX_DEPLOYED_RODS ? '꺼내기' : '';
    touch.setLayout(touchLayout(label, !!nearRod));
  }
  hud.setRodSlots(Array.from(mounted.values(), (m, i) => ({ slotId: m.slot.id, number: here ? m.slot.number : i + 1, rodId: m.game.rodId, name: m.game.rod.name, platform: m.slot.platform,
    state: m === active ? parking ? '거치 중' : '손에 듦' : m.game.phase === 'fighting' ? '물고기 걸림' : '거치됨',
    active: m === active, biting: m.game.phase === 'fighting' })));
  for (const s of platforms.slots) {
    const g = mounted.get(s.id)?.game;
    const biting = g?.phase === 'fighting';
    const mat = s.marker.material as THREE.MeshLambertMaterial;
    // 받침대 표시: 물고기 걸림 주황 / 거치 초록 / 빈자리 노랑 (입질은 표시하지 않는다)
    mat.color.set(biting ? '#ffae62' : mounted.has(s.id) ? '#83b8a4' : '#eac67d');
    mat.emissiveIntensity = biting ? 0.7 + Math.sin(t * 8) * 0.3 : 0.2;
  }
  hud.update(pipOn);
}

renderer.setAnimationLoop(() => {
  timer.update();
  frame(Math.min(0.05, timer.getDelta()));
});

// 디버그·자동 테스트용 손잡이
Object.assign(window, {
  __fish: {
    get game() { return game; },
    scene,
    platforms,
    mounted,
    player: PLAYER,
    hud,
    env,
    progress: player,
    get tournament() { return tournament; },
    joinTournament,
    interactSlot,
    removeRod,
    travelTo,
    water,
    parts: { rod, float, line, splashes, mist },
    setLook(y: number, p: number) {
      yaw = y;
      pitch = p;
    },
    press(key: 'primary' | 'lift' | 'hookset', down: boolean) {
      input[key] = down;
    },
    /** 창이 뒤에 있어 루프가 멈췄을 때: 초 단위로 직접 진행 */
    step(seconds: number, render = true) {
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) frame(1 / 60, render && i === n - 1);
    },
    start() {
      return hud.enterGame();
    },
  },
});

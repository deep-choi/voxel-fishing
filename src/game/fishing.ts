import * as THREE from 'three';
import { heightAt, PLAYER, spotQuality, waterDepth, WATER_Y } from '../world/lake';
import { smoothstep } from '../world/noise';
import { BAITS, FLOATS, HOOKS, LINES, RODS, SPECIES_LIST, rankOf, weightKg, type BaitId, type Species } from './data';
import { baitProduct } from './realCatalog';
import { encounterRates, biteProbability, pickEncounter, pickEncounterLength, type EncounterRate } from './ecology';
import { ACTIVE_FISHERY } from './fisheries';
import { FishingGrounds } from './grounds';
import type { Rig } from './profile';
import { mods } from './modifiers';
import { baitPresentation, hookFit, hookHoldingPower, hookSetChance, rigSensitivity } from './rigMechanics';

// 민장대 찌낚시 한 판의 규칙: 앞치기 → 찌 서기 → 입질 → 챔질 → 대 세워 버티기 → 랜딩.
// 릴이 없어 줄 길이는 고정. 고기는 대를 세우고 숙여서 다룬다.
// 화면과 소리는 이 상태를 읽어 그리고, 결과는 이벤트로 받는다.

export type Phase = 'ready' | 'charging' | 'casting' | 'flying' | 'settling' | 'waiting' | 'fighting' | 'landed';

export interface FrameInput {
  dt: number;
  /** 좌클릭 누름: 준비 중엔 앞치기 힘 모으기, 파이팅 중엔 대 세우기 */
  primary: boolean;
  /** 우클릭 누름: 파이팅 중 대 숙이기 */
  lift: boolean;
  /** 이번 프레임에 챔질 (좌클릭/우클릭/스페이스 누른 순간) */
  hookset: boolean;
  /** 채비 걷기 (R키) */
  retrieve?: boolean;
  aimYaw: number;
  /** 낚싯대 끝 (휘지 않은 상태) 월드 위치 */
  tip: THREE.Vector3;
  /** 낚싯대 방향 (손잡이 → 끝, 단위 벡터) */
  rodDir: THREE.Vector3;
}

export type GameEvent =
  | { type: 'bite' }
  | { type: 'cast'; power: number }
  | { type: 'splash'; x: number; z: number; size: number }
  | { type: 'ripple'; x: number; z: number; size: number }
  | { type: 'hookset'; hit: boolean }
  | { type: 'hooked' }
  | { type: 'lost'; reason: 'break' | 'unhook' | 'rod' }
  | { type: 'landed' }
  | { type: 'finished'; keep: boolean }
  | { type: 'retrieved' }
  | { type: 'toast'; text: string; tone?: 'good' | 'bad' | 'info' };

export interface Catch {
  /** 저장 기록 id (기록한 뒤 채워진다) */
  id?: string;
  species: Species;
  cm: number;
  kg: number;
  rank: string | null;
  best: boolean;
  at: number;
}

interface BiteWindow {
  t0: number;
  t1: number;
  p0: number;
  p1: number;
}

interface Bite {
  sp: Species;
  cm: number;
  t: number;
  /** [시간, 찌 높이 변화(m), 옆 이동(m)] */
  keys: [number, number, number][];
  windows: BiteWindow[];
  end: number;
  /** 아무도 챔질하지 않으면: 떠나거나, 스스로 바늘에 걸려 달린다 */
  selfHook: boolean;
}

type Behavior = 'run' | 'shake' | 'dive' | 'rest';

interface Fish {
  sp: Species;
  cm: number;
  kg: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  stamina: number;
  /** 움직임·버티는 힘 (손맛용으로 실제보다 세게) */
  maxPull: number;
  /** 원줄에 실리는 실제 당김 (kgf). 장력 게이지·줄 터짐·대 부러짐은 이 값으로 */
  pullKg: number;
  behavior: Behavior;
  bTime: number;
  dir: THREE.Vector3;
  hookHold: number;
  slackRisk: number;
  splashT: number;
}

const G = 9.81;
const gauss = () => {
  const u = Math.max(Math.random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** 찌톱 마디: 10마디, 한 마디 약 2cm (render/tackle.ts의 찌톱과 맞춘다) */
const NOTCH_M = 0.02;

/** 고기 힘 배수: 손맛을 위해 실제보다 세게 (작은 붕어도 초릿대가 확실히 휜다) */
const FISH_POWER = 1.8;
/** 낚싯대 허용 하중(힘)의 이 배수를 넘기면 부러진다 */
const ROD_BREAK = 1.25;
/** 앞치기에서 채비를 놓은 뒤 대 끝 아래로 흔들려 나가는 시간 (초) */
const CAST_SWING = 0.6;

export class Fishing {
  phase: Phase = 'ready';
  // 채비 설정
  bait: BaitId = 'worm';
  baitProductId?: string;
  chumProductId?: string;
  depthSet = 1.8;
  lineIdx = 1;
  rodId = 'starter';
  floatId = 'basic';
  hookId = 'small';
  readonly ownerId: string;

  castPower = 0;
  /** 캐스팅 휘두르기 진행 (0~1), 화면용 */
  castSwing = 0;
  /** 마지막 챔질 후 경과 시간, 화면용 */
  sinceJerk = 99;

  readonly float = new THREE.Vector3();
  floatDy = 0;
  floatTilt = 1;
  floatSide = 0;
  floatOnLand = false;
  /** 발 앞에서 지친 고기를 들어 올리며 버틴 시간 */
  private liftT = 0;
  /** 찌맞춤: 물 위로 내놓는 찌톱 마디 수 (기본 1목). 나중에 채비 설정에서 바꾼다 */
  trimNotches = 1;
  /** 고기가 모였을 때 찌가 들썩이는 작은 움직임 (입질 아님) */
  private stirT = 0;
  private stirA = 0;
  private sliceT = 0;
  lineOut = 0;
  tension = 0;
  /** 찌 자리 수심 (던지고 나서 알 수 있다) */
  spotDepth: number | null = null;
  measuredDepth: number | null = null;

  fish: Fish | null = null;
  lastCatch: Catch | null = null;
  readonly keepnet: Catch[];
  readonly best: Record<string, number>;
  /** 디버그: 입질 빈도 배수 */
  biteBoost = 1;
  fastTest = false;
  private fightTime = 0;

  private listeners: ((e: GameEvent) => void)[] = [];
  private t = 0;
  private holdT = 0;
  private castT = 0;
  private flight = { from: new THREE.Vector3(), to: new THREE.Vector3(), dur: 1, apex: 3, t: 0 };
  private settleT = 0;
  private settleDur = 1;
  private restTilt = 0;
  private restDy = 0;
  private bite: Bite | null = null;
  private biteCooldown = 4;
  private approachRates: EncounterRate[] | null = null;
  private approachAt = 0;
  private slackT = 0;
  private prevStretch = 0;
  private lineStrength = 3.6;
  private liftHeld = false;
  private readonly lastTip = new THREE.Vector3();
  private prevPrimary = false;

  constructor(readonly origin = PLAYER, private readonly progress?: { keepnet: Catch[]; best: Record<string, number>; ownerId?: string; consumeBait?: (id: BaitId | 'chum', productId?: string) => boolean }, readonly grounds = new FishingGrounds()) {
    this.ownerId = progress?.ownerId ?? 'local-player';
    this.keepnet = progress?.keepnet ?? [];
    this.best = progress?.best ?? {};
    if (!progress) try {
      Object.assign(this.best, JSON.parse(localStorage.getItem('fishing-best') ?? '{}'));
    } catch {
      /* 기록 없음 */
    }
  }

  on(fn: (e: GameEvent) => void) {
    this.listeners.push(fn);
  }
  private emit(e: GameEvent) {
    for (const fn of this.listeners) fn(e);
  }

  /** 마모·기술이 반영된 원줄 */
  get line() {
    const base = LINES[this.lineIdx] ?? LINES[1];
    return { ...base, strength: base.strength * mods.lineStrength(base.id) };
  }
  get rod() {
    const base = RODS.find(r => r.id === this.rodId) ?? RODS[0];
    return { ...base, power: base.power * mods.rodPower(base.id) };
  }
  get floatSpec() { return FLOATS.find(f => f.id === this.floatId) ?? FLOATS[0]; }
  get hook() { return HOOKS.find(h => h.id === this.hookId) ?? HOOKS[0]; }
  get rigSensitivity() { return rigSensitivity(this.line, this.hook, this.floatSpec); }
  get baitProduct() { const p = baitProduct(this.baitProductId); return p && p.baseBait === this.bait ? p : undefined; }
  get baitName() { return this.baitProduct?.name ?? BAITS[this.bait].name; }
  get chumProduct() { const p = baitProduct(this.chumProductId); return p?.baseBait === 'chum' ? p : undefined; }
  get rig(): Rig { return { rodId: this.rodId, floatId: this.floatId, hookId: this.hookId, bait: this.bait, baitProductId: this.baitProductId, chumProductId: this.chumProductId, lineIdx: this.lineIdx, depthSet: this.depthSet }; }
  setRig(rig: Rig) { if (this.canRig) { Object.assign(this, rig); this.baitProductId = rig.baitProductId; this.chumProductId = rig.chumProductId; } }
  feed() {
    if (!this.floatInWater || this.floatOnLand || this.phase === 'fighting') return false;
    if (this.progress?.consumeBait && !this.progress.consumeBait('chum', this.chumProduct?.id)) return false;
    const flavor = this.chumProduct?.id === 'toco-11' ? 'pellet' : this.chumProduct?.id === 'kw-chum' ? 'paste' : undefined;
    this.grounds.addFeed(this.float.x, this.float.z, 4 * mods.chum * (this.chumProduct?.chumScale ?? 1), flavor);
    this.emit({ type: 'splash', x: this.float.x, z: this.float.z, size: 0.35 });
    this.emit({ type: 'toast', text: '찌 주변에 집어 떡밥을 뿌렸어요', tone: 'good' });
    return true;
  }
  get floatInWater() {
    return this.phase === 'settling' || this.phase === 'waiting' || this.phase === 'fighting' || this.phase === 'flying';
  }
  /** 줄 늘어짐 (0 팽팽 ~ 1 느슨), 화면용 */
  get slack() {
    if (this.phase === 'fighting') return Math.max(0, 1 - this.tension / 0.25) * 0.6;
    if (this.phase === 'flying') return 0.05;
    return 0.2;
  }

  /** 채비를 바꿀 수 있는 때: 채비를 걷어 들였을 때만 */
  get canRig() {
    return this.phase === 'ready';
  }

  update(inp: FrameInput) {
    const dt = inp.dt;
    this.lastTip.copy(inp.tip);
    // 새로 누른 순간만 (채비를 걷은 클릭이 바로 다음 앞치기로 이어지지 않게)
    const pressed = inp.primary && !this.prevPrimary;
    this.prevPrimary = inp.primary;
    this.t += dt;
    this.sinceJerk += dt;
    switch (this.phase) {
      case 'ready':
        if (pressed) {
          this.phase = 'charging';
          this.holdT = 0;
        }
        break;
      case 'charging':
        this.holdT += dt;
        this.castPower = Math.min(mods.castCap, this.holdT / 1.1);
        if (!inp.primary) this.startCast(inp);
        break;
      case 'casting':
        this.castT += dt;
        this.castSwing = Math.min(1, this.castT / CAST_SWING);
        if (this.castT >= CAST_SWING) this.launch(inp);
        break;
      case 'flying':
        this.updateFlight(dt, inp);
        break;
      case 'settling':
      case 'waiting':
        this.updateWater(dt, inp);
        break;
      case 'fighting':
        this.updateFight(dt, inp);
        break;
      case 'landed':
        break;
    }
  }

  // ── 캐스팅 ─────────────────────────────────
  // 민장대 앞치기: 미끼를 손으로 잡고 있다가 놓으면서 대를 살짝 들어 채비를 앞으로 보낸다.

  private startCast(inp: FrameInput) {
    if (this.holdT < 0.08) {
      this.phase = 'ready';
      return;
    }
    if (this.progress?.consumeBait && !this.progress.consumeBait(this.bait, this.baitProduct?.id)) {
      this.phase = 'ready';
      this.emit({ type: 'toast', text: '미끼가 없어요. B키로 상점에서 보충하세요', tone: 'bad' });
      return;
    }
    this.phase = 'casting';
    this.castT = 0;
    this.castSwing = 0;
    this.emit({ type: 'cast', power: this.castPower });
    void inp;
  }

  private launch(inp: FrameInput) {
    const p = this.castPower;
    // 앞치기: 대 끝에서 원줄이 닿는 만큼만 (찌 아래 수심만큼 줄이 물속으로 들어간다)
    const tipH = Math.max(0.5, inp.tip.y - WATER_Y);
    const reach = Math.max(1.2, Math.sqrt(Math.max(0, (this.rod.line - this.depthSet * 0.9) ** 2 - tipH * tipH)));
    const dist = (0.8 + p * (reach - 0.8)) * rand(0.95, 1.02);
    const err = THREE.MathUtils.degToRad(gauss() * (1.5 + 3.5 * p));
    const yaw = inp.aimYaw + err;
    const fwd = tmp.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    // 진자처럼 대 끝 아래를 지나며 날아간다
    this.flight.from.copy(inp.tip);
    this.flight.from.y = Math.max(WATER_Y + 0.15, inp.tip.y - 0.6);
    this.flight.to.set(inp.tip.x + fwd.x * dist, WATER_Y, inp.tip.z + fwd.z * dist);
    this.flight.dur = 0.5 + dist / 14;
    this.flight.apex = 0.6 + dist * 0.15;
    this.flight.t = 0;
    this.phase = 'flying';
    this.bite = null;
    this.spotDepth = null;
  }

  private updateFlight(dt: number, inp: FrameInput) {
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    const s = f.t;
    this.float.lerpVectors(f.from, f.to, s);
    this.float.y += f.apex * 4 * s * (1 - s);
    this.floatTilt = 1;
    this.floatDy = 0;
    this.lineOut = this.float.distanceTo(inp.tip);
    if (f.t >= 1) this.land();
  }

  private land() {
    const { x, z } = this.float;
    const d = waterDepth(x, z);
    this.floatOnLand = d < 0.12;
    if (this.floatOnLand) {
      this.float.y = heightAt(x, z) + 0.02;
      this.phase = 'waiting';
      this.floatTilt = 1;
      this.emit({ type: 'toast', text: '물 밖에 떨어졌어요. 좌클릭으로 감아 들이세요.', tone: 'bad' });
      return;
    }
    this.float.y = WATER_Y;
    this.emit({ type: 'splash', x, z, size: 0.6 });
    this.emit({ type: 'ripple', x, z, size: 1 });
    this.phase = 'settling';
    this.settleT = 0;
    const baitDepth = Math.min(this.depthSet, d);
    // 찌가 천천히 잠기는 모습이 보이도록 (빠른 확인 모드도 2초 남짓)
    this.settleDur = baitDepth / this.floatSpec.sinkSpeed + 2.5;
    if (this.fastTest) this.settleDur = 2.2;
    // 찌 맞춤: 설정 수심이 실제보다 깊으면 남는 줄만큼 찌가 눕는다
    const excess = this.depthSet - d;
    this.restTilt = smoothstep(0.12, 0.5, excess);
    this.restDy = excess > 0 ? Math.min(excess, 0.12) * 0.35 : 0;
    this.spotDepth = d;
    this.measuredDepth = d;
    // 집어: 떡밥을 같은 자리에 던질수록 고기가 모인다
    const chum = BAITS[this.bait].chum * (this.baitProduct?.chumScale ?? 1);
    if (chum > 0) this.grounds.addFeed(x, z, chum, this.bait);
    this.biteCooldown = this.fastTest ? 0.6 : rand(3, 8);
  }

  // ── 찌를 띄워 놓고 기다리기 ─────────────────────

  private updateWater(dt: number, inp: FrameInput) {
    if (inp.hookset) this.doHookset();
    if (this.phase !== 'settling' && this.phase !== 'waiting') return;

    // 채비 걷기: 대를 들어 찌를 물 밖으로
    if (inp.retrieve) {
      if (!this.floatOnLand) this.emit({ type: 'ripple', x: this.float.x, z: this.float.z, size: 0.5 });
      this.retrieve();
      return;
    }
    if (this.floatOnLand) return;

    this.lineOut = this.float.distanceTo(inp.tip);
    // 물결: 찌는 물과 함께 오르내리므로 드러난 찌톱 높이는 거의 그대로다. 몇 mm만 일렁인다
    // (맑은 날 ±2mm, 비 오는 날 ±7mm 정도. 단찌는 덜, 나노찌는 더)
    const wave = (0.0012 * Math.sin(this.t * 1.7 + this.float.x) + 0.0006 * Math.sin(this.t * 2.9) + 0.0006 * (mods.wave - 1) * Math.sin(this.t * 5.3 + this.float.z)) * mods.wave * (this.floatSpec.sway ?? 1);

    if (this.phase === 'settling') {
      this.settleT += dt;
      const s = Math.min(1, this.settleT / this.settleDur);
      // 봉돌이 가라앉으면서 누워 있던 찌가 일어서고, 이어 찌톱이 한 마디씩 천천히 잠겨 찌맞춤 자리에 멈춘다
      const stand = smoothstep(0.05, 0.4, s);
      const u = smoothstep(0.3, 1, s), sink = 1 - (1 - u) * (1 - u);
      this.floatTilt = 1 + (this.restTilt - 1) * stand;
      this.floatDy = (1 - stand) * 0.06 + (this.restDy + this.trimSink * sink) * stand + wave;
      if (s >= 1) {
        this.phase = 'waiting';
      }
      return;
    }

    // 입질 진행
    let dy = 0;
    let dx = 0;
    if (this.bite) {
      const b = this.bite;
      b.t += dt;
      [dy, dx] = sampleKeys(b.keys, b.t);
      const vis = 1 - this.restTilt * 0.8;
      dy *= vis * this.rigSensitivity;
      dy = THREE.MathUtils.clamp(dy, -0.5, 0.34);
      // 입질은 물결 없이 찌로만 보인다
      if (b.t >= b.end) this.biteEnds();
    } else {
      this.biteCooldown -= dt;
      if (this.biteCooldown <= 0) this.rollApproach(dt);
      // 고기가 모이면 찌가 가끔 들썩인다: 집어가 잘 될수록 잦다
      const gather = Math.min(2, this.grounds.attraction(this.float.x, this.float.z));
      if (this.stirT <= 0 && Math.random() < dt * (0.015 + gather * 0.08)) {
        this.stirT = 0.4;
        this.stirA = rand(0.002, 0.004) * (Math.random() < 0.6 ? -1 : 1);
      }
    }
    if (this.stirT > 0) {
      this.stirT -= dt;
      dy += this.stirA * Math.sin(Math.PI * (1 - Math.max(0, this.stirT) / 0.4));
    }
    this.floatSide += (dx - this.floatSide) * Math.min(1, dt * 6);
    this.floatDy = this.restDy + this.trimSink + dy + wave;
    // 찌가 다 올라오면 넘어진다 (대물 붕어의 찌올림)
    const over = smoothstep(0.26, 0.32, dy);
    this.floatTilt += (Math.max(this.restTilt, over * 0.7) - this.floatTilt) * Math.min(1, dt * 4);
  }

  /** 찌맞춤만큼 찌가 잠기는 깊이 (m, 음수). 누운 찌는 수면에 뜬다 */
  /** 기다리는 동안 찌가 원래 자리보다 올라온 높이 (m). 변색 전자찌가 쓴다 */
  get floatRise() {
    return this.phase === 'waiting' ? this.floatDy - this.restDy - this.trimSink : 0;
  }

  /** 장력 게이지 100%: 원줄이 끊기거나 낚싯대가 부러지는 값 중 먼저 오는 쪽 (kgf) */
  get breakLimit() {
    return Math.min(this.lineStrength, this.rod.power * ROD_BREAK);
  }

  get trimSink() {
    return -((this.floatSpec.notches ?? 10) - this.trimNotches) * NOTCH_M * this.floatSpec.scale * (1 - this.restTilt);
  }

  /** 들어 올리는 데 버텨야 하는 시간 (초): 무거울수록 길다 */
  get liftNeed() { return this.fish ? 0.25 + this.fish.kg * 0.9 : 1; }
  /** 들어 올리기 진행 0~1 (화면 안내용) */
  get liftProgress() { return this.fish ? Math.min(1, this.liftT / this.liftNeed) : 0; }

  /** 낚싯대를 거둘 때: 물에 있는 채비를 걷는다. 파이팅·캐스팅 중이면 거둘 수 없다 */
  reelIn(): boolean {
    if (this.phase === 'settling' || this.phase === 'waiting') this.retrieve();
    return this.phase === 'ready';
  }

  private retrieve() {
    this.phase = 'ready';
    this.bite = null;
    this.lineOut = 0;
    this.spotDepth = null;
    if (!this.floatOnLand) this.emit({ type: 'retrieved' });
    this.floatOnLand = false;
  }

  /** 지금 찌 자리에서 어떤 물고기가 얼마나 입질할지 */
  biteRates(): EncounterRate[] {
    const { x, z } = this.float;
    return this.ratesAt(x, z);
  }
  /** 채비를 걷은 상태에서도 정면 포인트를 기준으로 선호도 안내를 보여준다. */
  ratesAt(x: number, z: number): EncounterRate[] {
    return encounterRates({ waterDepth: waterDepth(x, z), baitDepth: this.depthSet, bait: this.bait, product: this.baitProduct,
      spotQuality: seed => spotQuality(x, z, seed), line: this.line, hook: this.hook, sensitivity: this.rigSensitivity,
      chum: sp => this.grounds.attraction(x, z, sp), environment: sp => mods.bite(sp) });
  }
  get encounterForecast() {
    const inWater = this.floatInWater && !this.floatOnLand;
    const x = inWater ? this.float.x : this.origin.x;
    const z = inWater ? this.float.z : this.origin.z - this.rod.length - 3;
    const rates = this.ratesAt(x, z);
    const total = rates.reduce((n, r) => n + r.perMin, 0);
    return { actual: inWater, depth: waterDepth(x, z), total,
      chancePerMinute: biteProbability(total * (this.fastTest ? 1 : this.biteBoost), 60),
      rates: rates.map(r => ({ ...r, share: total > 0 ? r.perMin / total : 0 })).sort((a, b) => b.share - a.share) };
  }

  private rollApproach(dt: number) {
    // 물고기 씨알까지 계산하므로 같은 포인트의 분포는 0.5초 동안 재사용한다.
    if (!this.approachRates || this.t >= this.approachAt) { this.approachRates = this.biteRates(); this.approachAt = this.t + 0.5; }
    const rates = this.approachRates;
    const total = rates.reduce((n, r) => n + r.perMin, 0);
    if (total <= 0) return;
    // 명시적인 디버그 모드에서도 불리한 채비의 낮은 입질률을 보존한다.
    const rate = total * this.biteBoost * (this.fastTest ? 30 : 1);
    if (Math.random() >= biteProbability(rate, dt)) return;
    const species = pickEncounter(rates);
    if (!species) return;
    this.bite = makeBite(species, pickEncounterLength(rates.find(row => row.sp.id === species.id)!));
    this.emit({ type: 'bite' });
  }

  private biteEnds() {
    // 챔질하지 못한 입질은 그대로 끊긴다: 고기가 떠나고 한동안 조용하다 (저절로 걸리지 않는다)
    this.bite = null;
    this.biteCooldown = this.fastTest ? 6 : rand(15, 35);
  }

  /** 챔질은 대를 들어 올리는 동작이다. 고기가 걸리지 않으면 채비가 그대로 물 밖으로 들려 나온다 */
  private doHookset() {
    this.sinceJerk = 0;
    if (this.phase !== 'waiting' && this.phase !== 'settling') return;
    const b = this.phase === 'waiting' && !this.floatOnLand ? this.bite : null;
    let failedPenetration = false;
    if (b) {
      const pad = Math.max(-0.22, mods.hookWindow + (this.rigSensitivity - 1) * 0.18);
      const w = this.fastTest ? b.windows[0] : b.windows.find((w) => b.t >= w.t0 - pad && b.t <= w.t1 + pad);
      if (w) {
        const perfect = b.t >= w.p0 && b.t <= w.p1;
        if (Math.random() < hookSetChance(b.sp, b.cm, this.hook, this.bait, perfect)) {
          this.bite = null;
          this.emit({ type: 'hookset', hit: true });
          this.startFight(b, perfect ? 'perfect' : 'good');
          this.emit({ type: 'toast', text: perfect ? '정확한 챔질!' : '걸었다!', tone: 'good' });
          return;
        }
        failedPenetration = true;
      }
      // 너무 일찍 또는 늦게: 고기가 놀라 달아난다
      this.bite = null;
      this.biteCooldown = rand(8, 18);
    }
    this.emit({ type: 'hookset', hit: false });
    this.emit({ type: 'toast', text: failedPenetration ? '바늘이 제대로 박히지 않았어요 · 바늘 크기와 미끼를 확인하세요' : b ? '헛챔질 — 채비가 물 밖으로 나왔어요' : '대를 들어 채비를 걷었어요', tone: b ? 'bad' : 'info' });
    if (!this.floatOnLand) this.emit({ type: 'ripple', x: this.float.x, z: this.float.z, size: 0.6 });
    this.retrieve();
  }

  // ── 파이팅 ───────────────────────────────

  private startFight(b: Bite, quality: 'perfect' | 'good' | 'poor') {
    this.fightTime = 0;
    const kg = weightKg(b.sp, b.cm);
    const hold = hookHoldingPower(b.sp, b.cm, this.hook, this.bait, quality) * rand(0.94, 1.06);
    this.fish = {
      sp: b.sp,
      cm: b.cm,
      kg,
      pos: new THREE.Vector3(this.float.x, -Math.min(this.depthSet, waterDepth(this.float.x, this.float.z)) + 0.1, this.float.z),
      vel: new THREE.Vector3(),
      stamina: 1,
      maxPull: FISH_POWER * b.sp.power * Math.pow(kg, 0.85) + 0.35,
      // 돌진 순간 최대 당김 = 몸무게의 1.1~1.4배 (힘센 어종일수록 1.4배 쪽). 220g 붕어 ≈ 0.27kgf, 3kg 잉어 ≈ 4kgf
      pullKg: kg * (1.1 + 0.3 * THREE.MathUtils.clamp((b.sp.power - 1.4) / 1, 0, 1)) + 0.02,
      behavior: 'run',
      bTime: rand(1.5, 3),
      dir: this.awayDir(rand(-1, 1)),
      hookHold: hold,
      slackRisk: (quality === 'perfect' ? 0.5 : quality === 'good' ? 1 : 1.6) / Math.max(0.25, hookFit(b.sp, b.cm, this.hook) * baitPresentation(this.hook, this.bait)),
      splashT: 0,
    };
    this.liftT = 0;
    this.lineStrength = this.line.strength;
    this.slackT = 0;
    this.prevStretch = NaN;
    // 챔질 직후: 줄은 고기까지 거의 팽팽
    this.lineOut = this.rod.line;
    if (this.fastTest) this.fish.bTime = rand(0.7, 1.2);
    this.phase = 'fighting';
    this.floatTilt = 1;
    this.emit({ type: 'hooked' });
  }

  private awayDir(angle: number): THREE.Vector3 {
    const f = this.fish?.pos ?? this.float;
    const base = Math.atan2(f.x - this.origin.x, -(f.z - this.origin.z));
    const a = base + angle;
    return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
  }

  private pickBehavior(f: Fish) {
    const s = f.stamina;
    const w: [Behavior, number][] = [
      ['run', 0.1 + 0.6 * s],
      ['shake', 0.25],
      ['dive', 0.05 + 0.25 * s],
      ['rest', 0.15 + 0.7 * (1 - s)],
    ];
    let r = Math.random() * w.reduce((a, [, v]) => a + v, 0);
    let pick: Behavior = 'rest';
    for (const [b, v] of w) {
      r -= v;
      if (r <= 0) {
        pick = b;
        break;
      }
    }
    f.behavior = pick;
    f.bTime = pick === 'run' ? rand(1.5, 4) * (0.5 + s) : pick === 'shake' ? rand(0.8, 1.8) : pick === 'dive' ? rand(1, 2.2) : rand(1, 2.5);
    f.dir = this.awayDir(rand(-1.4, 1.4));
  }

  private updateFight(dt: number, inp: FrameInput) {
    const f = this.fish!;
    if (this.fastTest) {
      this.quickFightStep(dt, inp, f);
    } else {
      this.liftHeld = inp.primary;
      const STEPS = 4;
      const h = dt / STEPS;
      for (let i = 0; i < STEPS && this.phase === 'fighting'; i++) this.fightStep(h, inp, f);
    }
    if (this.phase !== 'fighting') return;

    // 찌는 고기에 끌려다니고, 고기가 깊으면 물속으로 잠긴다
    this.float.set(f.pos.x, WATER_Y, f.pos.z);
    this.floatDy = THREE.MathUtils.clamp(f.pos.y + this.depthSet, -0.5, 0);
    this.floatTilt += (0.8 - this.floatTilt) * Math.min(1, dt * 3);

    // 고기가 빠르게 옆으로 달리면 줄이 물을 가르며 물결이 인다
    this.sliceT -= dt;
    if (this.sliceT <= 0 && f.vel.length() > 1.1 && f.pos.y > -1.2) {
      this.emit({ type: 'ripple', x: f.pos.x, z: f.pos.z, size: 0.22 });
      this.sliceT = 0.14;
    }
    // 수면 근처에서 퍼덕이면 물보라
    f.splashT -= dt;
    if (f.pos.y > -0.35 && f.splashT <= 0) {
      const sz = Math.min(1.4, 0.25 + f.kg * 0.25) * (0.4 + f.stamina);
      this.emit({ type: 'splash', x: f.pos.x, z: f.pos.z, size: sz });
      this.emit({ type: 'ripple', x: f.pos.x, z: f.pos.z, size: Math.min(1, sz) });
      f.splashT = rand(0.25, 0.9);
    }

    // 뜰채: 지친 고기를 발 앞까지 끌어오면 떠낸다
    // 대를 세워 고기를 띄워 발 앞까지 끌어오면 뜰채로
    const dPlayer = Math.hypot(f.pos.x - this.origin.x, f.pos.z - this.origin.z);
    // 무거운 고기는 더 지쳐야 뜨고, 대를 세운 채 한동안 버텨야 들린다 (붕어 0.3kg ≈ 0.5초, 잉어 3kg ≈ 3초)
    const tired = f.kg < 0.3 ? 1 : 0.42 / (1 + f.kg * 0.35);
    if (dPlayer < 3.6 && f.pos.y > -0.6 && inp.primary && f.stamina < tired) {
      this.liftT += dt;
      if (this.liftT >= this.liftNeed) this.landFish(f);
    } else this.liftT = Math.max(0, this.liftT - dt * 1.5);
    if (dPlayer < 3.6 && f.pos.y > -0.6 && inp.primary && f.stamina >= tired) {
      if (f.behavior !== 'run') {
        f.behavior = 'run';
        f.bTime = rand(1.5, 3);
        f.dir = this.awayDir(rand(-0.8, 0.8));
      }
    }
  }

  private quickFightStep(dt: number, inp: FrameInput, f: Fish) {
    this.fightTime += dt;
    f.bTime -= dt;
    if (f.bTime <= 0) { this.pickBehavior(f); f.bTime = Math.min(f.bTime, rand(0.7, 1.5)); }
    const factor = { run: 1, shake: 0.65, dive: 0.85, rest: 0.12 }[f.behavior];
    const muscle = Math.min(this.rod.power * 1.6, Math.max(0.18, f.maxPull));
    const resistance = muscle * (0.2 + f.stamina * 0.8) * factor;
    const pulling = inp.primary && !inp.lift && inp.rodDir.y > 0.03;
    const pulse = f.behavior === 'shake' ? 1 + Math.sin(this.fightTime * 23) * 0.35 : 1;
    // 원줄 장력 (kgf): 고기의 실제 당김. 대를 세워 버티면 그대로 실리고, 숙이면 대가 받아 줄어든다. 최대는 pullKg
    const fishPull = f.pullKg * (0.25 + 0.75 * f.stamina) * factor * pulse;
    const load = (fishPull * (pulling ? 1 : 0.85) + 0.02) * (inp.lift ? 0.6 : 1);
    this.tension += (load - this.tension) * (1 - Math.exp(-dt * 14));
    if (this.tension > this.lineStrength) return this.lose('break');
    // 대를 세운 채 허용 하중을 크게 넘기면 낚싯대가 부러진다 (숙이면 줄이 직접 받는다)
    if (!inp.lift && this.tension > this.rod.power * ROD_BREAK) return this.lose('rod');
    tmp.set(this.origin.x - f.pos.x, 0, this.origin.z - f.pos.z).normalize();
    const leverage = this.rod.power * (0.8 + Math.max(0, inp.rodDir.y) * 0.8);
    const gain = pulling ? THREE.MathUtils.clamp((leverage - resistance) / this.rod.power, 0.06, 1.4) * 1.9 : 0;
    const surge = f.behavior === 'run' ? f.sp.speed * f.stamina * 0.38 : f.behavior === 'dive' ? 0.22 * f.stamina : 0;
    tmp2.copy(tmp).multiplyScalar(gain).addScaledVector(f.dir, surge);
    if (f.behavior === 'shake') {
      tmp2.x += -tmp.z * Math.sin(this.fightTime * 18) * 0.6 * f.stamina;
      tmp2.z += tmp.x * Math.sin(this.fightTime * 18) * 0.6 * f.stamina;
    }
    f.vel.lerp(tmp2, Math.min(1, dt * 6));
    f.pos.addScaledVector(f.vel, dt);
    const wd = waterDepth(f.pos.x, f.pos.z);
    const targetY = f.behavior === 'dive' && f.stamina > 0.45 ? -Math.min(wd * 0.5, 0.8) : pulling ? -0.04 : -0.18;
    f.pos.y += (targetY - f.pos.y) * Math.min(1, dt * 2.5);
    f.pos.y = THREE.MathUtils.clamp(f.pos.y, -Math.max(0.12, wd - 0.08), -0.025);
    tmp.set(f.pos.x - this.origin.x, 0, f.pos.z - this.origin.z);
    const distance = tmp.length();
    if (distance > this.rod.length + this.rod.line) {
      tmp.setLength(this.rod.length + this.rod.line);
      f.pos.x = this.origin.x + tmp.x; f.pos.z = this.origin.z + tmp.z;
    }
    f.stamina = THREE.MathUtils.clamp(f.stamina - dt * (pulling ? 0.2 + this.tension / this.line.strength * 0.08 : 0.025 * factor), 0, 1);
  }

  private fightStep(h: number, inp: FrameInput, f: Fish) {
    const tip = inp.tip;
    // 원줄 + 낚싯대의 탄성 (직렬 스프링). 릴이 없으니 줄 길이는 그대로, 대가 휘며 받아 준다
    const kLine = this.lineStrength / (0.24 * this.rod.line);
    // 대가 줄과 직각에 가까울수록(세워 버틸수록) 많이 휘며 충격을 받아 준다.
    // 대 끝을 고기 쪽으로 겨누면 대가 안 휘어 원줄이 그대로 받는다
    const lineDir = tmp2.subVectors(f.pos, tip).normalize();
    const sinA = tmp.crossVectors(inp.rodDir, lineDir).length();
    const kRod = this.rod.power / (this.rod.flex * (0.12 + 0.88 * sinA));
    const k = 1 / (1 / kLine + 1 / kRod);
    const d = tmp.subVectors(tip, f.pos).length();
    const stretch = d - this.lineOut;
    if (Number.isNaN(this.prevStretch)) this.prevStretch = stretch;
    // 늘어나는 속도에 비례한 감쇠 (줄이 튕기듯 진동하지 않게), 너무 큰 값은 자른다
    const rate = THREE.MathUtils.clamp((stretch - this.prevStretch) / h, -3, 3);
    const T = stretch > 0 ? Math.max(0, stretch * k + rate * 0.08 * k) : 0;
    this.prevStretch = stretch;
    this.tension = T;

    if (T > this.lineStrength) return this.lose('break');
    if (!inp.lift && T > this.rod.power * ROD_BREAK) return this.lose('rod');
    if (T > f.hookHold) return this.lose('unhook');
    if (T < 0.03) this.slackT += h;
    else this.slackT = Math.max(0, this.slackT - h * 2);
    if (this.slackT > 1.4) {
      const shake = f.behavior === 'shake' ? 2.5 : 1;
      if (Math.random() < h * 0.22 * shake * f.slackRisk) return this.lose('unhook');
    }

    // 물고기 행동
    f.bTime -= h;
    if (f.bTime <= 0) this.pickBehavior(f);
    const factor = { run: 1, shake: 0.55, dive: 0.8, rest: 0.12 }[f.behavior];
    let pull = f.pullKg * (0.22 + 0.78 * f.stamina) * factor;
    if (f.behavior === 'shake') pull *= 1 + 0.7 * Math.sin(this.t * 32);
    const wd = waterDepth(f.pos.x, f.pos.z);
    const wantY = f.behavior === 'dive' ? -wd + 0.2 : f.stamina < 0.3 ? -0.1 : -Math.min(wd * 0.6, 1.5);
    const force = tmp2.copy(f.dir).multiplyScalar(pull * G);
    force.y = THREE.MathUtils.clamp((wantY - f.pos.y) * 4, -1, 1) * pull * G * 0.5;
    // 줄이 당기는 힘
    const toTip = tmp.subVectors(tip, f.pos).normalize();
    force.addScaledVector(toTip, T * G);
    // 물의 저항
    const cd = (f.pullKg * G) / (f.sp.speed * f.sp.speed);
    const sp = f.vel.length();
    force.addScaledVector(f.vel, -cd * sp - 0.6);
    const m = f.kg * 1.4 + 0.05;
    f.vel.addScaledVector(force, h / m);
    const prevX = f.pos.x;
    const prevZ = f.pos.z;
    f.pos.addScaledVector(f.vel, h);
    // 얕은 곳으로는 못 간다 (뜰채 거리 안쪽은 허용)
    const nd = waterDepth(f.pos.x, f.pos.z);
    const dPlayer = Math.hypot(f.pos.x - this.origin.x, f.pos.z - this.origin.z);
    if (nd < 0.22 && dPlayer > 4.5) {
      f.pos.x = prevX;
      f.pos.z = prevZ;
      f.vel.x *= -0.3;
      f.vel.z *= -0.3;
      if (f.behavior === 'run') f.bTime = 0;
    }
    f.pos.y = THREE.MathUtils.clamp(f.pos.y, -Math.max(0.12, nd - 0.08), -0.04);
    if (f.pos.y >= -0.04) f.vel.y = Math.min(f.vel.y, 0);

    // 힘쓸수록, 줄이 팽팽할수록 지친다
    const effort = (factor * 0.6 + 0.25) * (0.5 + 0.9 * Math.min(1.5, T / f.pullKg)) * (this.liftHeld ? 1.25 : 1);
    const stamSec = f.sp.stamina[0] + f.sp.stamina[1] * f.kg;
    f.stamina = THREE.MathUtils.clamp(f.stamina - (h * effort) / stamSec + (f.behavior === 'rest' ? h * 0.006 : 0), 0, 1);
  }

  private lose(reason: 'break' | 'unhook' | 'rod', quiet = false) {
    const f = this.fish!;
    this.emit({ type: 'lost', reason });
    const name = f.kg > 1 ? '대물을' : '고기를';
    const text = reason === 'break' ? `줄이 터졌어요! ${name} 놓쳤어요` : reason === 'rod' ? `낚싯대가 부러졌어요! ${name} 놓쳤어요` : `바늘이 빠졌어요. ${name} 놓쳤어요`;
    if (!quiet) this.emit({ type: 'toast', text, tone: 'bad' });
    this.fish = null;
    this.tension = 0;
    if (reason === 'unhook') {
      // 채비는 남아 있다: 찌가 수면에 떠오른다
      this.phase = 'waiting';
      this.floatDy = 0;
      this.restTilt = 1;
      this.floatTilt = 1;
      if (waterDepth(this.float.x, this.float.z) < 0.12) this.retrieve();
    } else {
      this.phase = 'ready';
      this.lineOut = 0;
    }
  }

  private landFish(f: Fish) {
    // 뜰채보다 무거우면 떠내다 놓칠 수 있다
    if (f.kg > mods.netMaxKg && Math.random() < 0.7) {
      this.emit({ type: 'toast', text: `뜰채가 작아요! ${f.kg.toFixed(1)}kg 고기를 떠내지 못했어요 — 더 큰 뜰채가 필요해요`, tone: 'bad' });
      this.lose('unhook', true);
      return;
    }
    this.fish = null;
    this.tension = 0;
    this.lineOut = 0;
    this.phase = 'landed';
    const rank = rankOf(f.sp, f.cm);
    const best = f.cm > (this.best[f.sp.id] ?? 0);
    this.lastCatch = { species: f.sp, cm: f.cm, kg: f.kg, rank, best, at: Date.now() };
    this.emit({ type: 'landed' });
  }

  /** 랜딩 후: 살림망에 넣기 / 놓아주기 */
  finishCatch(keep: boolean) {
    const c = this.lastCatch;
    if (!c || this.phase !== 'landed') return;
    if (keep) this.keepnet.push(c);
    if (c.best) {
      this.best[c.species.id] = Math.max(this.best[c.species.id] ?? 0, c.cm);
      if (!this.progress) try {
        localStorage.setItem('fishing-best', JSON.stringify(this.best));
      } catch {
        /* 저장 실패 무시 */
      }
    }
    this.lastCatch = null;
    this.phase = 'ready';
    this.emit({ type: 'finished', keep });
  }

  /** 디버그용: 지금 찌 자리에 바로 입질을 건다 */
  debugBite(id?: string) {
    if (this.phase !== 'waiting') return;
    const sp = SPECIES_LIST.find((s) => s.id === id) ?? SPECIES_LIST[0];
    this.bite = makeBite(sp);
  }

  /** 디버그용: 지금 보이는 입질의 챔질 구간 */
  get debugBiteInfo() {
    return this.bite ? { t: this.bite.t, windows: this.bite.windows, sp: this.bite.sp.id } : null;
  }
}

// ── 입질 대본 ─────────────────────────────

function sampleKeys(keys: [number, number, number][], t: number): [number, number] {
  if (t <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b[0]) {
      const a = keys[i - 1];
      const s = smoothstep(0, 1, (t - a[0]) / Math.max(1e-4, b[0] - a[0]));
      return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
    }
  }
  const z = keys[keys.length - 1];
  return [z[1], z[2]];
}

function rollLength(sp: Species): number {
  const cm = sp.len.median * ACTIVE_FISHERY.sizeScale * Math.exp(sp.len.sigma * gauss());
  return Math.round(THREE.MathUtils.clamp(cm, sp.len.min, sp.len.max) * 10) / 10;
}

function makeBite(sp: Species, cm = rollLength(sp)): Bite {
  const big = THREE.MathUtils.clamp((cm - sp.len.median) / (sp.len.max - sp.len.median), -0.5, 1);
  const keys: [number, number, number][] = [[0, 0, 0]];
  const windows: BiteWindow[] = [];
  let t = rand(0.3, 1.2);
  const nibble = (n: number, depth: number) => {
    for (let i = 0; i < n; i++) {
      const d = depth * rand(0.6, 1.3);
      keys.push([t, 0, 0], [t + 0.1, -d, 0], [t + 0.32, 0, 0]);
      t += rand(0.6, 1.8);
    }
  };
  let selfHook = false;
  if (sp.bite === 'rise') {
    // 붕어: 깔짝거리다가 찌를 천천히 밀어 올린다. 올라와 멈춘 순간이 챔질 타이밍
    nibble(Math.floor(rand(0, 2.5)), 0.01);
    // 예신: 찌톱이 한 마디쯤 살짝 올랐다 내려온다
    for (let i = Math.floor(rand(1, 3)); i > 0; i--) {
      const h = rand(0.008, 0.015);
      keys.push([t, 0, 0], [t + 0.18, h, 0], [t + 0.45, 0, 0]);
      t += rand(0.9, 1.8);
    }
    t += rand(0.3, 0.9);
    if (Math.random() < 0.2) {
      // 내림 본신: 찌가 쭈욱 빨려 들어간다
      const s0 = t + rand(0.2, 0.5);
      keys.push([t, 0, 0], [s0, -0.03, 0], [s0 + rand(0.8, 1.2), -0.36, rand(-0.06, 0.06)]);
      windows.push({ t0: s0, t1: s0 + 1.5, p0: s0 + 0.25, p1: s0 + 1.1 });
      t = s0 + 1.5;
      keys.push([t + 0.5, 0, 0]);
      t += 0.6;
    } else {
      // 올림 본신: 몸통이 드러날 만큼 쭈욱 밀어 올린 뒤 멈춘다 (멈춘 순간이 챔질 타이밍). 클수록 높고 묵직하다
      const riseH = 0.12 + 0.13 * Math.max(0, big + 0.3) + rand(0, 0.04);
      const riseDur = rand(1.4, 2.6);
      const hold = rand(0.6, 1.4);
      keys.push([t, 0, 0], [t + riseDur, riseH, 0], [t + riseDur + hold, riseH, 0]);
      windows.push({ t0: t + riseDur * 0.4, t1: t + riseDur + hold + 0.35, p0: t + riseDur * 0.75, p1: t + riseDur + hold + 0.1 });
      t += riseDur + hold;
      // 대물은 끝까지 올려 찌를 눕히기도 한다
      if (big > 0.5 && Math.random() < 0.4) keys.push([t + 0.5, riseH + 0.08, 0]);
      else if (Math.random() < 0.65) keys.push([t + 0.45, 0, 0]);
      else keys.push([t + 0.6, -0.2, 0.05]);
      t += 0.8;
    }
  } else if (sp.bite === 'sink') {
    // 잉어: 몇 번 건드리다가 옆으로 끌고 가며 찌를 쭉 빨아들인다
    nibble(Math.floor(rand(1, 4)), 0.015);
    const side = rand(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1);
    keys.push([t, 0, 0], [t + 0.6, -0.04, side * 0.5]);
    const s0 = t + 0.6;
    keys.push([s0 + 1, -0.42, side * 1.5]);
    windows.push({ t0: s0 - 0.2, t1: s0 + 1.4, p0: s0 + 0.12, p1: s0 + 0.85 });
    t = s0 + 1.4;
    selfHook = Math.random() < 0.3;
    if (!selfHook) keys.push([t + 0.6, 0, 0]);
    t += 0.7;
  } else if (sp.bite === 'drag') {
    // 메기·가물치: 눌러 먹은 뒤 옆으로 무겁게 끌고 간다.
    nibble(1, 0.025);
    const side = Math.random() < 0.5 ? -0.32 : 0.32;
    keys.push([t, 0, 0], [t + 0.7, -0.035, side * 0.2], [t + 1.4, -0.22, side], [t + 2.6, -0.4, side * 1.4]);
    windows.push({ t0: t + 0.6, t1: t + 2.8, p0: t + 1.1, p1: t + 2.3 });
    t += 3; keys.push([t, 0, 0]); selfHook = Math.random() < 0.15;
  } else if (sp.bite === 'dart') {
    // 쏘가리·배스: 짧게 건드린 뒤 빠르게 가져간다.
    const side = Math.random() < 0.5 ? -0.2 : 0.2;
    keys.push([t, 0, 0], [t + 0.2, -0.04, side * 0.2], [t + 0.4, -0.26, side], [t + 1, -0.36, side * 1.5], [t + 1.5, 0, 0]);
    windows.push({ t0: t + 0.2, t1: t + 1.2, p0: t + 0.4, p1: t + 0.9 }); t += 1.6;
  } else {
    // 블루길: 정신없이 깔짝깔짝, 가끔 쏙 잠긴다
    const n = Math.floor(rand(5, 12));
    const dunks = new Set([Math.floor(rand(2, n)), Math.floor(rand(2, n))]);
    for (let i = 0; i < n; i++) {
      if (dunks.has(i)) {
        keys.push([t, 0, 0], [t + 0.08, -0.16, 0], [t + 0.4, -0.16, 0], [t + 0.55, 0, 0]);
        windows.push({ t0: t + 0.02, t1: t + 0.5, p0: t + 0.06, p1: t + 0.35 });
        t += 0.55 + rand(0.15, 0.4);
      } else {
        const d = rand(0.015, 0.05);
        keys.push([t, 0, 0], [t + 0.07, -d, 0], [t + 0.2, 0, 0]);
        t += 0.2 + rand(0.08, 0.35);
      }
    }
  }
  return { sp, cm, t: 0, keys, windows, end: t + 0.2, selfHook };
}

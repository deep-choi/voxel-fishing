import * as THREE from 'three';
import { FLOATS, ROD, type FloatShape, type FloatSpec } from '../game/data';
import { WATER_Y } from '../world/lake';

// 낚싯대(민장대, 휘어짐), 바늘, 한국식 민물 찌, 낚싯줄, 물보라.

const RADIAL = 10;
/** 대 단면 고리 수: 대가 바뀌어도 개수는 그대로, 자리만 다시 잡는다 */
const RINGS = 160;
/** 손잡이(천 감기) 끝 (m) */
const GRIP = 0.38;
/** 대 재질 묶음: 옻칠 몸통 / 금속 장식 / 천·실 감기 */
const LACQ = 0;
const METAL = 1;
const CLOTH = 2;

/** 대 색 조합: 칠 · 장식 금속 · 손잡이 · 상표 띠 */
const ROD_LOOKS: [string, string, string, string][] = [
  ['#1e3b2b', '#c9a24a', '#2b2520', '#0e1310'], // 짙은 녹색 + 금장
  ['#4a1421', '#d2b264', '#1f1b19', '#140d0e'], // 와인
  ['#18273f', '#c6ccd3', '#23211f', '#0b0f19'], // 남색 + 은장
  ['#161616', '#c9a24a', '#3b2a1c', '#5a1a12'], // 흑칠
  ['#55391f', '#d8b66c', '#1d1a17', '#24170c'], // 갈색 대나무톤
  ['#173c3a', '#b9c0c7', '#272220', '#0c1514'], // 청록 + 은장
];

/** 대 단면 하나: 길이 비율 · 반지름 · 색 · 재질 · 끝마개처럼 축 방향을 보는 면인지 */
interface Knot { s: number; r: number; c: [number, number, number]; mat: number; axial: boolean }

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const w1 = new THREE.Vector3();
const w2 = new THREE.Vector3();
const w3 = new THREE.Vector3();
const w4 = new THREE.Vector3();
const w5 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

export interface RodPose {
  butt: THREE.Vector3;
  dir: THREE.Vector3;
}

/** 자체 처짐을 포함해 초릿대가 수면에서 약 22cm 위에 오도록 놓는다. */
export function rodRestElevation(length: number, buttY: number) {
  return Math.asin(THREE.MathUtils.clamp((WATER_Y + 0.22 + length * 0.04 - buttY) / length, -0.9, 0.9));
}

export class Hook {
  readonly group = new THREE.Group();
  private readonly direction = new THREE.Vector3();
  constructor() {
    // 붕어바늘: 귀(고리) → 곧은 축 → 굽은 허리 → 미늘 달린 바늘 끝. 원점 = 고기 입, +y = 목줄 쪽
    const mat = new THREE.MeshStandardMaterial({ color: '#cfd6d8', metalness: 0.9, roughness: 0.28 });
    const add = (geo: THREE.BufferGeometry, x: number, y: number, rz = 0, m: THREE.Material = mat) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, 0);
      mesh.rotation.z = rz;
      this.group.add(mesh);
      return mesh;
    };
    const R = 0.0016;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.011, 0.049, 0),
      new THREE.Vector3(0.011, 0.03, 0),
      new THREE.Vector3(0.0108, 0.012, 0),
      new THREE.Vector3(0.0085, 0.003, 0),
      new THREE.Vector3(0.003, -0.0005, 0),
      new THREE.Vector3(-0.0025, 0.0015, 0),
      new THREE.Vector3(-0.005, 0.008, 0),
      new THREE.Vector3(-0.0052, 0.016, 0),
    ]);
    add(new THREE.TubeGeometry(curve, 28, R, 6, false), 0, 0);
    // 귀: 목줄을 묶는 작은 고리
    add(new THREE.TorusGeometry(0.0026, 0.0008, 6, 14), 0.011, 0.0515);
    // 바늘 끝: 살짝 안쪽(축 쪽)으로 숙인 뾰족한 끝
    add(new THREE.ConeGeometry(R, 0.008, 6), -0.0047, 0.02, -0.12);
    // 미늘: 바늘 끝 안쪽에서 뒤(아래)로 젖혀진 가시
    add(new THREE.ConeGeometry(0.001, 0.005, 5), -0.0022, 0.0168, -2.675);
    // 귀 아래 목줄 매듭 감기
    add(new THREE.CylinderGeometry(0.0023, 0.0023, 0.006, 8), 0.011, 0.044, 0,
      new THREE.MeshStandardMaterial({ color: '#e6e3d6', roughness: 0.6 }));
    this.group.visible = false;
  }
  place(mouth: THREE.Vector3, tip: THREE.Vector3, eye: THREE.Vector3) {
    this.group.position.copy(mouth);
    this.direction.subVectors(tip, mouth).normalize();
    this.group.quaternion.setFromUnitVectors(UP, this.direction);
    eye.copy(mouth).addScaledVector(this.direction, 0.05);
  }
}

export class RodHands {
  readonly group = new THREE.Group();
  private readonly axis = new THREE.Vector3(0, 0, -1);
  constructor() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const skin = new THREE.MeshLambertMaterial({ color: '#d8ae87' });
    const sleeve = new THREE.MeshLambertMaterial({ color: '#456c5d' });
    const cuffMat = new THREE.MeshLambertMaterial({ color: '#36574a' });
    for (const [x, z] of [[0.055, 0.02], [-0.055, -0.25]]) {
      const hand = new THREE.Mesh(geo, skin); hand.scale.set(0.1, 0.085, 0.13); hand.position.set(x, -0.025, z);
      const arm = new THREE.Mesh(geo, sleeve); arm.scale.set(0.115, 0.12, 0.3); arm.position.set(x * 2, -0.09, z + 0.2);
      // 소매 끝단
      const cuff = new THREE.Mesh(geo, cuffMat); cuff.scale.set(0.125, 0.13, 0.03); cuff.position.set(x * 2, -0.09, z + 0.065);
      this.group.add(hand, arm, cuff);
      // 대를 감싸 쥔 손가락 네 마디
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(geo, skin);
        finger.scale.set(0.05, 0.026, 0.024);
        finger.position.set(x * 0.22, 0.016, z - 0.0405 + f * 0.027);
        this.group.add(finger);
      }
    }
    this.group.visible = false;
  }
  update(pose: RodPose, visible: boolean) {
    this.group.visible = visible;
    this.group.position.copy(pose.butt);
    this.group.quaternion.setFromUnitVectors(this.axis, pose.dir);
  }
}

/**
 * 민장대: 릴·가이드 없이 여러 마디를 뽑아 쓰는 대.
 * 끝마개 → 천 감기 손잡이 → 금속 감기·상표 띠 → 마디마다 굵은 테 → 가는 초릿대 → 릴리안.
 * 고리 개수는 고정이고 매 프레임 정점 자리·법선만 다시 쓴다.
 */
export class Rod {
  readonly group = new THREE.Group();
  readonly tip = new THREE.Vector3();
  private readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly nrm: Float32Array;
  private readonly col: Float32Array;
  private readonly idx: Uint16Array;
  /** 고리별 길이 비율 · 반지름 · 축 방향 법선 여부 */
  private readonly ss = new Float32Array(RINGS);
  private readonly rr = new Float32Array(RINGS);
  private readonly ax = new Uint8Array(RINGS);
  private readonly cosT = new Float32Array(RADIAL);
  private readonly sinT = new Float32Array(RADIAL);
  private readonly flexShape = new THREE.Vector3(0, -0.04, 0);
  private readonly flexVelocity = new THREE.Vector3();
  private readonly flexTarget = new THREE.Vector3();
  private readonly quiverDir = new THREE.Vector3();
  private readonly lastDir = new THREE.Vector3(0, 0, -1);
  private readonly butt = new THREE.Vector3();
  /** 초릿대 끝 릴리안 고리 */
  private readonly loop: THREE.Mesh;
  private readonly loopMat: THREE.MeshStandardMaterial;
  private readonly look = {
    blank: new THREE.Color(), accent: new THREE.Color(), grip: new THREE.Color(), brand: new THREE.Color(), lilian: new THREE.Color('#c8261c'),
  };
  /** setColor로 색을 정했으면 자동 색 조합을 쓰지 않는다 */
  private custom = false;
  /** 대 길이·휨 조합 (바뀌면 마디 배치·색을 다시 잡는다) */
  private key = -1;
  private time = 0;
  private L = ROD.length;
  private bendStart = 0;
  private deflLen = 0;
  private quiver = 0;

  constructor() {
    const n = RINGS * RADIAL;
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.idx = new Uint16Array((RINGS - 1) * RADIAL * 6);
    for (let j = 0; j < RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      this.cosT[j] = Math.cos(a);
      this.sinT[j] = Math.sin(a);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setIndex(new THREE.BufferAttribute(this.idx, 1));
    this.key = this.keyOf(ROD.length, ROD.flex);
    this.pickLook(this.key);
    this.layout(ROD.length);

    // 옻칠 몸통: 맑은 코팅 광택 / 금속 장식 / 천·실 감기
    const mats = [
      new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 }),
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.28 }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    ];
    const mesh = new THREE.Mesh(this.geo, mats);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.loopMat = new THREE.MeshStandardMaterial({ color: this.look.lilian, roughness: 0.9 });
    this.loop = new THREE.Mesh(new THREE.TorusGeometry(0.0035, 0.0006, 5, 12), this.loopMat);
    this.loop.frustumCulled = false;
    this.group.add(mesh, this.loop);
  }

  /** 대 칠 색을 직접 정한다 (안 정하면 대 길이·휨으로 색 조합을 고른다) */
  setColor(blank: THREE.ColorRepresentation, accent?: THREE.ColorRepresentation, grip?: THREE.ColorRepresentation) {
    this.custom = true;
    this.look.blank.set(blank);
    if (accent !== undefined) this.look.accent.set(accent);
    if (grip !== undefined) this.look.grip.set(grip);
    this.key = -1;
  }

  private keyOf(length: number, flex: number) {
    return Math.round(length * 100) * 1000 + Math.round(flex * 100);
  }

  private pickLook(key: number) {
    const [blank, accent, grip, brand] = ROD_LOOKS[(Math.imul(key, 2654435761) >>> 0) % ROD_LOOKS.length];
    this.look.blank.set(blank);
    this.look.accent.set(accent);
    this.look.grip.set(grip);
    this.look.brand.set(brand);
  }

  /** 대 길이에 맞춰 마디·장식 자리, 색, 재질 묶음을 다시 잡는다 (대가 바뀔 때만) */
  private layout(L: number) {
    const K: Knot[] = [];
    const P = this.look;
    const add = (m: number, r: number, c: THREE.Color, mat: number, shade = 1, axial = false) =>
      K.push({ s: Math.min(1, m / L), r, c: [c.r * shade, c.g * shade, c.b * shade], mat, axial });
    const lerp = THREE.MathUtils.lerp;

    // 끝마개: 뒤를 막는 원판 + 금속 테
    add(0, 0, P.accent, METAL, 0.55, true);
    add(0, 0.0116, P.accent, METAL, 0.55, true);
    add(0.004, 0.0129, P.accent, METAL, 0.8);
    add(0.026, 0.0129, P.accent, METAL, 0.8);
    add(0.026, 0.0135, P.accent, METAL);
    add(0.034, 0.0135, P.accent, METAL);
    // 손잡이: 짙고 옅은 천 감기 띠가 번갈아, 가운데가 살짝 불룩
    const g0 = 0.034;
    const NB = 14;
    const bw = (GRIP - g0) / NB;
    const rg = (m: number) => 0.0122 + 0.0008 * Math.sin((Math.PI * (m - g0)) / (GRIP - g0));
    for (let b = 0; b < NB; b++) {
      const shade = b % 2 ? 0.62 : 1;
      add(g0 + b * bw, rg(g0 + b * bw), P.grip, CLOTH, shade);
      add(g0 + (b + 1) * bw, rg(g0 + (b + 1) * bw), P.grip, CLOTH, shade);
    }
    // 손잡이 위 금속 감기
    add(GRIP, 0.0134, P.accent, METAL);
    add(GRIP + 0.012, 0.0134, P.accent, METAL);
    // 상표 띠: 짙은 칠에 가는 금줄 두 개
    const p0 = GRIP + 0.012;
    const p1 = GRIP + 0.14;
    const rp = (m: number) => lerp(0.0121, 0.0117, (m - p0) / (p1 - p0));
    add(p0, rp(p0), P.brand, LACQ);
    for (const lm of [p0 + 0.045, p0 + 0.075]) {
      add(lm, rp(lm), P.brand, LACQ);
      add(lm, rp(lm) + 0.0003, P.accent, METAL);
      add(lm + 0.003, rp(lm) + 0.0003, P.accent, METAL);
      add(lm + 0.003, rp(lm + 0.003), P.brand, LACQ);
    }
    add(p1, rp(p1), P.brand, LACQ);
    add(p1, 0.012, P.accent, METAL);
    add(p1 + 0.006, 0.012, P.accent, METAL);

    // 마디: 비슷한 길이로 나누고, 위 마디일수록 한 단계 가늘다 (뽑아 쓰는 대)
    const n = THREE.MathUtils.clamp(Math.round(L / 1.15), 4, 7);
    const a0 = 0.0117;
    const aTip = 0.0033;
    const rEnd = 0.0008;
    const step = 0.9;
    const w = Math.pow(aTip / a0, 1 / (n - 1)) / step;
    let a = a0;
    let m0 = p1 + 0.006;
    for (let k = 0; k < n; k++) {
      const shade = k % 2 ? 0.92 : 1;
      if (k < n - 1) {
        const jm = (L * (k + 1)) / n;
        const b = a * w;
        const cs = jm - 0.026;
        add(m0, a, P.blank, LACQ, shade);
        add(cs, lerp(a, b, (cs - m0) / (jm - m0)), P.blank, LACQ, shade);
        // 마디 끝 보강: 약간 굵은 짙은 칠 띠 + 금속 테
        add(cs, b + 0.0007, P.blank, LACQ, shade * 0.5);
        add(jm - 0.007, b + 0.0007, P.blank, LACQ, shade * 0.5);
        add(jm - 0.007, b + 0.0011, P.accent, METAL);
        add(jm, b + 0.0011, P.accent, METAL);
        a = b * step;
        m0 = jm;
      } else {
        // 초릿대: 끝까지 가늘어지고, 끝에 붉은 릴리안 매듭
        const lm = L - 0.035;
        add(m0, a, P.blank, LACQ, shade);
        add(lm, lerp(a, rEnd, (lm - m0) / (L - m0)), P.blank, LACQ, shade);
        add(lm, 0.0014, P.lilian, CLOTH);
        add(L - 0.007, 0.0014, P.lilian, CLOTH);
        add(L - 0.006, 0.0022, P.lilian, CLOTH, 0.85);
        add(L - 0.0015, 0.0022, P.lilian, CLOTH, 0.85);
        add(L, 0.0005, P.lilian, CLOTH, 0.85);
      }
    }

    // 남는 고리는 가장 긴 구간을 반씩 나눠 채운다 (휘는 모양이 매끄럽게)
    while (K.length < RINGS) {
      let best = 0;
      let gap = -1;
      for (let i = 0; i < K.length - 1; i++) {
        const g = K[i + 1].s - K[i].s;
        if (g > gap) { gap = g; best = i; }
      }
      const p = K[best];
      const q = K[best + 1];
      K.splice(best + 1, 0, {
        s: (p.s + q.s) / 2, r: (p.r + q.r) / 2,
        c: [(p.c[0] + q.c[0]) / 2, (p.c[1] + q.c[1]) / 2, (p.c[2] + q.c[2]) / 2], mat: p.mat, axial: false,
      });
    }

    for (let i = 0; i < RINGS; i++) {
      const k = K[i];
      this.ss[i] = k.s;
      this.rr[i] = k.r;
      this.ax[i] = k.axial ? 1 : 0;
      for (let j = 0; j < RADIAL; j++) this.col.set(k.c, (i * RADIAL + j) * 3);
    }
    // 재질별로 면을 모아 그리기 호출을 3번으로 줄인다. 두 고리 사이 면은 굵은 쪽 재질을 따른다
    const lists: number[][] = [[], [], []];
    for (let i = 0; i < RINGS - 1; i++) {
      const p = K[i];
      const q = K[i + 1];
      const list = lists[q.r > p.r ? q.mat : p.mat];
      for (let j = 0; j < RADIAL; j++) {
        const a = i * RADIAL + j;
        const b = i * RADIAL + ((j + 1) % RADIAL);
        list.push(a, a + RADIAL, b, b, a + RADIAL, b + RADIAL);
      }
    }
    this.geo.clearGroups();
    let o = 0;
    for (let m = 0; m < 3; m++) {
      this.idx.set(lists[m], o);
      this.geo.addGroup(o, lists[m].length, m);
      o += lists[m].length;
    }
    this.geo.index!.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.loopMat?.color.copy(P.lilian);
  }

  /** 대 길이 비율 s 자리의 중심 (휨·떨림 포함) */
  private spine(s: number, out: THREE.Vector3) {
    // 휘기 시작하는 자리부터 끝에 힘을 받은 외팔보 모양
    const u = s <= this.bendStart ? 0 : (s - this.bendStart) / (1 - this.bendStart);
    const shape = (u * u * (3 - u)) / 2;
    const shorten = 1 - 0.18 * this.deflLen * s * s;
    out.copy(this.butt).addScaledVector(this.lastDir, this.L * s * shorten).addScaledVector(this.flexShape, this.L * shape);
    // 초릿대 떨림: 끝으로 갈수록 크다
    if (this.quiver > 0) out.addScaledVector(this.quiverDir, this.L * 0.01 * this.quiver * Math.sin(this.time * 38 + s * 4) * s ** 3);
    return out;
  }

  /**
   * 챔질·헤드셰이크 같은 순간 충격: 대가 그 방향으로 확 휘었다가 되돌아온다
   * @param amount 휨 속도 (대략 2~8)
   */
  kick(dir: THREE.Vector3, amount: number) {
    v1.copy(dir).addScaledVector(this.lastDir, -dir.dot(this.lastDir));
    if (v1.lengthSq() > 1e-6) this.flexVelocity.addScaledVector(v1.normalize(), amount);
  }

  /**
   * 대를 다시 그린다.
   * @param pull 대 끝을 당기는 방향 (단위 벡터) / bend 0~1
   * @param action 휨새 0(연질, 허리까지)~1(경질, 끝만)
   * @param quiver 초릿대 떨림 0~1 (고기가 머리를 흔들 때)
   */
  update(pose: RodPose, pull: THREE.Vector3 | null, bend: number, length = ROD.length, dt = 1 / 60, flex = ROD.flex, action = 0.6, quiver = 0) {
    const L = length;
    // 휘는 방향: 당기는 방향 중 대와 수직인 성분 + 자체 무게로 약간 처짐
    this.flexTarget.set(0, -0.04, 0);
    if (pull && bend > 0) {
      v2.copy(pull).addScaledVector(pose.dir, -pull.dot(pose.dir));
      this.flexTarget.addScaledVector(v2, bend * (0.5 + flex * 0.18));
    }
    const step = Math.min(0.04, Math.max(0, dt));
    v1.subVectors(this.flexTarget, this.flexShape);
    this.flexVelocity.addScaledVector(v1, step * 85).multiplyScalar(Math.exp(-step * 13));
    this.flexShape.addScaledVector(this.flexVelocity, step);
    const defl = this.flexShape;
    this.time += step;
    this.lastDir.copy(pose.dir);
    // 휨새: 힘이 약하면 초릿대만 휘고, 힘이 커질수록 휘는 자리가 허리·손잡이 쪽으로 내려온다
    const load = Math.min(1, defl.length() / (0.5 + flex * 0.18));
    this.bendStart = THREE.MathUtils.clamp(action * 0.72 * (1 - load * 0.85), 0, 0.72);
    this.quiverDir.crossVectors(pose.dir, UP).normalize();
    this.deflLen = defl.length();
    this.quiver = quiver;
    this.L = L;
    this.butt.copy(pose.butt);

    // 대가 바뀌면 마디 배치·색을 다시 잡는다
    const key = this.keyOf(L, flex);
    if (key !== this.key) {
      this.key = key;
      if (!this.custom) this.pickLook(key);
      this.layout(L);
    }

    const c = w1;
    const t = w2;
    const side = w3;
    const upv = w4;
    const pos = this.pos;
    const nrm = this.nrm;
    for (let i = 0; i < RINGS; i++) {
      const s = this.ss[i];
      this.spine(s, c);
      this.spine(Math.min(1, s + 0.004), t);
      t.sub(this.spine(Math.max(0, s - 0.004), w5)).normalize();
      side.crossVectors(t, UP).normalize();
      upv.crossVectors(side, t);
      const r = this.rr[i];
      const axial = this.ax[i] === 1;
      for (let j = 0; j < RADIAL; j++) {
        const k = (i * RADIAL + j) * 3;
        const nx = side.x * this.cosT[j] + upv.x * this.sinT[j];
        const ny = side.y * this.cosT[j] + upv.y * this.sinT[j];
        const nz = side.z * this.cosT[j] + upv.z * this.sinT[j];
        pos[k] = c.x + nx * r;
        pos[k + 1] = c.y + ny * r;
        pos[k + 2] = c.z + nz * r;
        // 끝마개 면은 뒤쪽을, 나머지는 바깥을 본다
        if (axial) { nrm[k] = -t.x; nrm[k + 1] = -t.y; nrm[k + 2] = -t.z; }
        else { nrm[k] = nx; nrm[k + 1] = ny; nrm[k + 2] = nz; }
      }
    }
    // 마지막 고리(s = 1)가 초릿대 끝
    this.tip.copy(c);
    // 릴리안 고리: 초릿대 끝에서 대 방향으로 늘어진 작은 고리
    this.loop.position.copy(c).addScaledVector(t, 0.0035);
    this.loop.quaternion.setFromUnitVectors(FWD, side);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}

/** 찌: 원점 = 물에 잠기는 기준선. 위로 찌톱 색띠 6cm가 수면 위에 선다 */
/** 찌톱 한 마디 (찌 자체 좌표). 화면에서는 SCALE배 = 약 2cm */
const NOTCH = 0.0125;
/** 몸통 모양: 길이·굵기·단면(a 볼록 위치, b 뾰족함)·색 */
interface FloatLook { topR: number; body: number; bodyR: number; a: number; b: number; color: string; band: string; foot: number; rings?: string; gloss?: boolean }
const FLOAT_LOOKS: Record<FloatShape, FloatLook> = {
  // 오동나무 막대찌: 위쪽이 볼록한 유선형
  stick: { topR: 0.0029, body: 0.17, bodyR: 0.0085, a: 0.75, b: 0.9, color: '#3a0d0d', band: '#c8a040', foot: 0.08, gloss: true },
  // 단찌: 짧고 굵다
  short: { topR: 0.0034, body: 0.1, bodyR: 0.0098, a: 0.8, b: 0.8, color: '#1f3a24', band: '#c8a040', foot: 0.05, gloss: true },
  // 나노·내림찌: 가늘고 길게 빠진다
  slim: { topR: 0.0021, body: 0.2, bodyR: 0.0058, a: 0.55, b: 1.2, color: '#1d2a3a', band: '#d8d8d8', foot: 0.11, gloss: true },
  // 대물 올림찌: 달걀처럼 굵은 몸통
  egg: { topR: 0.0034, body: 0.14, bodyR: 0.0135, a: 0.9, b: 0.6, color: '#5a1a10', band: '#c8a040', foot: 0.07, gloss: true },
  // 장찌: 길쭉한 막대
  long: { topR: 0.0027, body: 0.26, bodyR: 0.0085, a: 0.7, b: 0.9, color: '#2b1a3a', band: '#c8a040', foot: 0.1, gloss: true },
  // 갈대찌: 옅은 갈대색에 마디 고리
  reed: { topR: 0.0028, body: 0.2, bodyR: 0.0072, a: 0.6, b: 0.8, color: '#c9b27a', band: '#6a4a20', foot: 0.08, rings: '#8d7240' },
  // 공작찌: 상아색 깃대에 갈색 줄
  peacock: { topR: 0.0024, body: 0.22, bodyR: 0.0066, a: 0.5, b: 1.1, color: '#ddd3bb', band: '#2a6a8a', foot: 0.09, rings: '#6b5a3a' },
  // 전자찌: 검은 전지 몸통에 은색 띠
  electro: { topR: 0.0029, body: 0.16, bodyR: 0.0092, a: 0.8, b: 0.7, color: '#141414', band: '#c0c0c0', foot: 0.07, gloss: true },
};

export class Float {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  static readonly SCALE = 1.6;
  /** 찌톱 색 띠 재질: 밤에 은은하게 */
  private tips: THREE.MeshStandardMaterial[] = [];
  /** 케미라이트·LED: 밤에 찌 불빛의 중심 */
  private lamp: THREE.MeshStandardMaterial | null = null;
  /** 찌톱 높이 (찌 좌표) */
  private top = 10 * NOTCH;
  private specId = '';
  /** 찌톱 끝 불빛 번짐: 멀리서도 보이게 화면을 향하는 빛 판 */
  private readonly halo: THREE.Sprite;
  private readonly parts = new THREE.Group();

  /**
   * @param intensity 찌톱 띠 자체 밝기
   * @param halo 불빛 번짐 0~1 (어두울수록 크다)
   * @param color 불빛 색 (케미 연두 / 전자찌 빨강·초록)
   */
  setGlow(intensity: number, halo = 0, color = '#b8ff5a') {
    for (const m of this.tips) m.emissiveIntensity = this.lamp ? Math.min(intensity, 0.5) : intensity;
    if (this.lamp) {
      this.lamp.color.set(color);
      this.lamp.emissive.set(color);
      this.lamp.emissiveIntensity = 0.5 + halo * 3;
    }
    const mat = this.halo.material;
    mat.opacity = halo;
    mat.color.set(color);
    this.halo.visible = halo > 0.01;
  }

  /** 찌 종류가 바뀌면 모양을 다시 만든다 (같은 찌면 크기만) */
  setSpec(spec: FloatSpec) {
    this.body.scale.setScalar(Float.SCALE * spec.scale);
    if (spec.id === this.specId) return;
    this.specId = spec.id;
    this.build(spec);
  }

  constructor() {
    // 불빛 번짐: 방사형 그라데이션을 더해 그린다 (톤매핑에 눌리지 않게)
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), color: '#b8ff5a', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.halo.scale.setScalar(0.16);
    this.halo.visible = false;
    this.halo.frustumCulled = false;
    this.body.add(this.parts, this.halo);
    this.body.scale.setScalar(Float.SCALE);
    this.group.add(this.body);
    this.setSpec(FLOATS[0]);
  }

  private build(spec: FloatSpec) {
    for (const o of this.parts.children) {
      const m = o as THREE.Mesh;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.parts.clear();
    this.tips = [];
    this.lamp = null;
    const look = FLOAT_LOOKS[spec.shape ?? 'stick'];
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.frustumCulled = false;
      this.parts.add(m);
      return m;
    };
    const glow = (c: string, e = 0.35) => {
      const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.35 });
      this.tips.push(m);
      return m;
    };
    const lampMat = (c: string) => (this.lamp = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.92 }));
    const tube = (r: number, top: number, bot: number, mat: THREE.Material) => add(new THREE.CylinderGeometry(r, r, top - bot, 8), mat, (top + bot) / 2);

    // 찌톱: 물 위로 올라온 마디 띠 (빨강·노랑·초록이 번갈아). 맨 아래 검은 띠는 물속
    const n = spec.notches ?? 10;
    this.top = n * NOTCH;
    const colors = ['#ff3a1a', '#ffd400', '#20d050'];
    // 전자찌는 위쪽 세 마디가 LED 관
    const ledFrom = spec.light === 'electro' ? this.top - 3 * NOTCH : this.top;
    for (let i = 0, y = ledFrom; y > 0.0005; i++, y -= NOTCH) tube(look.topR, y, Math.max(0, y - NOTCH), glow(colors[i % 3]));
    tube(look.topR, 0, -0.015, glow('#ff3a1a'));
    tube(look.topR * 1.1, -0.015, -0.045, new THREE.MeshStandardMaterial({ color: '#181818', roughness: 0.5 }));
    let lightTop = this.top;
    const color = spec.glowColor ?? (spec.light === 'electro' ? '#ff5a3c' : '#d4ff6a');
    if (spec.light === 'electro') {
      const led = lampMat(color);
      tube(look.topR * 1.25, this.top, ledFrom, led);
      add(new THREE.SphereGeometry(look.topR * 1.25, 8, 6), led, this.top);
    } else if (spec.light === 'chemi') {
      // 케미 꽂이: 찌톱 끝 투명 관에 케미라이트 한 개
      lightTop = this.top + 3 * NOTCH;
      tube(look.topR * 1.4, this.top + 0.005, this.top - 0.006, new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.3, transparent: true, opacity: 0.6 }));
      const chemi = lampMat(color);
      tube(look.topR * 1.15, lightTop, this.top, chemi);
      add(new THREE.SphereGeometry(look.topR * 1.15, 8, 6), chemi, lightTop);
    } else {
      add(new THREE.SphereGeometry(look.topR, 8, 6), glow('#ff3a1a'), this.top);
    }
    this.halo.position.y = lightTop;

    // 몸통: 모양별 단면을 돌려 만든다
    const pts: THREE.Vector2[] = [];
    const radius = (t: number) => look.bodyR * Math.pow(Math.sin(Math.PI * Math.pow(t, look.a)), look.b) + 0.0015;
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      pts.push(new THREE.Vector2(radius(t), -0.045 - t * look.body));
    }
    const bodyMat = look.gloss
      ? new THREE.MeshPhysicalMaterial({ color: look.color, roughness: 0.25, clearcoat: 1 })
      : new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.7 });
    add(new THREE.LatheGeometry(pts, 14), bodyMat, 0);
    // 갈대 마디·공작 깃 줄무늬
    if (look.rings) {
      for (let t = 0.12; t < 0.95; t += 0.16) {
        const r = radius(t) + 0.0004;
        add(new THREE.CylinderGeometry(r, r, 0.003, 12), new THREE.MeshStandardMaterial({ color: look.rings, roughness: 0.7 }), -0.045 - t * look.body);
      }
    }
    // 몸통 위 장식 띠 (전자찌는 전지 뚜껑이라 더 넓다)
    const bandT = 0.15;
    const br = radius(bandT) + 0.0005;
    add(new THREE.CylinderGeometry(br, br, spec.shape === 'electro' ? 0.008 : 0.004, 14),
      new THREE.MeshStandardMaterial({ color: look.band, metalness: 0.9, roughness: 0.3 }), -0.045 - bandT * look.body);
    // 찌다리
    const footTop = -0.045 - look.body;
    add(new THREE.CylinderGeometry(0.0012, 0.0012, look.foot, 6), new THREE.MeshStandardMaterial({ color: '#d8d0b0' }), footTop - look.foot / 2 + 0.01);
    // 찌다리 끝을 꽂은 찌고무와 그 아래 찌멈춤 구슬 (원줄에 끼워진 모습)
    const footBot = footTop - look.foot + 0.01;
    add(new THREE.CylinderGeometry(0.0021, 0.0017, 0.012, 8), new THREE.MeshStandardMaterial({ color: '#2b3a2a', roughness: 0.6 }), footBot + 0.004);
    const bead = new THREE.MeshStandardMaterial({ color: '#e8742a', roughness: 0.4 });
    for (const dy of [-0.008, -0.0135]) add(new THREE.SphereGeometry(0.0017, 8, 6), bead, footBot + dy).scale.y = 1.5;
  }

  /** tilt 0 서 있음 ~ 1 수면에 누움. yaw: 눕는 방향 */
  place(x: number, y: number, z: number, tilt: number, yaw: number) {
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, yaw, 0);
    // 누울 때는 무게중심(몸통 가운데) 부근이 수면에 뜬다
    const ang = tilt * Math.PI * 0.5;
    this.body.rotation.set(0, 0, ang);
    this.body.position.set(Math.sin(ang) * -0.12 * Float.SCALE, Math.sin(ang) * 0.004, 0);
  }

  /** 대 끝에 매달려 흔들릴 때: 찌 위쪽이 줄에 걸려 거꾸로가 아닌 그대로 늘어진다 */
  hang(x: number, y: number, z: number, swingX: number, swingZ: number) {
    this.group.position.set(x, y, z);
    this.group.rotation.set(swingX, 0, swingZ);
    this.body.rotation.set(0, 0, 0);
    // 길어진 찌톱 끝이 줄에 매달린다
    this.body.position.set(0, -this.top * this.body.scale.y, 0);
  }
}

/** 처지는 낚싯줄 (수면에 닿는 부분은 물 위에 눕는다) */
export class FishingLine {
  readonly line: THREE.Line;
  private readonly N = 48;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.N * 3), 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#e6e3d6', transparent: true, opacity: 0.7, fog: true }));
    this.line.frustumCulled = false;
  }

  update(a: THREE.Vector3, b: THREE.Vector3, sag: number, clampToSurface = true) {
    const p = this.line.geometry.attributes.position as THREE.BufferAttribute;
    const len = a.distanceTo(b);
    for (let i = 0; i < this.N; i++) {
      const t = i / (this.N - 1);
      v1.lerpVectors(a, b, t);
      v1.y -= sag * len * 0.12 * 4 * t * (1 - t);
      // 수면에 닿은 줄은 물 위에 눕고, 끝이 물속이면 마지막에만 잠긴다
      const surf = WATER_Y + 0.002;
      const floor = b.y < WATER_Y ? surf - Math.max(0, (t - 0.9) / 0.1) * (surf - b.y) : surf;
      if (clampToSurface && v1.y < floor) v1.y = floor;
      p.setXYZ(i, v1.x, v1.y, v1.z);
    }
    p.needsUpdate = true;
  }
}

/** 물보라 입자 */
export class Splashes {
  readonly points: THREE.Points;
  private readonly N = 700;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private next = 0;

  constructor() {
    this.pos = new Float32Array(this.N * 3).fill(-999);
    this.vel = new Float32Array(this.N * 3);
    this.life = new Float32Array(this.N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({
      size: 0.05,
      map: new THREE.CanvasTexture(c),
      color: '#e8eef0',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  burst(x: number, z: number, size: number) {
    const n = Math.round(20 + size * 60);
    for (let i = 0; i < n; i++) {
      const k = this.next;
      this.next = (this.next + 1) % this.N;
      const a = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random() * 1.4) * (0.5 + size * 0.6);
      this.pos.set([x + Math.cos(a) * 0.05 * size, WATER_Y + 0.02, z + Math.sin(a) * 0.05 * size], k * 3);
      this.vel.set([Math.cos(a) * sp * 0.5, (1.2 + Math.random() * 2.2) * (0.5 + size * 0.5), Math.sin(a) * sp * 0.5], k * 3);
      this.life[k] = 1;
    }
  }

  update(dt: number) {
    for (let k = 0; k < this.N; k++) {
      if (this.life[k] <= 0) continue;
      this.vel[k * 3 + 1] -= 9.8 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      if (this.pos[k * 3 + 1] < WATER_Y) {
        this.life[k] = 0;
        this.pos[k * 3 + 1] = -999;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

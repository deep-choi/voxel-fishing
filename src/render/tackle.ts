import * as THREE from 'three';
import { ROD } from '../game/data';
import { WATER_Y } from '../world/lake';

// 낚싯대(휘어짐), 스피닝 릴, 한국식 민물 찌, 낚싯줄, 물보라.

const SEGS = 28;
const RADIAL = 8;
const GRIP = 0.4;

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

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
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: '#cbd3d0', metalness: 0.55, roughness: 0.45 });
    for (const [x, y, w, h] of [[0.011, 0.025, 0.004, 0.05], [0.004, 0.001, 0.018, 0.004], [-0.004, 0.007, 0.004, 0.016], [0, 0.013, 0.01, 0.004]]) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.scale.set(w, h, 0.004); this.group.add(m);
    }
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
    for (const [x, z] of [[0.055, 0.02], [-0.055, -0.25]]) {
      const hand = new THREE.Mesh(geo, skin); hand.scale.set(0.1, 0.085, 0.13); hand.position.set(x, -0.025, z);
      const arm = new THREE.Mesh(geo, sleeve); arm.scale.set(0.115, 0.12, 0.3); arm.position.set(x * 2, -0.09, z + 0.2);
      this.group.add(hand, arm);
    }
    this.group.visible = false;
  }
  update(pose: RodPose, visible: boolean) {
    this.group.visible = visible;
    this.group.position.copy(pose.butt);
    this.group.quaternion.setFromUnitVectors(this.axis, pose.dir);
  }
}

export class Rod {
  readonly group = new THREE.Group();
  readonly tip = new THREE.Vector3();
  private readonly geo = new THREE.BufferGeometry();
  private readonly pos: Float32Array;
  private readonly centers: THREE.Vector3[] = [];
  private readonly flexShape = new THREE.Vector3(0, -0.04, 0);
  private readonly flexVelocity = new THREE.Vector3();
  private readonly flexTarget = new THREE.Vector3();
  private readonly quiverDir = new THREE.Vector3();
  private readonly lastDir = new THREE.Vector3(0, 0, -1);
  private time = 0;

  constructor() {
    const n = (SEGS + 1) * RADIAL;
    this.pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const grip = new THREE.Color('#1d1b19');
    const blank = new THREE.Color('#354a38');
    const wrap = new THREE.Color('#7a5a28');
    const c = new THREE.Color();
    for (let i = 0; i <= SEGS; i++) {
      const s = this.sAt(i);
      const m = s * ROD.length;
      if (m < GRIP) c.copy(grip);
      else c.copy(blank);
      // 마디 이음새 띠 (민장대는 여러 마디를 뽑아 쓴다)
      if (m > GRIP && Math.abs(((m - GRIP) % 0.9) - 0.9) < 0.025) c.copy(wrap);
      for (let j = 0; j < RADIAL; j++) col.set([c.r, c.g, c.b], (i * RADIAL + j) * 3);
      this.centers.push(new THREE.Vector3());
    }
    const idx: number[] = [];
    for (let i = 0; i < SEGS; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * RADIAL + j;
        const b = i * RADIAL + ((j + 1) % RADIAL);
        idx.push(a, b, a + RADIAL, b, b + RADIAL, a + RADIAL);
      }
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geo.setIndex(idx);
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.group.add(mesh);

  }

  /** 마디 i → 대 길이 비율 (손잡이 쪽 촘촘) */
  private sAt(i: number) {
    return Math.pow(i / SEGS, 1.15);
  }

  /**
   * 대를 다시 그린다.
   * @param pull 대 끝을 당기는 방향 (단위 벡터) / bend 0~1
   */
  /**
   * 챔질·헤드셰이크 같은 순간 충격: 대가 그 방향으로 확 휘었다가 되돌아온다
   * @param amount 휨 속도 (대략 2~8)
   */
  kick(dir: THREE.Vector3, amount: number) {
    v1.copy(dir).addScaledVector(this.lastDir, -dir.dot(this.lastDir));
    if (v1.lengthSq() > 1e-6) this.flexVelocity.addScaledVector(v1.normalize(), amount);
  }

  /**
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
    const start = THREE.MathUtils.clamp(action * 0.72 * (1 - load * 0.85), 0, 0.72);
    this.quiverDir.crossVectors(pose.dir, UP).normalize();
    for (let i = 0; i <= SEGS; i++) {
      const s = this.sAt(i);
      // 휘기 시작하는 자리부터 끝에 힘을 받은 외팔보 모양
      const u = s <= start ? 0 : (s - start) / (1 - start);
      const shape = (u * u * (3 - u)) / 2;
      const shorten = 1 - 0.18 * defl.length() * s * s;
      this.centers[i].copy(pose.butt).addScaledVector(pose.dir, L * s * shorten).addScaledVector(defl, L * shape);
      // 초릿대 떨림: 끝으로 갈수록 크다
      if (quiver > 0) this.centers[i].addScaledVector(this.quiverDir, L * 0.01 * quiver * Math.sin(this.time * 38 + s * 4) * s ** 3);
    }
    this.tip.copy(this.centers[SEGS]);

    const side = v2;
    const upv = v3;
    for (let i = 0; i <= SEGS; i++) {
      const s = this.sAt(i);
      const m = s * L;
      const t = new THREE.Vector3().subVectors(this.centers[Math.min(SEGS, i + 1)], this.centers[Math.max(0, i - 1)]).normalize();
      side.crossVectors(t, UP).normalize();
      upv.crossVectors(side, t).normalize();
      let r = 0.013 * (1 - s) + 0.0015;
      if (m < GRIP) r = m < 0.03 ? 0.011 : 0.0128;
      for (let j = 0; j < RADIAL; j++) {
        const a = (j / RADIAL) * Math.PI * 2;
        const k = (i * RADIAL + j) * 3;
        const c = this.centers[i];
        this.pos[k] = c.x + (side.x * Math.cos(a) + upv.x * Math.sin(a)) * r;
        this.pos[k + 1] = c.y + (side.y * Math.cos(a) + upv.y * Math.sin(a)) * r;
        this.pos[k + 2] = c.z + (side.z * Math.cos(a) + upv.z * Math.sin(a)) * r;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();

  }
}

/** 찌: 원점 = 물에 잠기는 기준선. 위로 찌톱 색띠 6cm가 수면 위에 선다 */
export class Float {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  static readonly SCALE = 1.6;
  /** 찌톱 색 띠 재질: 밤에 케미·전자찌가 빛나게 */
  private readonly tips: THREE.MeshStandardMaterial[] = [];
  setScale(scale: number) { this.body.scale.setScalar(Float.SCALE * scale); }
  /** 찌톱 끝 케미 불빛 번짐: 멀리서도 보이게 화면을 향하는 빛 판 */
  private readonly halo: THREE.Sprite;
  /**
   * @param intensity 찌톱 띠 자체 밝기
   * @param halo 케미 불빛 번짐 0~1 (어두울수록 크다)
   * @param color 케미 색 (케미라이트 연두 / 전자찌 빨강)
   */
  setGlow(intensity: number, halo = 0, color = '#b8ff5a') {
    for (const m of this.tips) m.emissiveIntensity = intensity;
    const mat = this.halo.material;
    mat.opacity = halo;
    mat.color.set(color);
    this.halo.visible = halo > 0.01;
  }

  constructor() {
    const glow = (c: string, e = 0.35) => {
      const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.35 });
      this.tips.push(m);
      return m;
    };
    // 찌톱: 물 위로 길게 올라온 마디 띠 (빨강·노랑·초록이 번갈아). 맨 아래 검은 띠는 물속
    const TOP = 0.125;
    const colors = ['#ff3a1a', '#ffd400', '#20d050'];
    const bands: [string, number, number][] = [];
    for (let i = 0, y = TOP; y > 0.0005; i++, y -= 0.0125) bands.push([colors[i % 3], y, Math.max(0, y - 0.0125)]);
    bands.push(['#ff3a1a', 0, -0.015], ['#181818', -0.015, -0.045]);
    for (const [c, top, bot] of bands) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0029, 0.0029, top - bot, 8), glow(c));
      m.position.y = (top + bot) / 2;
      this.body.add(m);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0029, 8, 6), glow('#ff3a1a'));
    cap.position.y = TOP;
    this.body.add(cap);
    // 케미 불빛 번짐: 방사형 그라데이션을 더해 그린다 (톤매핑에 눌리지 않게)
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
    this.halo.position.y = TOP;
    this.halo.visible = false;
    this.body.add(this.halo);
    // 몸통 (오동나무·발사 느낌의 유선형)
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = 0.0085 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.9) + 0.0015;
      pts.push(new THREE.Vector2(r, -0.045 - t * 0.17));
    }
    const lathe = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 14),
      new THREE.MeshPhysicalMaterial({ color: '#3a0d0d', roughness: 0.25, clearcoat: 1 }),
    );
    this.body.add(lathe);
    const goldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.004, 14), new THREE.MeshStandardMaterial({ color: '#c8a040', metalness: 0.9, roughness: 0.3 }));
    goldBand.position.y = -0.07;
    this.body.add(goldBand);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.08, 6), new THREE.MeshStandardMaterial({ color: '#d8d0b0' }));
    foot.position.y = -0.255;
    this.body.add(foot);
    this.body.scale.setScalar(Float.SCALE);
    this.group.add(this.body);
    this.group.traverse((o) => (o.frustumCulled = false));
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
    this.body.position.set(0, -0.125 * Float.SCALE, 0);
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

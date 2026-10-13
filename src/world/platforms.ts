import * as THREE from 'three';
import { PLAYER, SHORE_Z } from './lake';
import { mulberry } from './noise';
import { ACTIVE_FISHERY } from '../game/fisheries';

export const DECK_Y = 0.85;
/** 물가 끝 받침틀 바로 뒤에 서는 위치. 시작과 좌대 이동이 같은 위치를 쓴다. */
export const FISHING_POSITION_OFFSET = 3.3;
export interface RodSlot {
  id: string;
  platform: number;
  number: number;
  x: number;
  z: number;
  /** 받침틀 자리 (1 왼쪽 · 2 가운데 · 3 오른쪽) */
  seat: number;
  /** 받침틀에서 이 대가 향하는 방향 (라디안). 지금은 세 대 모두 정면(0) */
  yaw: number;
  marker: THREE.Mesh;
}
/** 좌대의 낚시 자리 하나: 받침틀 한 개와 그 위의 세 대 자리 */
export interface Seat { id: string; platform: number; number: number; x: number; z: number; slots: RodSlot[] }
export interface Platform { id: number; x: number; z: number; name: string; slots: RodSlot[]; seats: Seat[] }
/** 좌대 가운데에서 왼쪽·가운데·오른쪽 받침틀까지 거리 (m) */
const SEAT_OFFSETS = [-3.2, 0, 3.2];
/** 관리동 가게: 낚시점(장비·미끼 구매), 어시장(물고기 판매) */
export interface Stall { id: 'shop' | 'market'; name: string; x: number; z: number }
type Deck = { x: number; z: number; w: number; d: number };
type Axis = 'x' | 'z';
/** 정적 복셀 한 칸: 모두 모아 InstancedMesh 하나로 그린다 (그리기 호출 1번) */
type Part = { x: number; y: number; z: number; w: number; h: number; d: number; color: THREE.Color; ry: number };

const TRIM = '#6b5640';
const DARK_WOOD = '#4a3b2b';
const GLASS = '#86aebb';
/** 받침틀·의자 금속 */
const ALU = '#9aa3a6';
const ALU_LIGHT = '#c9d0d2';
const ALU_DARK = '#5f686b';
const RUBBER = '#1f2426';

/** 좌대와 연결 다리의 동일한 영역을 렌더링과 보행 판정에 사용한다. */
export class Platforms {
  readonly group = new THREE.Group();
  readonly platforms: Platform[] = [];
  readonly slots: RodSlot[] = [];
  private readonly decks: Deck[] = [];
  /** 걸어 들어갈 수 없는 건물 (중심·반폭) */
  private readonly blocks: { x: number; z: number; hw: number; hd: number }[] = [];
  readonly stalls: Stall[] = [];
  /** 관리동 마당 가운데 */
  readonly office = { x: 0, z: SHORE_Z - 8 };
  private readonly cube = new THREE.BoxGeometry(1, 1, 1);
  private readonly materials = new Map<string, THREE.MeshLambertMaterial>();
  private readonly parts: Part[] = [];
  private readonly rnd = mulberry(ACTIVE_FISHERY.terrain.seed + 77);
  /** 밤에 은은하게 켜지는 등 */
  private readonly lampMat = new THREE.MeshLambertMaterial({ color: '#ffe2a8', emissive: '#ffb85a', emissiveIntensity: 0.9 });

  constructor() {
    this.group.name = `${ACTIVE_FISHERY.name} 좌대 낚시터`;
    const config = ACTIVE_FISHERY.platforms;
    const firstZ = SHORE_Z - 22;
    const oz = this.office.z;
    // 가운데 다리: 걷는 영역은 한 장, 그림은 관리동 마당과 겹치는 곳을 비운다 (판재가 겹쳐 깜빡이지 않게)
    const bridgeZ = firstZ - config.spacing * 1.5, bridgeD = config.spacing * 3 + 45;
    this.walkway(0, bridgeZ, 2.8, bridgeD);
    const bridgeTop = bridgeZ + bridgeD / 2, bridgeEnd = bridgeZ - bridgeD / 2;
    this.planks(0, (bridgeTop + oz + 3.5) / 2, 2.8, bridgeTop - (oz + 3.5));
    this.planks(0, (oz - 3.5 + bridgeEnd) / 2, 2.8, oz - 3.5 - bridgeEnd);
    // 다리 밑 부력통
    for (let bz = bridgeEnd + 3; bz < oz - 4; bz += 6) this.solid(0, 0.12, bz, 2.4, 0.5, 1.1, '#26393a');
    const joints: number[] = [];
    for (let row = 0; row < 4; row++) {
      for (const side of [-1, 1]) {
        const id = this.platforms.length + 1;
        const x = side * config.gap;
        const z = firstZ - row * config.spacing;
        // 연결 다리: 가운데 다리와 좌대 사이만 그린다
        this.walkway(side * config.gap / 2, z + 2, config.gap, 2.2);
        const inner = 1.4, outer = config.gap - 5;
        this.planks(side * (inner + outer) / 2, z + 2, outer - inner, 2.2);
        joints.push(z + 2);
        this.deck(x, z, 10, 10);
        this.platformDressing(x, z, side);
        this.cabin(x + side * 2.1, z + 2.8, side, id);
        this.keepnetBox(x - side * 3.4, z + 2.6);
        const p: Platform = { id, x, z, name: `${String(id).padStart(2, '0')}번 ${config.names[id - 1]} 좌대`, slots: [], seats: [] };
        // 좌대 하나에 받침틀 세 개(왼쪽·가운데·오른쪽 자리). 한 사람이 한 받침틀에 세 대까지 편다.
        // 8좌대 × 3자리 = 24명이 함께 낚시할 수 있다
        for (const [k, ox] of SEAT_OFFSETS.entries()) {
          const seat: Seat = { id: `${id}-${k + 1}`, platform: id, number: k + 1, x: x + ox, z: z - FISHING_POSITION_OFFSET, slots: [] };
          this.chair(seat.x, z - 2.9);
          this.rodFrame(p, seat, z);
          p.seats.push(seat);
        }
        this.platforms.push(p);
        if (ACTIVE_FISHERY.id === 'gold') this.parasol(x - side * 2.7, z + 1.4, id % 2 ? '#bb7058' : '#c6ad58');
        if (ACTIVE_FISHERY.id === 'moon') this.lampPost(x + side * 3.8, z + 0.5, 1.3);
      }
    }
    this.bridgeRails(bridgeTop, bridgeEnd, oz, joints);
    // 관리동: 다리가 시작되는 물가의 수상 마당. 다리에서 들어오면 왼쪽 낚시점, 오른쪽 어시장
    this.deck(0, oz, 16, 7);
    for (const dx of [-6.5, -2.2, 2.2, 6.5]) this.solid(dx, 0.13, oz, 1.3, 0.8, 6.4, '#293f40');
    this.stall('shop', '낚시점', -5.4, oz, 1, '#3f6b8a');
    this.stall('market', '어시장', 5.4, oz, -1, '#8a4b3f');
    this.plaza(oz);
    this.build();
    // 입장하면 출발 지점(다리 입구의 관리동 마당)에서 시작한다. 정면으로 좌대 다리, 양옆에 낚시점·어시장
    PLAYER.x = this.office.x;
    PLAYER.z = this.office.z + 2.2;
  }

  // ── 기본 도구 ─────────────────────────────

  /** 색을 조금씩 흔든다 (판재마다 결이 다르게) */
  private shade(color: string, amount: number) {
    return new THREE.Color(color).offsetHSL(0, 0, amount);
  }
  private jitter(color: string, spread = 0.035) {
    return this.shade(color, (this.rnd() - 0.5) * 2 * spread);
  }

  /** 정적 복셀 한 칸 */
  private solid(x: number, y: number, z: number, w: number, h: number, d: number, color: string | THREE.Color, ry = 0) {
    this.parts.push({ x, y, z, w, h, d, color: typeof color === 'string' ? new THREE.Color(color) : color, ry });
  }

  /** 벽면에 붙는 판: axis는 벽의 법선 방향, dir은 바깥 쪽 부호, off는 벽에서 떨어진 거리 */
  private onWall(cx: number, cy: number, cz: number, axis: Axis, dir: number, off: number, along: number, h: number, thick: number, color: string | THREE.Color) {
    if (axis === 'x') this.solid(cx + dir * off, cy, cz, thick, h, along, color);
    else this.solid(cx, cy, cz + dir * off, along, h, thick, color);
  }

  /** 따로 움직이거나 재질을 바꾸는 것만 개별 메쉬로 (받침대 표시, 등) */
  private box(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    let mat = this.materials.get(color);
    if (!mat) { mat = new THREE.MeshLambertMaterial({ color }); this.materials.set(color, mat); }
    const mesh = new THREE.Mesh(this.cube, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  private lamp(x: number, y: number, z: number, s = 0.22) {
    const m = new THREE.Mesh(this.cube, this.lampMat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    this.group.add(m);
  }

  /** 모은 복셀을 한 번에 그린다 */
  private build() {
    const mesh = new THREE.InstancedMesh(this.cube, new THREE.MeshLambertMaterial(), this.parts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.parts.forEach((b, i) => {
      m.compose(p.set(b.x, b.y, b.z), q.setFromEuler(e.set(0, b.ry, 0)), s.set(b.w, b.h, b.d));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
  }

  // ── 바닥 ─────────────────────────────────

  private walkway(x: number, z: number, w: number, d: number) {
    this.decks.push({ x, z, w, d });
  }
  private deck(x: number, z: number, w: number, d: number) {
    this.walkway(x, z, w, d);
    this.planks(x, z, w, d);
  }

  /**
   * 나무 바닥: 짧은 쪽으로 걸친 판재를 촘촘히 깔고, 판마다 몇 조각으로 나눠 이음매를 엇갈린다.
   * 판재 색·높이를 조금씩 흔들고, 틈 사이로 어두운 밑판과 장선이 보인다.
   */
  private planks(x: number, z: number, w: number, d: number) {
    if (w <= 0 || d <= 0) return;
    const wood = ACTIVE_FISHERY.platforms.wood;
    const along: Axis = w <= d ? 'x' : 'z';
    const span = along === 'x' ? w : d, run = along === 'x' ? d : w;
    // 틈 사이로 보이는 어두운 밑판과 장선(판을 받치는 각재)
    this.solid(x, DECK_Y - 0.17, z, w - 0.02, 0.06, d - 0.02, '#2c261d');
    for (const t of [-0.42, 0, 0.42]) {
      const o = t * span;
      if (along === 'x') this.solid(x + o, DECK_Y - 0.3, z, 0.16, 0.2, d, this.shade(wood, -0.2));
      else this.solid(x, DECK_Y - 0.3, z + o, w, 0.2, 0.16, this.shade(wood, -0.2));
    }
    const width = 0.3, gap = 0.022;
    const count = Math.max(1, Math.round(run / width));
    const step = run / count;
    for (let i = 0; i < count; i++) {
      const c = -run / 2 + (i + 0.5) * step;
      // 이음매: 판마다 시작 위치를 엇갈리게
      let a = -span / 2;
      const first = 0.6 + this.rnd() * 1.2;
      let len = Math.min(span, first);
      while (a < span / 2 - 0.01) {
        len = Math.min(len, span / 2 - a);
        const mid = a + len / 2, y = DECK_Y - 0.06 + (this.rnd() - 0.5) * 0.008;
        const col = this.jitter(wood, 0.045);
        if (along === 'x') this.solid(x + mid, y, z + c, len - 0.012, 0.12, step - gap, col);
        else this.solid(x + c, y, z + mid, step - gap, 0.12, len - 0.012, col);
        a += len;
        len = 1.4 + this.rnd() * 1.4;
      }
    }
  }

  // ── 좌대 ─────────────────────────────────

  /** 좌대 테두리·부력통·모서리 기둥·계선주·구명환 */
  private platformDressing(x: number, z: number, side: number) {
    // 물에 뜬 검은 부력통
    for (const dx of [-3.5, 3.5]) this.solid(x + dx, 0.13, z, 1.3, 0.8, 8.8, '#293f40');
    // 옆·뒤 가장자리 테두리 목재 (앞은 받침틀 자리라 비운다)
    for (const dx of [-4.9, 4.9]) this.solid(x + dx, DECK_Y + 0.07, z, 0.2, 0.24, 10, this.shade(DARK_WOOD, 0.06));
    this.solid(x, DECK_Y + 0.07, z + 4.9, 9.6, 0.24, 0.2, this.shade(DARK_WOOD, 0.06));
    // 모서리 기둥과 계선주(밧줄 거는 쇠기둥)
    for (const dx of [-4.85, 4.85]) for (const dz of [-4.85, 4.85]) {
      this.solid(x + dx, DECK_Y + 0.22, z + dz, 0.22, 0.5, 0.22, DARK_WOOD);
      this.solid(x + dx, DECK_Y + 0.49, z + dz, 0.28, 0.06, 0.28, this.shade(DARK_WOOD, -0.05));
    }
    for (const dz of [0.4, -1.4]) {
      const cx = x - side * 4.6;
      this.solid(cx, DECK_Y + 0.1, z + dz, 0.12, 0.2, 0.12, '#3d4244');
      this.solid(cx, DECK_Y + 0.22, z + dz, 0.12, 0.06, 0.38, '#4a5052');
    }
    // 밧줄 한 사리
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      this.solid(x - side * 4.1 + Math.cos(a) * 0.22, DECK_Y + 0.04, z + 1.6 + Math.sin(a) * 0.22, 0.12, 0.07, 0.12, '#c6b48a');
    }
  }

  /**
   * 받침틀 하나: 뒤꽂이 가로대와 앞받침 가로대를 옆 틀로 잇고, 세 대를 일자로 나란히 건다.
   * 좌대 앞끝(z - 5)에서 8cm만 안쪽.
   */
  private rodFrame(p: Platform, seat: Seat, z: number) {
    const x = seat.x;
    const frontZ = z - 5 + 0.08, backZ = frontZ + 0.82, midZ = (backZ + frontZ) / 2, len = backZ - frontZ;
    const y = DECK_Y + 0.07;
    // 앞·뒤 가로대와 옆 틀 (사각 파이프), 끝은 검은 마개
    for (const rz of [frontZ, backZ]) {
      this.solid(x, y, rz, 2.04, 0.05, 0.05, ALU);
      this.solid(x, y + 0.026, rz, 2.04, 0.008, 0.03, ALU_LIGHT);
      for (const sx of [-1.04, 1.04]) this.solid(x + sx, y, rz, 0.04, 0.06, 0.06, RUBBER);
    }
    for (const sx of [-0.98, 0.98]) {
      this.solid(x + sx, y, midZ, 0.05, 0.05, len, ALU);
      this.solid(x + sx, y + 0.026, midZ, 0.03, 0.008, len, ALU_LIGHT);
    }
    // 모서리 이음쇠와 높이 조절 다리 (나사 손잡이 · 고무발)
    for (const sx of [-0.98, 0.98]) for (const rz of [frontZ, backZ]) {
      this.solid(x + sx, y, rz, 0.08, 0.08, 0.08, ALU_DARK);
      this.solid(x + sx, DECK_Y + 0.02, rz, 0.1, 0.04, 0.1, RUBBER);
      this.solid(x + sx + (sx > 0 ? 0.06 : -0.06), y, rz, 0.04, 0.03, 0.03, '#b23a2e');
    }
    // 오른쪽 옆: 떡밥 그릇 받침 (작은 판 + 그릇)
    const tx = x + 1.25;
    this.solid(tx - 0.12, y, midZ, 0.24, 0.03, 0.05, ALU);
    this.solid(tx, y + 0.02, midZ, 0.26, 0.02, 0.26, ALU_DARK);
    this.solid(tx, y + 0.07, midZ, 0.2, 0.08, 0.2, '#3c6e8f');
    this.solid(tx, y + 0.1, midZ, 0.16, 0.02, 0.16, '#b39157');
    for (let i = 0; i < 3; i++) {
      // 세 대 모두 정면(물 쪽)으로 평행하게, 0.6m 간격
      const yaw = 0;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const bx = x + (i - 1) * 0.6;
      const sx = bx + fx * 0.65, sz = backZ + fz * 0.65;
      // 자리 표시판: 앞받침 발치의 작은 판 (입질·걸림 때 색이 바뀐다)
      const marker = this.box(sx + fx * 0.17, DECK_Y + 0.012, sz + fz * 0.17, 0.16, 0.02, 0.16, '#eac67d');
      marker.material = new THREE.MeshLambertMaterial({ color: '#eac67d', emissive: '#40351a' });
      // 뒤꽂이(손잡이를 물리는 집게)와 낮은 앞받침(고무 U자): 초릿대는 물 쪽으로 내려간다.
      this.buttHolder(sx - fx * 0.65, sz - fz * 0.65, 0.23, yaw);
      this.frontRest(sx + fx * 0.17, sz + fz * 0.17, 0.14, yaw);
      const slot: RodSlot = { id: `${seat.id}-${i + 1}`, platform: p.id, seat: seat.number, number: i + 1, x: sx, z: sz, yaw, marker };
      seat.slots.push(slot);
      p.slots.push(slot);
      this.slots.push(slot);
    }
  }

  /** 접이식 낚시 의자: 쿠션 앉판·높은 등받이·머리 받침·팔걸이·컵홀더·높이 조절 다리와 넓은 발판 */
  private chair(x: number, z: number) {
    const cloth = '#5a7a62', piping = '#34493b', pad = '#2a312d', frame = '#4b5457';
    // 다리: 바깥으로 살짝 벌어진 네 다리, 조절 나사, 진흙에 안 빠지는 넓은 발판
    for (const lx of [-0.29, 0.29]) for (const lz of [-0.26, 0.24]) {
      this.solid(x + lx, DECK_Y + 0.21, z + lz, 0.045, 0.38, 0.045, frame);
      this.solid(x + lx, DECK_Y + 0.12, z + lz, 0.06, 0.05, 0.06, ALU_DARK);
      this.solid(x + lx + (lx > 0 ? 0.035 : -0.035), DECK_Y + 0.12, z + lz, 0.025, 0.025, 0.025, '#b23a2e');
      this.solid(x + lx, DECK_Y + 0.015, z + lz, 0.13, 0.03, 0.13, RUBBER);
    }
    // 앉판 틀과 쿠션 (가장자리 테두리 실선)
    this.solid(x, DECK_Y + 0.4, z, 0.66, 0.04, 0.6, frame);
    this.solid(x, DECK_Y + 0.45, z, 0.6, 0.07, 0.54, piping);
    this.solid(x, DECK_Y + 0.47, z, 0.54, 0.06, 0.48, cloth);
    this.solid(x, DECK_Y + 0.5, z, 0.44, 0.012, 0.03, piping);
    // 등받이: 틀 기둥, 천, 가로 누빔, 머리 받침
    for (const lx of [-0.31, 0.31]) this.solid(x + lx, DECK_Y + 0.82, z + 0.29, 0.045, 0.82, 0.045, frame);
    this.solid(x, DECK_Y + 0.82, z + 0.3, 0.58, 0.66, 0.04, piping);
    this.solid(x, DECK_Y + 0.82, z + 0.285, 0.52, 0.6, 0.04, cloth);
    for (const ty of [0.66, 0.86, 1.04]) this.solid(x, DECK_Y + ty, z + 0.264, 0.5, 0.012, 0.012, piping);
    this.solid(x, DECK_Y + 1.27, z + 0.29, 0.4, 0.14, 0.08, pad);
    this.solid(x, DECK_Y + 1.235, z + 0.29, 0.66, 0.03, 0.05, frame);
    // 팔걸이: 받침 기둥 + 쿠션 패드, 오른쪽엔 컵홀더
    for (const lx of [-0.34, 0.34]) {
      this.solid(x + lx, DECK_Y + 0.56, z - 0.2, 0.035, 0.16, 0.035, frame);
      this.solid(x + lx, DECK_Y + 0.64, z + 0.02, 0.07, 0.04, 0.5, frame);
      this.solid(x + lx, DECK_Y + 0.675, z + 0.02, 0.08, 0.03, 0.4, pad);
    }
    this.solid(x + 0.45, DECK_Y + 0.64, z - 0.12, 0.14, 0.04, 0.14, frame);
    this.solid(x + 0.45, DECK_Y + 0.7, z - 0.12, 0.08, 0.1, 0.08, '#c8402f');
  }

  /** 살림망·장비 상자 */
  private keepnetBox(x: number, z: number) {
    this.solid(x, DECK_Y + 0.22, z, 1.05, 0.44, 0.65, '#d2c7a1');
    this.solid(x, DECK_Y + 0.46, z, 1.1, 0.06, 0.7, '#b9ad86');
    this.solid(x, DECK_Y + 0.3, z - 0.34, 0.3, 0.08, 0.04, '#5b5238');
    for (const dx of [-0.4, 0.4]) this.solid(x + dx, DECK_Y + 0.22, z, 0.06, 0.46, 0.67, '#a89c74');
  }

  /** 받침대 조각을 대가 놓이는 방향(yaw)으로 돌려 놓는다. px 옆, py 높이, pz 대 방향 */
  private restPart(x: number, z: number, yaw: number, px: number, py: number, pz: number, w: number, h: number, d: number, color: string) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    this.solid(x + px * c + pz * s, DECK_Y + py, z - px * s + pz * c, w, h, d, color, yaw);
  }

  /** 앞받침: 은색 기둥, 황동 조임 고리, 고무를 댄 U자 받침과 둥근 끝 */
  private frontRest(x: number, z: number, h: number, yaw: number) {
    const part = (px: number, py: number, pz: number, w: number, ht: number, d: number, color: string) => this.restPart(x, z, yaw, px, py, pz, w, ht, d, color);
    part(0, 0.015, 0, 0.09, 0.03, 0.09, ALU_DARK);
    part(0, h / 2, 0, 0.035, h, 0.035, ALU);
    part(0, h * 0.55, 0, 0.055, 0.035, 0.055, '#c9a24a');
    part(0, h, 0, 0.22, 0.035, 0.07, RUBBER);
    part(0, h + 0.022, 0, 0.13, 0.014, 0.06, '#3d5a48');
    for (const sx of [-0.095, 0.095]) {
      part(sx, h + 0.045, 0, 0.03, 0.09, 0.06, RUBBER);
      part(sx, h + 0.095, 0, 0.04, 0.02, 0.07, '#3a4244');
    }
  }

  /** 뒤꽂이: 손잡이 끝을 물리는 반원 집게와 빨간 조임 나사 */
  private buttHolder(x: number, z: number, h: number, yaw: number) {
    const part = (px: number, py: number, pz: number, w: number, ht: number, d: number, color: string) => this.restPart(x, z, yaw, px, py, pz, w, ht, d, color);
    part(0, 0.015, 0, 0.1, 0.03, 0.1, ALU_DARK);
    part(0, h / 2, 0, 0.04, h, 0.04, ALU);
    part(0, h * 0.5, 0, 0.06, 0.03, 0.06, '#c9a24a');
    // 집게 바닥과 양쪽 벽 (대 방향으로 길게), 안쪽 고무
    part(0, h, 0, 0.13, 0.025, 0.2, ALU_DARK);
    part(0, h + 0.016, 0, 0.08, 0.01, 0.18, RUBBER);
    for (const sx of [-0.058, 0.058]) part(sx, h + 0.045, 0, 0.018, 0.075, 0.2, ALU);
    part(0.085, h + 0.045, 0, 0.035, 0.035, 0.035, '#b23a2e');
    part(0.11, h + 0.045, 0, 0.02, 0.06, 0.02, '#8a2a20');
  }

  // ── 건물 ─────────────────────────────────

  /**
   * 판벽 건물 몸통: 어두운 속 위로 가로 판벽 띠를 두 톤으로 번갈아 붙여 이음매가 보이게 하고,
   * 모서리 기둥·밑단·윗단을 두른다.
   */
  private walls(x: number, z: number, W: number, D: number, H: number, wallA: string, wallB: string) {
    this.solid(x, DECK_Y + H / 2, z, W, H, D, this.shade(wallB, -0.22));
    let i = 0;
    for (let y = 0.14; y < H - 0.05; y += 0.28, i++) {
      const h = Math.min(0.25, H - y - 0.02);
      this.solid(x, DECK_Y + y + h / 2, z, W + 0.04, h, D + 0.04, this.jitter(i % 2 ? wallA : wallB, 0.015));
    }
    for (const dx of [-W / 2, W / 2]) for (const dz of [-D / 2, D / 2]) this.solid(x + dx, DECK_Y + H / 2, z + dz, 0.16, H, 0.16, TRIM);
    this.solid(x, DECK_Y + 0.07, z, W + 0.14, 0.14, D + 0.14, DARK_WOOD);
    this.solid(x, DECK_Y + H - 0.04, z, W + 0.12, 0.1, D + 0.12, TRIM);
  }

  /** 계단식 박공지붕: 처마를 내밀고 용마루로 갈수록 좁아진다. ridge는 용마루 방향 */
  private gableRoof(x: number, z: number, W: number, D: number, baseY: number, ridge: Axis, color: string) {
    const layers = 6, h = 0.15;
    const across = ridge === 'x' ? D : W;
    // 처마 밑 판 (어두운 띠)
    this.solid(x, baseY + 0.03, z, W, 0.06, D, this.shade(color, -0.2));
    for (let k = 0; k < layers; k++) {
      const a = across * (1 - k / (layers + 0.4));
      const col = this.jitter(k % 2 ? color : this.shade(color, -0.05).getStyle(), 0.01);
      const y = baseY + 0.06 + h / 2 + k * h;
      if (ridge === 'x') this.solid(x, y, z, W, h, a, col);
      else this.solid(x, y, z, a, h, D, col);
    }
    // 용마루
    const top = baseY + 0.06 + layers * h + 0.05;
    if (ridge === 'x') this.solid(x, top, z, W + 0.08, 0.1, 0.3, this.shade(color, -0.12));
    else this.solid(x, top, z, 0.3, 0.1, D + 0.08, this.shade(color, -0.12));
  }

  /** 창: 틀·유리·십자 창살·창턱 */
  private window(cx: number, cy: number, cz: number, axis: Axis, dir: number, w: number, h: number) {
    this.onWall(cx, cy, cz, axis, dir, 0.04, w + 0.18, h + 0.18, 0.06, TRIM);
    this.onWall(cx, cy, cz, axis, dir, 0.08, w, h, 0.03, GLASS);
    this.onWall(cx, cy, cz, axis, dir, 0.1, 0.05, h, 0.03, TRIM);
    this.onWall(cx, cy, cz, axis, dir, 0.1, w, 0.05, 0.03, TRIM);
    this.onWall(cx, cy - h / 2 - 0.1, cz, axis, dir, 0.11, w + 0.3, 0.06, 0.16, DARK_WOOD);
  }

  /** 문: 틀·세로 판문·손잡이·디딤판 */
  private door(cx: number, cz: number, axis: Axis, dir: number, w = 1, h = 2) {
    this.onWall(cx, DECK_Y + h / 2 + 0.05, cz, axis, dir, 0.04, w + 0.16, h + 0.1, 0.06, TRIM);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const o = -w / 2 + (i + 0.5) * (w / n);
      const px = axis === 'z' ? cx + o : cx, pz = axis === 'x' ? cz + o : cz;
      this.onWall(px, DECK_Y + h / 2, pz, axis, dir, 0.08, w / n - 0.02, h - 0.06, 0.04, i % 2 ? '#7c6346' : '#876c4d');
    }
    const kx = axis === 'z' ? cx + w * 0.32 : cx, kz = axis === 'x' ? cz + w * 0.32 : cz;
    this.onWall(kx, DECK_Y + h * 0.48, kz, axis, dir, 0.12, 0.07, 0.07, 0.05, '#d8b34a');
    this.onWall(cx, DECK_Y + 0.04, cz, axis, dir, 0.32, w + 0.4, 0.08, 0.56, '#7a6448');
  }

  /** 구명환: 주황·흰 띠가 번갈아 도는 고리 */
  private lifebuoy(cx: number, cy: number, cz: number, axis: Axis, dir: number) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = 0.22;
      const u = Math.cos(a) * r, v = Math.sin(a) * r;
      const px = axis === 'z' ? cx + u : cx, pz = axis === 'x' ? cz + u : cz;
      this.onWall(px, cy + v, pz, axis, dir, 0.06, 0.12, 0.12, 0.08, k % 3 === 0 ? '#f2eee4' : '#e0632e');
    }
  }

  /** 좌대 쉼터 한 채: 판벽·문·창·박공지붕·연통·등·번호판 */
  private cabin(x: number, z: number, side: number, id: number) {
    const W = 3.5, D = 3, H = 2.35, roof = ACTIVE_FISHERY.platforms.roof;
    this.walls(x, z, W, D, H, '#ebdfbd', '#dfd2ad');
    // 앞(-z, 낚시하는 쪽)에 문, 가운데 다리 쪽 벽에 큰 창, 뒤에 작은 창
    this.door(x - side * 0.6, z - D / 2, 'z', -1, 1, 1.9);
    this.window(x + side * 0.85, DECK_Y + 1.45, z - D / 2, 'z', -1, 0.7, 0.6);
    this.window(x - side * W / 2, DECK_Y + 1.45, z, 'x', -side, 1.5, 0.9);
    this.window(x, DECK_Y + 1.5, z + D / 2, 'z', 1, 0.8, 0.55);
    this.lifebuoy(x + side * W / 2, DECK_Y + 1.35, z, 'x', side);
    this.gableRoof(x, z, W + 0.55, D + 0.7, DECK_Y + H, 'x', roof);
    // 연통과 문 옆 등
    this.solid(x + side * 0.9, DECK_Y + H + 1.05, z + 0.55, 0.16, 0.9, 0.16, '#3f4446');
    this.solid(x + side * 0.9, DECK_Y + H + 1.52, z + 0.55, 0.26, 0.06, 0.26, '#2f3436');
    this.solid(x - side * 0.6 + side * 0.72, DECK_Y + 2.15, z - D / 2 - 0.08, 0.08, 0.16, 0.12, TRIM);
    this.lamp(x - side * 0.6 + side * 0.72, DECK_Y + 2.0, z - D / 2 - 0.14, 0.16);
    // 옆 가스통·물통
    this.solid(x + side * (W / 2 + 0.3), DECK_Y + 0.35, z + 0.9, 0.36, 0.7, 0.36, '#c9cfcc');
    this.solid(x + side * (W / 2 + 0.3), DECK_Y + 0.74, z + 0.9, 0.16, 0.08, 0.16, '#5a6164');
    this.solid(x + side * (W / 2 + 0.3), DECK_Y + 0.25, z - 0.2, 0.42, 0.5, 0.42, '#3d6b8a');
    // 번호판 (문 위)
    this.sign(String(id).padStart(2, '0'), x - side * 0.6, DECK_Y + 2.17, z - D / 2 - 0.09, Math.PI, 0.7, 0.32, '#274c43', 128);
  }

  /** 글자 간판: 캔버스에 그려 판에 붙인다 (뒤에 나무 테두리) */
  private sign(text: string, x: number, y: number, z: number, ry: number, w: number, h: number, bg: string, px = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = Math.round(px * h / w);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#00000040'; ctx.lineWidth = canvas.height * 0.08; ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f6ecd0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(canvas.height * 0.62)}px 'Pretendard Variable', Pretendard, sans-serif`;
    ctx.fillText(text, canvas.width / 2, canvas.height * 0.54);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    plane.position.set(x, y, z);
    plane.rotation.y = ry;
    this.group.add(plane);
    // 테두리: 판 뒤에 조금 큰 나무판
    const bx = -Math.sin(ry) * 0.03, bz = -Math.cos(ry) * 0.03;
    const across = Math.abs(Math.sin(ry)) > 0.5;
    this.solid(x + bx, y, z + bz, across ? 0.05 : w + 0.12, h + 0.12, across ? w + 0.12 : 0.05, DARK_WOOD);
  }

  /**
   * 관리동 가게 한 채: 판벽 건물, 진열창 안 선반과 물건, 계산대, 줄무늬 차양, 지붕 위 간판
   * @param face 계산대가 향하는 쪽 (+1 오른쪽, -1 왼쪽)
   */
  private stall(id: Stall['id'], name: string, x: number, z: number, face: number, roof: string) {
    const W = 3.2, D = 4.6, H = 2.5;
    this.walls(x, z, W, D, H, '#efe3c2', '#e2d4ae');
    const fx = x + face * W / 2;
    // 진열창: 어두운 가게 안, 선반 세 단, 선반 위 물건
    this.onWall(fx, DECK_Y + 1.45, z, 'x', face, 0.03, 3.6, 1.7, 0.03, TRIM);
    this.onWall(fx, DECK_Y + 1.45, z, 'x', face, 0.05, 3.4, 1.5, 0.03, '#33291f');
    const goods = id === 'shop'
      ? ['#c8402f', '#3f6b8a', '#e7c25a', '#6f9443', '#efe6cf', '#8a5a9a', '#d98a3a', '#4a8a8a']
      : ['#c9d4d8', '#b8c4c9', '#d8a35a', '#e8eef0', '#9fb2ba', '#c9a46a', '#dfe7ea', '#a8b8be'];
    for (const [k, sy] of [0.95, 1.45, 1.95].entries()) {
      this.onWall(fx, DECK_Y + sy - 0.2, z, 'x', face, 0.09, 3.3, 0.05, 0.12, '#a07a4f');
      for (let i = 0; i < 7; i++) {
        if (this.rnd() < 0.15) continue;
        const gz = z - 1.4 + i * 0.47 + (this.rnd() - 0.5) * 0.1;
        const h = id === 'shop' ? 0.18 + this.rnd() * 0.16 : 0.1 + this.rnd() * 0.06;
        const col = goods[(i + k * 3) % goods.length];
        this.onWall(fx, DECK_Y + sy - 0.17 + h / 2, gz, 'x', face, 0.1, 0.24 + this.rnd() * 0.12, h, 0.14, this.jitter(col, 0.04));
      }
    }
    // 계산대: 앞판은 세로 판재, 위는 밝은 나무 상판
    const cx = x + face * 1.95;
    this.solid(cx, DECK_Y + 0.5, z, 0.6, 1, 3.2, '#7d5f3d');
    for (let i = 0; i < 8; i++) this.solid(cx + face * 0.31, DECK_Y + 0.5, z - 1.4 + i * 0.4, 0.04, 0.92, 0.36, this.jitter(i % 2 ? '#8e6d47' : '#97754d', 0.02));
    this.solid(cx, DECK_Y + 1.04, z, 0.78, 0.08, 3.4, '#c99c64');
    // 줄무늬 차양: 벽에서 앞으로 기울어진 세 단, 끝에 물결 술
    const stripes = 9;
    for (let s = 0; s < stripes; s++) {
      const col = s % 2 ? roof : '#f1ead6';
      const sz = z - 2 + (s + 0.5) * (4 / stripes);
      for (let r = 0; r < 3; r++) this.solid(x + face * (1.78 + r * 0.32), DECK_Y + 2.42 - r * 0.12, sz, 0.34, 0.07, 4 / stripes, col);
      this.solid(x + face * 2.6, DECK_Y + 2.12, sz, 0.04, s % 2 ? 0.2 : 0.14, 4 / stripes - 0.02, col);
    }
    for (const dz of [-1.75, 1.75]) this.solid(x + face * 2.6, DECK_Y + 1.06, z + dz, 0.09, 2.12, 0.09, DARK_WOOD);
    this.lamp(x + face * 2.2, DECK_Y + 2.05, z, 0.2);
    this.solid(x + face * 2.2, DECK_Y + 2.25, z, 0.03, 0.22, 0.03, '#2f3436');
    // 지붕 (용마루는 건물 긴 쪽), 지붕 앞 간판
    this.gableRoof(x, z, W + 0.5, D + 0.5, DECK_Y + H, 'z', roof);
    const signX = x + face * (W / 2 + 0.32);
    this.sign(name, signX, DECK_Y + H + 0.5, z, face > 0 ? Math.PI / 2 : -Math.PI / 2, 2.6, 0.7, roof);
    for (const dz of [-1, 1]) this.solid(signX - face * 0.06, DECK_Y + H + 0.2, z + dz, 0.06, 0.4, 0.06, DARK_WOOD);
    // 가게마다 앞마당 소품
    if (id === 'shop') {
      // 낚싯대 거치대에 세운 민장대들, 미끼 냉장고
      const rx = x + face * 1.7, rz = z + 2.55;
      this.solid(rx, DECK_Y + 0.08, rz, 1.4, 0.06, 0.3, DARK_WOOD);
      this.solid(rx, DECK_Y + 1.1, rz + 0.12, 1.4, 0.06, 0.06, DARK_WOOD);
      for (let i = 0; i < 6; i++) this.solid(rx - 0.6 + i * 0.24, DECK_Y + 1.3, rz + 0.05, 0.04, 2.5, 0.04, ['#c8a060', '#3a4542', '#5a7fb5', '#b5862e', '#2a2a33', '#7a8b4a'][i]);
      this.solid(x + face * 1.6, DECK_Y + 0.35, z - 2.6, 0.9, 0.7, 0.55, '#eef2f2');
      this.solid(x + face * 1.6, DECK_Y + 0.72, z - 2.6, 0.94, 0.08, 0.58, '#3f6b8a');
    } else {
      // 얼음 상자에 담긴 고기, 저울, 물통
      for (const [k, dz] of [-2.6, 2.6].entries()) {
        const bx = x + face * 1.55, bz = z + dz;
        this.solid(bx, DECK_Y + 0.25, bz, 0.9, 0.5, 0.6, '#3f6b8a');
        this.solid(bx, DECK_Y + 0.5, bz, 0.82, 0.04, 0.52, '#e8f2f4');
        for (let i = 0; i < 3; i++) this.solid(bx - 0.25 + i * 0.25, DECK_Y + 0.55, bz + (k ? 0.05 : -0.05), 0.12, 0.07, 0.42, ['#b9a35a', '#9aa7ab', '#a88a52'][i]);
      }
      this.solid(cx, DECK_Y + 1.14, z - 1.1, 0.3, 0.12, 0.3, '#cfd5d6');
      this.solid(cx, DECK_Y + 1.22, z - 1.1, 0.36, 0.03, 0.36, '#9aa3a6');
    }
    this.blocks.push({ x: x + face * 0.15, z, hw: 1.95, hd: 2.5 });
    this.stalls.push({ id, name, x: x + face * 2.7, z });
  }

  /** 관리동 마당: 가로등, 벤치, 화분, 물가 난간 */
  private plaza(oz: number) {
    for (const dx of [-7.6, 7.6]) for (const dz of [-3.2, 3.2]) this.lampPost(dx, oz + dz, 2.4);
    for (const dx of [-2.3, 2.3]) this.bench(dx, oz + 3.0);
    for (const dx of [-2.5, 2.5]) {
      this.solid(dx, DECK_Y + 0.25, oz - 2.9, 0.7, 0.5, 0.7, '#7a5a3a');
      this.solid(dx, DECK_Y + 0.52, oz - 2.9, 0.62, 0.06, 0.62, '#3a2e22');
      for (let k = 0; k < 5; k++) this.solid(dx + (this.rnd() - 0.5) * 0.4, DECK_Y + 0.7 + this.rnd() * 0.25, oz - 2.9 + (this.rnd() - 0.5) * 0.4, 0.32, 0.32, 0.32, this.jitter('#5d8a43', 0.06));
    }
    // 물가 난간: 앞쪽(+z) 전체, 다리 쪽(-z)은 가운데 입구를 비운다
    this.rail(-7.9, 7.9, oz + 3.4, 'x');
    this.rail(-7.9, -1.7, oz - 3.4, 'x');
    this.rail(1.7, 7.9, oz - 3.4, 'x');
  }

  private bench(x: number, z: number) {
    for (const dx of [-0.6, 0.6]) this.solid(x + dx, DECK_Y + 0.22, z, 0.08, 0.44, 0.42, DARK_WOOD);
    for (let i = 0; i < 3; i++) this.solid(x, DECK_Y + 0.46, z - 0.15 + i * 0.15, 1.4, 0.05, 0.13, this.jitter('#a07a4f', 0.03));
    for (let i = 0; i < 2; i++) this.solid(x, DECK_Y + 0.7 + i * 0.16, z + 0.22, 1.4, 0.1, 0.05, this.jitter('#a07a4f', 0.03));
  }

  private lampPost(x: number, z: number, h: number) {
    this.solid(x, DECK_Y + 0.06, z, 0.24, 0.12, 0.24, '#2f3436');
    this.solid(x, DECK_Y + h / 2, z, 0.09, h, 0.09, '#3f4446');
    this.solid(x, DECK_Y + h + 0.2, z, 0.34, 0.06, 0.34, '#2f3436');
    this.lamp(x, DECK_Y + h + 0.05, z, 0.24);
  }

  /** 난간: 기둥과 위·중간 가로대. axis 방향으로 a~b 구간 */
  private rail(a: number, b: number, at: number, axis: Axis) {
    const len = b - a, mid = (a + b) / 2, n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) {
      const p = a + (len * i) / n;
      if (axis === 'x') this.solid(p, DECK_Y + 0.45, at, 0.1, 0.9, 0.1, DARK_WOOD);
      else this.solid(at, DECK_Y + 0.45, p, 0.1, 0.9, 0.1, DARK_WOOD);
    }
    for (const [y, t] of [[0.88, 0.08], [0.5, 0.05]]) {
      if (axis === 'x') this.solid(mid, DECK_Y + y, at, len, t, 0.07, this.shade(DARK_WOOD, 0.08));
      else this.solid(at, DECK_Y + y, mid, 0.07, t, len, this.shade(DARK_WOOD, 0.08));
    }
  }

  /** 가운데 다리 양옆 낮은 밧줄 난간: 연결 다리와 관리동 입구는 비운다 */
  private bridgeRails(top: number, end: number, oz: number, joints: number[]) {
    const open = (z: number) => joints.some(j => Math.abs(z - j) < 1.5) || (z > oz - 4 && z < oz + 4) || z > top - 1;
    for (const sx of [-1.3, 1.3]) {
      let prev: number | null = null;
      for (let z = end + 0.5; z < top; z += 2.5) {
        if (open(z)) { prev = null; continue; }
        this.solid(sx, DECK_Y + 0.32, z, 0.1, 0.64, 0.1, DARK_WOOD);
        if (prev !== null) this.solid(sx, DECK_Y + 0.58, (z + prev) / 2, 0.035, 0.035, z - prev, '#c6b48a');
        prev = z;
      }
    }
  }

  /** 금빛 양어장 파라솔 */
  private parasol(x: number, z: number, color: string) {
    this.solid(x, DECK_Y + 1.25, z, 0.09, 2.5, 0.09, '#6c6147');
    this.solid(x, DECK_Y + 2.55, z, 2.7, 0.15, 2.7, color);
    this.solid(x, DECK_Y + 2.72, z, 1.8, 0.18, 1.8, '#eee2b5');
    this.solid(x, DECK_Y + 2.86, z, 0.8, 0.12, 0.8, color);
  }

  /** 해 질수록 등이 켜진다 (0 낮 ~ 1 밤) */
  setLights(dark: number) {
    this.lampMat.emissiveIntensity = 0.05 + dark * 1.5;
  }

  // ── 판정 ─────────────────────────────────

  /** 가게 계산대 앞에 서 있으면 그 가게 */
  nearStall(x: number, z: number): Stall | null {
    return this.stalls.find(s => Math.hypot(x - s.x, z - s.z) < 2.2) ?? null;
  }

  surfaceAt(x: number, z: number): number | null {
    return this.decks.some(d => Math.abs(x - d.x) <= d.w / 2 - 0.16 && Math.abs(z - d.z) <= d.d / 2 - 0.16) ? DECK_Y : null;
  }

  canWalk(x: number, z: number): boolean {
    if (this.surfaceAt(x, z) === null) return false;
    if (this.blocks.some(b => Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd)) return false;
    return !this.platforms.some(p => {
      const side = p.x < 0 ? -1 : 1;
      return Math.abs(x - (p.x + side * 2.1)) < 1.95 && Math.abs(z - (p.z + 2.8)) < 1.7;
    });
  }

  nearestSlot(x: number, z: number): RodSlot | null {
    let best: RodSlot | null = null;
    let distance = 2.15;
    for (const slot of this.slots) {
      const d = Math.hypot(x - slot.x, z - slot.z);
      if (d < distance) { best = slot; distance = d; }
    }
    return best;
  }

  /** 지금 좌대에서 가장 가까운 받침틀 자리 */
  nearestSeat(x: number, z: number): Seat | null {
    const p = this.current(x, z);
    if (!p) return null;
    return p.seats.reduce((a, b) => Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a);
  }

  current(x: number, z: number): Platform | undefined {
    return this.platforms.find(p => Math.abs(x - p.x) < 5 && Math.abs(z - p.z) < 5);
  }
  /** 그 대가 놓인 받침틀 앞에 있는지 (옆 자리 받침틀의 대는 닿지 않는다) */
  canReachSlot(x: number, z: number, slot: RodSlot): boolean {
    return Math.hypot(x - slot.x, z - slot.z) <= 2.8;
  }
}

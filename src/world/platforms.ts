import * as THREE from 'three';
import { PLAYER, SHORE_Z } from './lake';
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
  /** 받침틀에서 이 대가 향하는 방향 (라디안, +면 왼쪽): 세 대를 부채꼴로 편다 */
  yaw: number;
  marker: THREE.Mesh;
}
export interface Platform { id: number; x: number; z: number; name: string; slots: RodSlot[] }
/** 관리동 가게: 낚시점(장비·미끼 구매), 어시장(물고기 판매) */
export interface Stall { id: 'shop' | 'market'; name: string; x: number; z: number }
type Deck = { x: number; z: number; w: number; d: number };

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

  constructor() {
    this.group.name = `${ACTIVE_FISHERY.name} 좌대 낚시터`;
    const config = ACTIVE_FISHERY.platforms;
    const firstZ = SHORE_Z - 22;
    this.deck(0, firstZ - config.spacing * 1.5, 2.8, config.spacing * 3 + 45);
    for (let row = 0; row < 4; row++) {
      for (const side of [-1, 1]) {
        const id = this.platforms.length + 1;
        const x = side * config.gap;
        const z = firstZ - row * config.spacing;
        this.deck(side * config.gap / 2, z + 2, config.gap, 2.2);
        this.deck(x, z, 10, 10);
        // 물에 뜬 검은 부력통과 가장자리 목재 테두리.
        for (const dx of [-3.5, 3.5]) this.box(x + dx, 0.13, z, 1.3, 0.8, 8.8, '#293f40');
        for (const dx of [-4.9, 4.9]) this.box(x + dx, DECK_Y + 0.07, z, 0.2, 0.24, 10, '#524231');
        this.cabin(x + side * 2.1, z + 2.8, side, id);
        // 받침틀 뒤 가운데 의자 하나, 살림망 상자, 좌대 번호판.
        this.box(x, DECK_Y + 0.38, z - 2.9, 0.65, 0.15, 0.65, '#718f75');
        this.box(x, DECK_Y + 0.72, z - 2.56, 0.65, 0.62, 0.12, '#718f75');
        for (const lx of [-0.23, 0.23]) this.box(x + lx, DECK_Y + 0.17, z - 2.9, 0.1, 0.35, 0.55, '#384b45');
        this.box(x - side * 3.4, DECK_Y + 0.22, z + 2.6, 1.05, 0.44, 0.65, '#d2c7a1');
        const names = config.names;
        const p: Platform = { id, x, z, name: `${String(id).padStart(2, '0')}번 ${names[id - 1]} 좌대`, slots: [] };
        // 받침틀 하나: 뒤꽂이 가로대와 앞받침 가로대를 옆 틀로 잇고, 세 대를 부채꼴로 건다.
        // 좌대 앞끝(z - 5)에서 8cm만 안쪽. 뒤꽂이도 함께 물 쪽으로 옮긴다.
        const frontZ = z - 5 + 0.08, backZ = frontZ + 0.82;
        this.box(x, DECK_Y + 0.05, backZ, 1.3, 0.06, 0.08, '#40584f');
        this.box(x, DECK_Y + 0.05, frontZ, 2, 0.06, 0.08, '#40584f');
        for (const sx of [-1, 1]) {
          this.box(x + sx * 0.98, DECK_Y + 0.05, (backZ + frontZ) / 2, 0.08, 0.06, backZ - frontZ + 0.08, '#40584f');
          this.box(x + sx * 0.6, DECK_Y + 0.05, (backZ + frontZ) / 2, 0.06, 0.05, backZ - frontZ, '#40584f');
        }
        for (let i = 0; i < 3; i++) {
          const yaw = (1 - i) * 0.34;
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
          // 손잡이는 의자 앞에 모으고(0.4m 간격) 초릿대 쪽은 벌어진다
          const bx = x + (i - 1) * 0.4;
          const sx = bx + fx * 0.65, sz = backZ + fz * 0.65;
          const marker = this.box(sx + fx * 0.17, DECK_Y + 0.09, sz + fz * 0.17, 0.16, 0.03, 0.16, '#eac67d');
          marker.material = new THREE.MeshLambertMaterial({ color: '#eac67d', emissive: '#40351a' });
          // 뒤꽂이(손잡이 받침)와 낮은 앞받침: 초릿대는 물 쪽으로 내려간다.
          for (const [d, height] of [[-0.65, 0.23], [0.17, 0.14]]) this.rest(sx + fx * d, sz + fz * d, height, yaw);
          const slot: RodSlot = { id: `${id}-${i + 1}`, platform: id, number: i + 1, x: sx, z: sz, yaw, marker };
          p.slots.push(slot);
          this.slots.push(slot);
        }
        this.platforms.push(p);
        if (ACTIVE_FISHERY.id === 'gold') {
          const px = x - side * 2.7, pz = z + 1.4;
          this.box(px, DECK_Y + 1.25, pz, 0.09, 2.5, 0.09, '#6c6147');
          this.box(px, DECK_Y + 2.55, pz, 2.7, 0.15, 2.7, id % 2 ? '#bb7058' : '#c6ad58');
          this.box(px, DECK_Y + 2.72, pz, 1.8, 0.18, 1.8, '#eee2b5');
        }
        if (ACTIVE_FISHERY.id === 'moon') {
          const lamp = this.box(x + side * 3.8, DECK_Y + 1.15, z + 0.5, 0.28, 0.5, 0.28, '#ffd79b');
          lamp.material = new THREE.MeshLambertMaterial({ color: '#ffd79b', emissive: '#e1a757', emissiveIntensity: 0.8 });
          this.box(x + side * 3.8, DECK_Y + 0.48, z + 0.5, 0.08, 0.95, 0.08, '#494e58');
        }
      }
    }
    // 관리동: 다리가 시작되는 물가의 수상 마당. 다리에서 들어오면 왼쪽 낚시점, 오른쪽 어시장
    const oz = this.office.z;
    this.deck(0, oz, 16, 7);
    for (const dx of [-6.5, 6.5]) this.box(dx, 0.13, oz, 1.3, 0.8, 6.4, '#293f40');
    this.stall('shop', '낚시점', -5.4, oz, 1, '#3f6b8a');
    this.stall('market', '어시장', 5.4, oz, -1, '#8a4b3f');
    // 첫 좌대에서 시작한다. 앞에는 설치 자리, 뒤에는 다리 입구.
    PLAYER.x = this.platforms[0].x;
    PLAYER.z = this.platforms[0].z - FISHING_POSITION_OFFSET;
  }

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

  /** 받침대 머리: 기둥 위 U자 받침을 대가 놓이는 방향으로 돌린다 */
  private rest(x: number, z: number, height: number, yaw: number) {
    const head = new THREE.Group();
    head.position.set(x, DECK_Y, z);
    head.rotation.y = yaw;
    const parts: [number, number, number, number, number][] = [[0, height / 2, 0.07, height, 0.07], [0, height, 0.22, 0.04, 0.09], [-0.1, height + 0.04, 0.035, 0.08, 0.07], [0.1, height + 0.04, 0.035, 0.08, 0.07]];
    for (const [px, py, w, h, d] of parts) {
      const mesh = this.box(0, 0, 0, w, h, d, '#40584f');
      mesh.position.set(px, py, 0);
      head.add(mesh);
    }
    this.group.add(head);
  }

  /**
   * 관리동 가게 한 채: 건물, 마당 쪽 계산대, 간판
   * @param face 계산대가 향하는 쪽 (+1 오른쪽, -1 왼쪽)
   */
  private stall(id: Stall['id'], name: string, x: number, z: number, face: number, roof: string) {
    this.box(x, DECK_Y + 1.3, z, 3.2, 2.6, 4.6, '#e6d8b4');
    this.box(x, DECK_Y + 2.7, z, 3.8, 0.22, 5.2, roof);
    // 계산대와 차양
    this.box(x + face * 1.95, DECK_Y + 0.5, z, 0.6, 1, 3, '#8a6a44');
    this.box(x + face * 2.1, DECK_Y + 2.15, z, 1.2, 0.08, 3.4, roof);
    for (const dz of [-1.6, 1.6]) this.box(x + face * 2.6, DECK_Y + 1.08, z + dz, 0.08, 2.15, 0.08, '#6c5c43');
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = roof; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#f6ecd0'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(name, 128, 46);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(x + face * 1.62, DECK_Y + 2.35, z);
    sign.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.group.add(sign);
    this.blocks.push({ x: x + face * 0.15, z, hw: 1.95, hd: 2.5 });
    this.stalls.push({ id, name, x: x + face * 2.7, z });
  }

  /** 가게 계산대 앞에 서 있으면 그 가게 */
  nearStall(x: number, z: number): Stall | null {
    return this.stalls.find(s => Math.hypot(x - s.x, z - s.z) < 2.2) ?? null;
  }

  private deck(x: number, z: number, w: number, d: number) {
    this.decks.push({ x, z, w, d });
    const count = Math.ceil(d / 0.48);
    for (let i = 0; i < count; i++) {
      this.box(x, DECK_Y - 0.14, z - d / 2 + (i + 0.5) * d / count, w, 0.28, d / count - 0.018,
        ACTIVE_FISHERY.platforms.wood);
    }
  }

  private cabin(x: number, z: number, side: number, id: number) {
    this.box(x, DECK_Y + 1.25, z, 3.5, 2.5, 3, '#e6d8b4');
    // 평평한 지붕과 작은 단차도 모두 상자로 만든다.
    this.box(x, DECK_Y + 2.62, z, 4.1, 0.24, 3.7, ACTIVE_FISHERY.platforms.roof);
    this.box(x, DECK_Y + 2.8, z + 0.4, 3.6, 0.16, 2.5, ACTIVE_FISHERY.platforms.roof);
    this.box(x, DECK_Y + 1.22, z - 1.51, 1.1, 2.35, 0.035, '#6c5c43');
    this.box(x - side * 1.76, DECK_Y + 1.5, z, 0.035, 0.95, 1.65, '#638e99');
    this.box(x - side * 1.79, DECK_Y + 1.5, z, 0.045, 0.06, 1.7, '#dfd3ae');
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#274c43'; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#f3e4be'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(id).padStart(2, '0'), 64, 46);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.43), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(x, DECK_Y + 2.05, z - 1.535);
    sign.rotation.y = Math.PI;
    this.group.add(sign);
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

  current(x: number, z: number): Platform | undefined {
    return this.platforms.find(p => Math.abs(x - p.x) < 5 && Math.abs(z - p.z) < 5);
  }
  canReachSlot(x: number, z: number, slot: RodSlot): boolean {
    return this.current(x, z)?.id === slot.platform || Math.hypot(x - slot.x, z - slot.z) <= 2.8;
  }
}

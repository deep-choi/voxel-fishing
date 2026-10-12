import { fbm, noise2, ridged, smoothstep } from './noise';
import { ACTIVE_FISHERY } from '../game/fisheries';

// 저수지 지형. 수면 높이는 0. 높이 함수 하나로 지형 메시, 수심, 물고기 서식 판정을 모두 낸다.

export const WATER_Y = 0;

const CONFIG = ACTIVE_FISHERY.terrain;
const CX = CONFIG.cx;
const CZ = CONFIG.cz;
const RX = CONFIG.rx;
const RZ = CONFIG.rz;
const ISLANDS = [[-105, CZ + 30], [115, CZ - 30], [-70, CZ - 90]];
/** 정규화 거리 1 ≈ 몇 m인지 (기슭에서 떨어진 거리 근사용) */
const METERS = 270;

function wobble(a: number): number {
  return (
    1 +
    0.1 * Math.sin(3 * a + 1.3) +
    0.06 * Math.sin(5 * a + 0.4) +
    0.04 * Math.sin(9 * a + 2.1) +
    0.06 * noise2(Math.cos(a) * 1.7 + 5, Math.sin(a) * 1.7 + 5, CONFIG.seed)
  );
}

/** 저수지 중심에서의 정규화 거리. 1이 물가 */
export function lakeQ(x: number, z: number): number {
  const dx = (x - CX) / RX;
  const dz = (z - CZ) / RZ;
  if (CONFIG.shape === 'pond') return Math.pow(Math.pow(Math.abs(dx), 6) + Math.pow(Math.abs(dz), 6), 1 / 6);
  return Math.hypot(dx, dz) / wobble(Math.atan2(dz, dx));
}

/** 물가에서 떨어진 거리 (m). 물속은 음수 */
export function shoreDistance(x: number, z: number): number {
  return (lakeQ(x, z) - 1) * METERS;
}

// 플레이어 자리: 저수지 남쪽 기슭(+z 쪽), 물가에서 3m 뒤
function findShoreZ(x: number): number {
  let lo = CZ;
  let hi = CZ + RZ * 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (lakeQ(x, mid) < 1) lo = mid;
    else hi = mid;
  }
  return lo;
}
export const SHORE_Z = findShoreZ(0);
/** 처음 앉는 낚시 자리 (지형을 평평하게 다진 곳, 고정) */
export const SEAT = { x: 0, z: SHORE_Z + 3.2 } as const;
/** 플레이어 현재 위치 (걸어 다니면 바뀐다) */
export const PLAYER: { x: number; z: number } = { x: SEAT.x, z: SEAT.z };
const PLAYER_GROUND = 0.62;

function rawHeight(x: number, z: number): number {
  const s = shoreDistance(x, z);
  if (s < 0) {
    // 물속: 기슭은 완만하다가 점점 깊어진다 (가운데 7m 안팎)
    const d0 = -s;
    let d = CONFIG.maxDepth * (1 - Math.exp(-d0 / CONFIG.slope));
    // 바닥의 둔덕과 골자리 (기본 수심의 30% 안쪽으로만)
    d += fbm(x / 26, z / 26, 3, CONFIG.seed + 4) * Math.min(1.3, d * 0.3);
    // 앞쪽은 붕어용 얕은 턱, 안쪽은 잉어·향어용 깊은 포인트.
    const { gap, spacing, depths } = ACTIVE_FISHERY.platforms;
    const dx = Math.min(Math.abs(x - gap), Math.abs(x + gap));
    for (let row = 0; row < 4; row++) {
      const dz = Math.abs(z - (SHORE_Z - 34 - row * spacing));
      const blend = (1 - smoothstep(8, 15, dx)) * (1 - smoothstep(9, 15, dz));
      d += (depths[row] - d) * blend;
    }
    d = Math.max(0.15, d) * smoothstep(0, 2.2, d0);
    if (CONFIG.shape === 'marsh') {
      // 좌대에서 떨어진 작은 섬. 실제 수심과 보행 판정에도 같은 높이를 사용한다.
      let island = 0;
      for (const [ix, iz] of ISLANDS) island = Math.max(island, 1 - smoothstep(10, 23, Math.hypot(x - ix, z - iz)));
      return -d + (d + 1.1) * island;
    }
    return -d;
  }
  let h = 1.0 * smoothstep(0, 6, s) + 0.25 * fbm(x / 5, z / 5, 2, 3) * smoothstep(1, 5, s);
  // 저수지를 둘러싼 야트막한 산
  h += CONFIG.mountain * 48 * smoothstep(8, 170, s) * (0.55 + 0.45 * fbm(x / 95, z / 95, 4, CONFIG.seed + 8));
  h += CONFIG.mountain * 14 * fbm(x / 38, z / 38, 3, CONFIG.seed + 2) * smoothstep(15, 110, s);
  if (CONFIG.shape === 'mountain') h += 25 * smoothstep(3, 18, s) * (1 - smoothstep(40, 95, s));
  if (CONFIG.shape === 'pond') h = 1.8 + 0.7 * smoothstep(0, 4, s) + Math.max(0, h - 2) * 0.35;
  // 멀리 겹겹이 이어지는 능선
  h += CONFIG.mountain * 230 * smoothstep(240, 950, s) * (0.35 + 0.65 * ridged(x / 380, z / 380, 5, CONFIG.seed + 18));
  return h;
}

/** 지형 높이 (m) */
export function heightAt(x: number, z: number): number {
  const h = rawHeight(x, z);
  // 낚시 자리는 평평하게 다진다
  const pd = Math.hypot(x - SEAT.x, z - SEAT.z);
  if (pd < 6) {
    // 물가 쪽으로는 자연스럽게 이어지도록, 기슭 거리로도 부드럽게 섞는다
    const t = smoothstep(6, 2.5, pd) * smoothstep(0.3, 2.2, shoreDistance(x, z));
    return h + (PLAYER_GROUND - h) * t;
  }
  return h;
}

/** 수심 (m). 물이 아니면 0 */
export function waterDepth(x: number, z: number): number {
  return Math.max(0, WATER_Y - heightAt(x, z));
}

/** 물고기가 모이는 정도 (0 ~ 1). 종마다 다른 시드로 다른 자리를 좋아한다 */
export function spotQuality(x: number, z: number, seed: number): number {
  return 0.5 + 0.5 * fbm(x / 16, z / 16, 2, CONFIG.seed * 31 + seed);
}

/** 갈대가 자라는 자리인가 (얕은 물가, 뭉쳐서 자란다) */
export function reedDensity(x: number, z: number): number {
  const h = heightAt(x, z);
  if (h < -0.75 || h > 0.45) return 0;
  const clump = smoothstep(-0.05, 0.35, fbm(x / 9, z / 9, 3, 41));
  // 플레이어 앞은 낚시 자리라 비워 둔다
  const dx = x - SEAT.x;
  const dz = z - SEAT.z;
  if (dz < 2 && dz > -14 && Math.abs(dx) < 4.5 + -dz * 0.25) return 0;
  return Math.min(1, clump * ACTIVE_FISHERY.reeds);
}

export const LAKE_BOUNDS = { minX: CX - RX * 1.4, maxX: CX + RX * 1.4, minZ: CZ - RZ * 1.4, maxZ: CZ + RZ * 1.4 };

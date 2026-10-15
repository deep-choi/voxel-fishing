// 어떤 저장본을 쓸지 고르는 순수 규칙. Firebase·브라우저에 기대지 않아 스크립트로 검증할 수 있다.

/** savedAt: 마지막으로 저장한 시각(ms, 이 기기 시계) */
export interface StoredSave { savedAt: number; data: unknown }
export type SaveSource = 'cache' | 'server' | 'legacy' | 'none';
export interface SaveChoice {
  pick: StoredSave | null;
  source: SaveSource;
  /** 고른 저장본이 서버보다 새로워서 서버에 올려야 하는지 */
  pushToServer: boolean;
}

/** 진행 정도 비교용. 구버전 저장본 둘 중 더 많이 진행한 쪽을 고를 때만 쓴다 */
export const xpOf = (data: unknown) => {
  const xp = data && typeof data === 'object' ? (data as { xp?: unknown }).xp : 0;
  return typeof xp === 'number' && Number.isFinite(xp) ? xp : 0;
};
export const isSaveData = (data: unknown) => !!data && typeof data === 'object' && (data as { version?: unknown }).version === 1;

/**
 * · 이 기기의 계정별 캐시와 서버 저장 중 더 늦게 저장한 쪽을 쓴다 (같으면 서버).
 * · 계정 구분이 없던 시절의 기기 저장(legacy)은 아직 어느 계정도 가져가지 않았을 때만 후보다.
 *   서버나 캐시에 저장이 없으면 그대로 이어받고, 있으면 더 많이 진행한 쪽(xp)을 쓴다.
 */
export function chooseSave(input: { cache: StoredSave | null; server: StoredSave | null; legacy: unknown | null; legacyClaimed: boolean }): SaveChoice {
  const { cache, server } = input;
  let pick: StoredSave | null = null;
  let source: SaveSource = 'none';
  if (cache && server) {
    if (cache.savedAt > server.savedAt) { pick = cache; source = 'cache'; } else { pick = server; source = 'server'; }
  } else if (server) { pick = server; source = 'server'; }
  else if (cache) { pick = cache; source = 'cache'; }

  if (isSaveData(input.legacy) && !input.legacyClaimed && (!pick || xpOf(input.legacy) > xpOf(pick.data))) {
    pick = { savedAt: Date.now(), data: input.legacy };
    source = 'legacy';
  }
  const pushToServer = !!pick && (source === 'legacy' || (source === 'cache' && (!server || pick.savedAt > server.savedAt)));
  return { pick, source, pushToServer };
}

interface CatchLike { cm?: unknown; species?: unknown; kept?: unknown; sold?: unknown; released?: unknown; rig?: unknown }
const keepnetFish = (c: CatchLike) => c.kept === true && c.sold !== true && c.released !== true;

/**
 * 서버 문서는 1MB 한도라 조과 기록이 쌓이면 줄여서 올린다 (기기에는 전부 남는다).
 * 1단계: 오래된 기록의 채비 정보를 뺀다. 2단계: 최근 기록과 어종별 최대어, 살림망 속 물고기만 남긴다.
 */
export function compactForServer<T extends { catches?: CatchLike[] }>(data: T, maxBytes: number): T {
  const copy = JSON.parse(JSON.stringify(data)) as T;
  const catches = copy.catches;
  if (!Array.isArray(catches)) return copy;
  const size = () => JSON.stringify(copy).length;
  if (size() <= maxBytes) return copy;
  for (let i = 0; i < catches.length - 200; i++) delete catches[i].rig;
  if (size() <= maxBytes) return copy;
  const best = new Map<unknown, CatchLike>();
  for (const c of catches) {
    const old = best.get(c.species);
    if (!old || Number(c.cm) > Number(old.cm)) best.set(c.species, c);
  }
  const recent = new Set(catches.slice(-600));
  copy.catches = catches.filter(c => recent.has(c) || keepnetFish(c) || [...best.values()].includes(c));
  return copy;
}

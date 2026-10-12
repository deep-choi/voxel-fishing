import type { BaitId, SpeciesId } from './data';

export type FisheryId = 'willow' | 'lotus' | 'moon' | 'gold';
export const DEFAULT_FISHERY_ID: FisheryId = 'willow';
/** firestore.rules의 입장 슬롯 범위(0~23)와 함께 변경한다. */
export const FISHERY_CAPACITY = 24;
/** 임시 개방 목록. 다른 맵의 지형·어종·저장 데이터는 그대로 보관한다. */
const OPEN_FISHERIES: readonly FisheryId[] = [DEFAULT_FISHERY_ID];
export const canEnterFishery = (id?: string | null) => OPEN_FISHERIES.some(open => open === id);
export interface Fishery {
  id: FisheryId; name: string; theme: string; desc: string; difficulty: string;
  targets: SpeciesId[]; recommendedBaits: BaitId[];
  /** 개체군 밀도. 0인 어종은 이 낚시터에 출현하지 않는다. */
  population: Record<SpeciesId, number>;
  sizeScale: number; startMinutes: number; temperature: number; weatherSeed: number;
  terrain: { cx: number; cz: number; rx: number; rz: number; seed: number; shape: 'lake' | 'marsh' | 'mountain' | 'pond'; maxDepth: number; slope: number; mountain: number };
  platforms: { gap: number; spacing: number; depths: [number, number, number, number]; names: string[]; roof: string; wood: string };
  palette: { grass: string; dirt: string; sand: string; mud: string; stone: string; forest: string; log: string; leaf: string; leafAutumn: string; deep: string; shallow: string; fog: string; accent: string };
  trees: number; reeds: number; wind: number; fogDensity: number;
}
export const FISHERIES: Fishery[] = [
  {
    id: 'willow', name: '버들못 저수지', theme: '가을 갈대밭 · 찌올림', difficulty: '입문',
    desc: '넓은 저수지와 버드나무. 얕은 턱에서 붕어를 만나고 안쪽 좌대에서 잉어를 노린다.',
    targets: ['crucian', 'carp', 'yellowcat'], recommendedBaits: ['gluten', 'paste', 'worm'],
    population: { crucian: 2.1, carp: 1, mirror: 0.35, bluegill: 0.45, catfish: 0.45, yellowcat: 1, snakehead: 0.18, mandarin: 0.12, bass: 0.35 },
    sizeScale: 1, startMinutes: 340, temperature: 18, weatherSeed: 0,
    terrain: { cx: 0, cz: -240, rx: 340, rz: 235, seed: 3, shape: 'lake', maxDepth: 6.8, slope: 24, mountain: 1 },
    platforms: { gap: 19, spacing: 27, depths: [2.1, 3.2, 4.4, 5.7], names: ['갈대밭', '버드나무', '수초밭', '황토턱', '골자리', '물골', '제방', '수문'], roof: '#527f70', wood: '#8e734d' },
    palette: { grass: '#89904a', dirt: '#7a5536', sand: '#c9b77c', mud: '#5d5040', stone: '#7d7d7d', forest: '#647338', log: '#6b4f2e', leaf: '#728445', leafAutumn: '#c8862a', deep: '#315a6a', shallow: '#718b74', fog: '#c4c7b9', accent: '#b4bd73' },
    trees: 0.85, reeds: 1.2, wind: 0.22, fogDensity: 0.0011,
  },
  {
    id: 'lotus', name: '연화 수초늪', theme: '연잎 · 초록 수초 · 잔챙이와 포식자', difficulty: '가벼운 탐색',
    desc: '작은 섬과 연잎이 흩어진 얕은 물. 글루텐은 붕어, 지렁이는 잔챙이, 새우는 가물치와 배스를 노린다.',
    targets: ['crucian', 'bluegill', 'snakehead', 'bass'], recommendedBaits: ['gluten', 'worm', 'shrimp'],
    population: { crucian: 1.4, carp: 0.5, mirror: 0, bluegill: 1.7, catfish: 0.3, yellowcat: 0.65, snakehead: 1.6, mandarin: 0.15, bass: 1.5 },
    sizeScale: 0.9, startMinutes: 480, temperature: 22, weatherSeed: 11,
    terrain: { cx: 0, cz: -210, rx: 285, rz: 210, seed: 41, shape: 'marsh', maxDepth: 3.5, slope: 32, mountain: 0.28 },
    platforms: { gap: 18, spacing: 22, depths: [1.1, 1.6, 2.3, 3.1], names: ['연꽃', '부들밭', '작은섬', '수초길', '버들그늘', '연잎골', '새우터', '가물치골'], roof: '#6d934c', wood: '#927a48' },
    palette: { grass: '#7eaf42', dirt: '#65533b', sand: '#bdba7c', mud: '#424d2e', stone: '#777f64', forest: '#457c32', log: '#65502d', leaf: '#3e913a', leafAutumn: '#9dbd47', deep: '#285744', shallow: '#659567', fog: '#cad9b1', accent: '#93bd65' },
    trees: 0.65, reeds: 1.5, wind: 0.14, fogDensity: 0.0008,
  },
  {
    id: 'moon', name: '달빛 산정호', theme: '깊은 물골 · 바위 절벽 · 밤낚시', difficulty: '대물 도전',
    desc: '소나무와 절벽 사이 깊은 호수. 밝힌 찌를 보며 메기와 쏘가리를 기다리는 조용한 밤낚시터.',
    targets: ['catfish', 'mandarin', 'carp', 'yellowcat'], recommendedBaits: ['shrimp', 'worm', 'corn'],
    population: { crucian: 0.45, carp: 1.1, mirror: 0.25, bluegill: 0.12, catfish: 2.1, yellowcat: 1.2, snakehead: 0.12, mandarin: 2.3, bass: 0.45 },
    sizeScale: 1.18, startMinutes: 1170, temperature: 16, weatherSeed: 23,
    terrain: { cx: 0, cz: -275, rx: 210, rz: 270, seed: 73, shape: 'mountain', maxDepth: 9, slope: 16, mountain: 1.65 },
    platforms: { gap: 24, spacing: 30, depths: [2.8, 4, 5.4, 6.5], names: ['달빛턱', '소나무', '바위골', '별빛', '메기굴', '깊은골', '쏘가리터', '절벽'], roof: '#52667d', wood: '#6d6972' },
    palette: { grass: '#58726d', dirt: '#64605b', sand: '#93998d', mud: '#404951', stone: '#8d9fa6', forest: '#365b52', log: '#525044', leaf: '#2c6757', leafAutumn: '#69806c', deep: '#152e51', shallow: '#477181', fog: '#8fa8c2', accent: '#8cb6db' },
    trees: 1.15, reeds: 0.35, wind: 0.3, fogDensity: 0.0015,
  },
  {
    id: 'gold', name: '금빛 양어장', theme: '정돈된 좌대 · 잉어·향어 · 묵직한 손맛', difficulty: '중급',
    desc: '반듯한 둑과 색색의 파라솔. 잉어와 향어가 많은 관리형 낚시터에서 어분·곡물떡밥으로 승부한다.',
    targets: ['mirror', 'carp', 'crucian'], recommendedBaits: ['pellet', 'paste', 'corn'],
    population: { crucian: 1.05, carp: 2.6, mirror: 3.6, bluegill: 0, catfish: 0.25, yellowcat: 0.2, snakehead: 0, mandarin: 0, bass: 0 },
    sizeScale: 1.08, startMinutes: 840, temperature: 21, weatherSeed: 37,
    terrain: { cx: 0, cz: -175, rx: 205, rz: 175, seed: 101, shape: 'pond', maxDepth: 5, slope: 18, mountain: 0.16 },
    platforms: { gap: 18, spacing: 22, depths: [2.2, 3, 3.8, 4.6], names: ['햇살', '파라솔', '잉어터', '향어터', '큰손맛', '황금찌', '대물터', '결승석'], roof: '#ab7752', wood: '#ac875c' },
    palette: { grass: '#8da356', dirt: '#987658', sand: '#d6c799', mud: '#78644b', stone: '#a0a08e', forest: '#738f49', log: '#876643', leaf: '#709049', leafAutumn: '#c6a25a', deep: '#486f75', shallow: '#84a8a0', fog: '#d6d1b9', accent: '#d0a45f' },
    trees: 0.28, reeds: 0.15, wind: 0.18, fogDensity: 0.00065,
  },
];
export const findFishery = (id?: string | null) => FISHERIES.find(f => f.id === id);
function selectedFishery(): Fishery {
  const query = new URLSearchParams(location.search).get('map');
  const fallback = findFishery(DEFAULT_FISHERY_ID)!;
  if (query) return canEnterFishery(query) ? findFishery(query)! : fallback;
  try {
    const saved = localStorage.getItem('fishing-map-v1');
    return canEnterFishery(saved) ? findFishery(saved)! : fallback;
  } catch { return fallback; }
}
/** 한 세션의 맵은 고정. 전환할 때 저장한 뒤 새 월드를 로드한다. */
export const ACTIVE_FISHERY = selectedFishery();

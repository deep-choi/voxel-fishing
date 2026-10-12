import type { FloatSpec, HookSpec, LineSpec, Rarity, RodSpec } from './data';
import type { KeepnetSpec, NetSpec } from './items';

// 버들못은 게임 자체 장비 시리즈다. 실존 브랜드의 모델·제조사 규격이 아니다.
// 같은 계열은 구매 단계마다 강화되며, 계열 사이의 사거리·강도·예민함 차이는 남긴다.
const STAGES = ['입문', '개량', '정밀', '명장'] as const;
const LEVELS = [2, 5, 8, 12];
const RARITIES: Rarity[] = ['uncommon', 'rare', 'epic', 'legendary'];
const meta = (index: number, purpose: string) => ({ level: LEVELS[index], rarity: RARITIES[index], purpose });

interface RodSeries {
  id: string; name: string; purpose: string; desc: string; action: number;
  // 길이, 원줄 길이, 제압력, 완충 거리, 가격
  stages: [number, number, number, number, number][];
}
const ROD_SERIES: RodSeries[] = [
  { id: 'shore', name: '소담', purpose: '연안 붕어 · 연질 완충', action: 0.28,
    desc: '연안의 붕어를 위한 짧은 연질대. 가는 줄의 충격을 받지만 먼 거리와 강한 제압에는 불리하다',
    stages: [[4.5, 4.2, 2.4, 1.5, 420], [4.68, 4.4, 2.85, 1.8, 1850], [4.86, 4.6, 3.25, 2.1, 6200], [5.04, 4.8, 3.7, 2.5, 16500]] },
  { id: 'reach', name: '원경', purpose: '장거리 · 깊은 수심', action: 0.48,
    desc: '먼 포인트에 닿는 장거리대. 긴 원줄을 쓰지만 같은 가격의 강공대보다 제압력이 낮다',
    stages: [[7.2, 8.4, 3.1, 1.4, 800], [7.92, 9.6, 3.8, 1.65, 2900], [8.64, 10.8, 4.5, 1.9, 8900], [9.36, 12, 5.2, 2.15, 24500]] },
  { id: 'force', name: '철심', purpose: '대물 · 강공 제압', action: 0.86,
    desc: '짧은 거리에서 대물을 제압하는 경질대. 휨이 적어 가는 줄에는 돌진 충격이 크게 전해진다',
    stages: [[5.4, 5.1, 4.2, 0.95, 950], [5.58, 5.3, 5.4, 1.05, 3400], [5.76, 5.5, 6.8, 1.2, 10800], [5.94, 5.7, 8.2, 1.35, 28500]] },
  { id: 'allround', name: '가온', purpose: '붕어·잉어 · 균형', action: 0.58,
    desc: '사거리와 완충, 제압력의 균형을 맞춘 다용도대. 전문 계열의 최대 성능에는 미치지 않는다',
    stages: [[5.76, 5.5, 3.2, 1.4, 580], [6.12, 5.9, 4.0, 1.6, 2250], [6.48, 6.3, 4.9, 1.8, 7400], [6.84, 6.7, 5.8, 2.0, 20500]] },
];
export const EXPANDED_RODS: RodSpec[] = ROD_SERIES.flatMap(series => series.stages.map(([length, line, power, flex, price], i) => ({
  id: `willow-${series.id}-${i + 1}`, name: `버들못 ${series.name} ${STAGES[i]}대`, length, line, power, flex, price,
  ...meta(i, series.purpose), desc: series.desc,
})));
export const EXPANDED_ROD_ACTION: Record<string, number> = Object.fromEntries(ROD_SERIES.flatMap(series => series.stages.map((_, i) => [`willow-${series.id}-${i + 1}`, series.action])));

interface LineSeries {
  id: string; name: string; go: string; diameterMm: number; purpose: string; desc: string;
  // 강도, 눈에 띄는 정도, 가격
  stages: [number, number, number][];
}
const LINE_SERIES: LineSeries[] = [
  { id: 'hairline', name: '여울 세사', go: '0.8', diameterMm: 0.145, purpose: '섬세 · 저활성 붕어',
    desc: '극세 원줄. 작은 입질에 유리하지만 강공 채비보다 끊어지는 하중이 낮다',
    stages: [[1.65, 0.02, 120], [2.15, 0.01, 680], [2.7, 0, 2200], [3.3, 0, 6500]] },
  { id: 'clearline', name: '청류 정밀', go: '1.5', diameterMm: 0.205, purpose: '붕어 · 가는 줄 균형',
    desc: '예민한 붕어와 작은 잉어용. 굵기를 유지하며 강도와 수중 시인성을 개선한다',
    stages: [[2.6, 0.08, 180], [3.5, 0.05, 950], [4.5, 0.03, 3200], [5.5, 0.01, 8200]] },
  { id: 'mainline', name: '본류 균형', go: '2.5', diameterMm: 0.26, purpose: '중형 잉어·향어',
    desc: '중형어의 돌진을 버티는 균형 원줄. 극세 원줄보다 굵어 예민한 입질은 줄어든다',
    stages: [[4.4, 0.24, 260], [5.5, 0.19, 1350], [6.8, 0.14, 4200], [8.1, 0.10, 10500]] },
  { id: 'armorline', name: '강벽 대물', go: '5', diameterMm: 0.37, purpose: '대물 · 강도 우선',
    desc: '대물 전용 굵은 원줄. 상위 제품도 줄의 굵기 때문에 경계심과 채비 둔화가 남는다',
    stages: [[8.0, 0.50, 520], [10.1, 0.44, 2150], [12.4, 0.38, 5900], [14.8, 0.32, 12500]] },
];
export const EXPANDED_LINES: LineSpec[] = LINE_SERIES.flatMap(series => series.stages.map(([strength, visibility, price], i) => ({
  id: `willow-${series.id}-${i + 1}`, name: `버들못 ${series.name} ${STAGES[i]} ${series.go}호`, diameterMm: series.diameterMm,
  strength, visibility, price, ...meta(i, series.purpose), desc: series.desc,
})));

interface HookSeries {
  id: string; name: string; go: number; gapMm: number; purpose: string; desc: string;
  // 유지력, 미끼 흡입 계수, 가격
  stages: [number, number, number][];
}
const HOOK_SERIES: HookSeries[] = [
  { id: 'silkhook', name: '실결 세축', go: 3, gapMm: 3.2, purpose: '섬세 · 작은 떡밥',
    desc: '작은 붕어 입과 글루텐용. 큰 옥수수·새우는 달기 어렵고 큰 입에서는 유지력이 떨어진다',
    stages: [[0.84, 1.22, 100], [1.02, 1.26, 580], [1.20, 1.30, 1900], [1.38, 1.34, 5700]] },
  { id: 'grainhook', name: '곡향 붕어', go: 5, gapMm: 4.6, purpose: '붕어 · 지렁이·떡밥',
    desc: '지렁이와 작은 떡밥을 받는 붕어용. 강축 대물바늘보다 얇고 폭이 좁다',
    stages: [[1.00, 1.12, 150], [1.18, 1.16, 780], [1.36, 1.20, 2650], [1.54, 1.24, 7200]] },
  { id: 'cornhook', name: '황금알 잉어', go: 8, gapMm: 7.5, purpose: '잉어 · 옥수수·어분',
    desc: '옥수수와 어분을 사용하는 중형 잉어용. 입이 작은 붕어에게는 삼키기 어려운 크기다',
    stages: [[1.22, 0.94, 230], [1.42, 0.98, 1100], [1.62, 1.02, 3500], [1.82, 1.06, 9200]] },
  { id: 'ironhook', name: '철각 강축', go: 12, gapMm: 11, purpose: '대물 · 큰 미끼',
    desc: '큰 잉어·메기용 넓고 강한 바늘. 상위 제품도 작은 물고기의 흡입에는 불리하다',
    stages: [[1.52, 0.74, 390], [1.76, 0.78, 1650], [2.00, 0.82, 4700], [2.24, 0.86, 11000]] },
];
export const EXPANDED_HOOKS: HookSpec[] = HOOK_SERIES.flatMap(series => series.stages.map(([hold, attraction, price], i) => ({
  id: `willow-${series.id}-${i + 1}`, name: `버들못 ${series.name} ${STAGES[i]} ${series.go}호`, gapMm: series.gapMm,
  hold, attraction, price, ...meta(i, series.purpose), desc: series.desc,
})));

// 찌 3계열 × 4단계: 고요한 물·바람 부는 물·밤낚시의 장단점을 유지한다.
export const EXPANDED_FLOATS: FloatSpec[] = [
  ...[ // 예민함, 찌톱 마디, 흔들림, 정착 속도, 가격
    [1.20, 10, 1.5, 0.24, 180], [1.40, 12, 1.4, 0.27, 850], [1.58, 15, 1.3, 0.30, 3300], [1.70, 18, 1.2, 0.33, 9800],
  ].map(([sensitivity, notches, sway, sinkSpeed, price], i): FloatSpec => ({
    id: `willow-dewfloat-${i + 1}`, name: `버들못 이슬 저부력 ${STAGES[i]}찌`, shape: 'slim', scale: 0.75,
    sensitivity, notches, sway, sinkSpeed, price, ...meta(i, '고요한 물 · 섬세한 입질'),
    desc: '잔잔한 수면의 작은 찌올림용. 품질이 올라갈수록 잘 읽히지만 단찌보다 물결에 약하고 발광이 없다',
  })),
  ...[
    [0.82, 7, 0.6, 0.60, 240], [0.94, 8, 0.48, 0.65, 1200], [1.06, 9, 0.37, 0.70, 4400], [1.18, 10, 0.28, 0.75, 11500],
  ].map(([sensitivity, notches, sway, sinkSpeed, price], i): FloatSpec => ({
    id: `willow-anchorfloat-${i + 1}`, name: `버들못 닻별 안정 ${STAGES[i]}찌`, shape: 'short', scale: 1.1,
    sensitivity, notches, sway, sinkSpeed, price, ...meta(i, '바람·물결 · 안정'),
    desc: '바람 부는 수면에서 빨리 서는 안정형. 물결에 덜 흔들리는 대신 저부력찌보다 입질 표시가 작다',
  })),
  ...[
    [1.00, 9, 1.12, 0.42, 1.8, 360], [1.16, 11, 1.02, 0.46, 2.2, 1550], [1.32, 13, 0.92, 0.50, 2.7, 5100], [1.48, 15, 0.82, 0.54, 3.2, 12000],
  ].map(([sensitivity, notches, sway, sinkSpeed, glow, price], i): FloatSpec => ({
    id: `willow-moonfloat-${i + 1}`, name: `버들못 달빛 전자 ${STAGES[i]}찌`, shape: 'electro', light: 'electro', scale: 1,
    sensitivity, notches, sway, sinkSpeed, glow, price, ...meta(i, '밤낚시 · 발광 시인성'),
    ...(i >= 2 ? { glowColor: '#ff634d', shift: '#74ff71' } : {}),
    desc: '밤에도 보이는 전자찌. 정밀·명장 단계는 올림 변색 기능이 있으며 주간 예민함은 저부력 계열보다 낮다',
  })),
];

export const EXPANDED_NETS: NetSpec[] = [
  { id: 'willow-banknet', name: '버들못 연안 뜰채', maxKg: 6, price: 290, level: 2, rarity: 'uncommon', purpose: '붕어·소형 잉어', desc: '기본 뜰채에서 한 단계 넓혀 6kg까지 떠낸다' },
  { id: 'willow-fieldernet', name: '버들못 들녘 뜰채', maxKg: 10, price: 650, level: 3, rarity: 'uncommon', purpose: '중형 잉어', desc: '중형 잉어의 무게를 감당하는 10kg 규격' },
  { id: 'willow-lakenet', name: '버들못 호수 뜰채', maxKg: 18, price: 1100, level: 5, rarity: 'rare', purpose: '중대형 잉어·향어', desc: '큰 향어까지 노리는 18kg 규격. 작은 고기 위주라면 작은 망으로도 충분하다' },
  { id: 'willow-strongnet', name: '버들못 강골 뜰채', maxKg: 30, price: 1900, level: 7, rarity: 'rare', purpose: '대물 포획', desc: '대물 조과를 위한 30kg 강화 규격' },
  { id: 'willow-deepnet', name: '버들못 심연 뜰채', maxKg: 45, price: 2700, level: 8, rarity: 'epic', purpose: '초대물 포획', desc: '45kg 한도의 대물용. 입질과 물고기 크기에는 영향을 주지 않는다' },
  { id: 'willow-crownnet', name: '버들못 천정 명장 뜰채', maxKg: 90, price: 11500, level: 12, rarity: 'legendary', purpose: '최대 하중 여유', desc: '최대 90kg를 위한 넉넉한 하중. 작은 어종에는 하위 뜰채와 포획 효과가 같다' },
];
export const EXPANDED_KEEPNETS: KeepnetSpec[] = [
  { id: 'willow-walkkeep', name: '버들못 산책 살림망', capacity: 28, price: 100, level: 1, rarity: 'common', purpose: '짧은 출조', desc: '초반 부담을 줄인 28칸 살림망' },
  { id: 'willow-daykeep', name: '버들못 한나절 살림망', capacity: 70, price: 720, level: 4, rarity: 'uncommon', purpose: '반나절 출조', desc: '수시로 판매하지 않고 70마리까지 모은다' },
  { id: 'willow-duskkeep', name: '버들못 해질녘 살림망', capacity: 125, price: 1750, level: 6, rarity: 'rare', purpose: '다수 조과 보관', desc: '여러 어종의 조과를 모으는 125칸 규격' },
  { id: 'willow-nightkeep', name: '버들못 밤샘 살림망', capacity: 180, price: 3800, level: 8, rarity: 'epic', purpose: '밤샘 출조', desc: '오래 머무는 밤낚시용 180칸. 낚시 확률에는 영향이 없다' },
  { id: 'willow-longkeep', name: '버들못 장정 살림망', capacity: 280, price: 10500, level: 10, rarity: 'legendary', purpose: '장시간 출조', desc: '판매 주기를 길게 잡는 280칸 대용량' },
  { id: 'willow-crownkeep', name: '버들못 천정 명장 살림망', capacity: 400, price: 22000, level: 12, rarity: 'legendary', purpose: '최대 보관 공간', desc: '최대 400마리 보관. 자주 판매한다면 작은 살림망도 실용적이다' },
];

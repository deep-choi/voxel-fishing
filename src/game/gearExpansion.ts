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
    desc: '짧은 거리에서 대물을 제압하는 경질대. 상위 단계는 초대물 장력용이며 굵은 원줄·강축바늘을 함께 써야 한다. 하중은 게임 전용 수치',
    stages: [[5.4, 5.1, 6, 1.1, 950], [5.58, 5.3, 11, 1.35, 3400], [5.76, 5.5, 20, 1.65, 10800], [5.94, 5.7, 30, 2.0, 28500]] },
  { id: 'allround', name: '가온', purpose: '붕어·잉어 · 균형', action: 0.58,
    desc: '사거리와 완충, 제압력의 균형을 맞춘 다용도대. 전문 계열의 최대 성능에는 미치지 않는다',
    stages: [[5.76, 5.5, 3.2, 1.4, 580], [6.12, 5.9, 4.0, 1.6, 2250], [6.48, 6.3, 4.9, 1.8, 7400], [6.84, 6.7, 5.8, 2.0, 20500]] },
];
export const EXPANDED_RODS: RodSpec[] = ROD_SERIES.flatMap(series => series.stages.map(([length, line, power, flex, price], i) => ({
  id: `willow-${series.id}-${i + 1}`, name: `버들못 ${series.name} ${STAGES[i]}대`, length, line, power, flex, price,
  ...meta(i, series.purpose), desc: series.desc,
})));
export const EXPANDED_ROD_ACTION: Record<string, number> = Object.fromEntries(ROD_SERIES.flatMap(series => series.stages.map((_, i) => [`willow-${series.id}-${i + 1}`, series.action])));

// 한 계열을 최고 수치로 통일하지 않고 낚시 거리와 완충 방식으로 선택하는 전용대.
EXPANDED_RODS.push(
  { id: 'willow-special-shore-1', name: '버들못 샛물 연안단대', length: 3.6, line: 3.3, power: 2.8, flex: 1.3, price: 720, level: 3, rarity: 'uncommon', purpose: '연안 · 짧은 거리', desc: '좌대 바로 앞과 가까운 수초 가장자리용 짧은 대. 먼 포인트에 닿지 못한다' },
  { id: 'willow-special-shore-2', name: '버들못 샛물 정밀단대', length: 4.14, line: 3.8, power: 3.4, flex: 1.65, price: 4600, level: 7, rarity: 'epic', purpose: '연안 · 짧은 거리', desc: '연안단대의 완충과 제압력을 보강했다. 짧은 원줄로 가까운 붕어 포인트를 노린다' },
  { id: 'willow-special-reach-1', name: '버들못 수평선 장거리대', length: 8.1, line: 10, power: 5, flex: 1.9, price: 5300, level: 6, rarity: 'rare', purpose: '장거리 · 깊은 수심', desc: '먼 수심 변화를 노리는 10m 원줄 채비. 같은 가격의 강공대보다 제압력이 작다' },
  { id: 'willow-special-reach-2', name: '버들못 수평선 극장대', length: 9.9, line: 13, power: 7, flex: 2.2, price: 24000, level: 12, rarity: 'legendary', purpose: '장거리 · 깊은 수심', desc: '13m 원줄로 멀고 깊은 곳에 닿는다. 초대물 제압용 짧은 강공대와 쓰임이 다르다' },
  { id: 'willow-special-soft-1', name: '버들못 유연 완충대', length: 5.4, line: 5.1, power: 4, flex: 2.3, price: 3700, level: 5, rarity: 'rare', purpose: '가는 줄 · 연질 완충', desc: '허리까지 휘며 2.3m를 받아 주는 완충대. 가는 원줄에 유리하지만 강제로 당기는 힘은 작다' },
  { id: 'willow-special-soft-2', name: '버들못 유연 심곡대', length: 6.3, line: 6, power: 7, flex: 3.0, price: 17000, level: 10, rarity: 'legendary', purpose: '가는 줄 · 연질 완충', desc: '깊은 휨과 3m 완충 거리로 급한 돌진을 받는다. 초대물 강공대보다 최대 하중은 낮다' },
  { id: 'willow-special-heavy-1', name: '버들못 거산 초대물대', length: 5.76, line: 5.5, power: 24, flex: 1.8, price: 16800, level: 10, rarity: 'epic', purpose: '초대물 · 강공', desc: '굵은 카본·합사와 강축바늘을 쓰는 초대물 전용. 짧은 사거리와 큰 하중의 게임 채비' },
  { id: 'willow-special-heavy-2', name: '버들못 거산 명장강공대', length: 6.12, line: 5.9, power: 32, flex: 2.2, price: 30000, level: 12, rarity: 'legendary', purpose: '초대물 · 강공', desc: '32kgf 제압력의 초대물 전용대. 약한 줄·바늘을 함께 쓰면 그 부품부터 손상된다. 수치는 게임 규격' },
);
Object.assign(EXPANDED_ROD_ACTION, {
  'willow-special-shore-1': 0.35, 'willow-special-shore-2': 0.32,
  'willow-special-reach-1': 0.55, 'willow-special-reach-2': 0.58,
  'willow-special-soft-1': 0.18, 'willow-special-soft-2': 0.12,
  'willow-special-heavy-1': 0.84, 'willow-special-heavy-2': 0.88,
});

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
    desc: '중간 하중의 대물용 모노 원줄. 초대물의 최대 돌진에는 초대물 카본·합사 계열이 필요하며 굵기에 따른 경계심과 채비 둔화가 남는다',
    stages: [[8.0, 0.50, 520], [10.1, 0.44, 2150], [12.4, 0.38, 5900], [14.8, 0.32, 12500]] },
];
export const EXPANDED_LINES: LineSpec[] = LINE_SERIES.flatMap(series => series.stages.map(([strength, visibility, price], i) => ({
  id: `willow-${series.id}-${i + 1}`, name: `버들못 ${series.name} ${STAGES[i]} ${series.go}호`, diameterMm: series.diameterMm,
  material: 'nylon', strength, visibility, price, ...meta(i, series.purpose), desc: series.desc,
})));

// 기존 32개 원줄 뒤에 추가한다. 아래 하중·직경·호수 환산은 게임 규격이다.
// 초대물 줄은 강도가 높은 만큼 굵기·가시성·가격 부담을 함께 높인다.
EXPANDED_LINES.push(
  ...[
    // 호수, 굵기, 강도, 가시성, 가격
    [6, 0.405, 14, 0.38, 2500], [8, 0.47, 22, 0.34, 6500],
    [10, 0.52, 31, 0.30, 14000], [12, 0.57, 42, 0.26, 28000],
  ].map(([go, diameterMm, strength, visibility, price], i): LineSpec => ({
    id: `willow-deepcarbon-${i + 1}`, name: `버들못 심층 카본 ${STAGES[i]} ${go}호`,
    material: 'fluorocarbon', diameterMm, strength, visibility, price,
    ...meta(i, '초대물 · 카본'),
    desc: '물속에서 덜 눈에 띄는 굵은 카본 원줄. 무겁고 뻣뻣해 섬세한 채비에는 불리하다. 강도·굵기는 게임 전용 수치',
  })),
  ...[
    [3, 0.285, 16, 0.60, 2100], [4, 0.33, 25, 0.65, 5900],
    [6, 0.405, 36, 0.70, 13500], [8, 0.47, 45, 0.75, 26500],
  ].map(([go, diameterMm, strength, visibility, price], i): LineSpec => ({
    id: `willow-titanbraid-${i + 1}`, name: `버들못 거암 합사 ${STAGES[i]} PE ${go}호`,
    material: 'braid', diameterMm, strength, visibility, price,
    ...meta(i, '초대물 · 저신축 합사'),
    desc: '굵기 대비 강도가 높은 저신축 합사. 눈에 잘 띄고 돌진 충격을 직접 전달하므로 대와 바늘도 강해야 한다. PE 호수·굵기·하중은 게임 규격',
  })),
);
// 소형·중형용 가는 카본/합사. 같은 재질의 초대물 줄과 굵기·강도를 분리한다.
EXPANDED_LINES.push(
  { id: 'willow-clearcarbon-1', name: '버들못 청명 실용카본 1.5호', material: 'fluorocarbon', diameterMm: 0.205, strength: 3.4, visibility: 0.01, price: 680, level: 3, rarity: 'uncommon', purpose: '붕어 · 가는 카본', desc: '경계심 높은 붕어용 가는 카본. 눈에 덜 띄지만 모노보다 뻣뻣하고 큰 돌진에는 약하다' },
  { id: 'willow-clearcarbon-2', name: '버들못 청명 고급카본 2호', material: 'fluorocarbon', diameterMm: 0.235, strength: 5.2, visibility: 0.025, price: 1750, level: 5, rarity: 'rare', purpose: '붕어·중형어 · 카본', desc: '가는 카본에서 강도를 높인 중소형어용. 대물 전용 카본보다 가늘고 약하다' },
  { id: 'willow-finebraid-1', name: '버들못 실안개 실용합사 PE 0.6호', material: 'braid', diameterMm: 0.128, strength: 5.5, visibility: 0.32, price: 1100, level: 4, rarity: 'uncommon', purpose: '가는 합사 · 직접 전달', desc: '가늘고 늘어남이 적어 반응을 직접 전달한다. 카본보다 잘 보이며 돌진 충격을 잘 흡수하지 못한다. PE 굵기는 게임 환산값' },
  { id: 'willow-finebraid-2', name: '버들못 실안개 고급합사 PE 1호', material: 'braid', diameterMm: 0.165, strength: 8, visibility: 0.38, price: 2700, level: 6, rarity: 'rare', purpose: '중형어 · 저신축 합사', desc: '중형어용 가는 합사. 초대물 합사보다 경계심 부담은 작지만 충격을 낚싯대와 바늘에 그대로 전달한다. 게임 규격' },
);

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
    desc: '큰 잉어·메기용 넓고 강한 바늘. 정밀·명장 단계는 초대물 장력용이지만 작은 입에는 불리하다. 유지력과 하중은 게임 전용 수치',
    stages: [[2.0, 0.74, 390], [3.5, 0.78, 1650], [5.5, 0.82, 4700], [9.0, 0.86, 11000]] },
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

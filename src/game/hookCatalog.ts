import type { HookSpec, Rarity } from './data';

// 버들못 자체 장비. 호수·폭·축 굵기·하중은 비교를 위한 게임 규격이다.
const STAGES = ['입문', '실용', '전문', '명장'];
const LEVELS = [2, 5, 9, 13];
const RARITIES: Rarity[] = ['uncommon', 'rare', 'epic', 'legendary'];
const SHARPNESS = [1, 1.08, 1.15, 1.22];
interface HookSeries {
  id: string; name: string; go: number; gapMm: number; wireMm: number;
  shape: NonNullable<HookSpec['shape']>; barbed: boolean; purpose: string; desc: string;
  // 유지력 / 흡입 계수 / 가격. 계열별 폭·축을 유지하고 재질·끝 가공의 품질이 오른다.
  stages: [number, number, number][];
}
const SERIES: HookSeries[] = [
  { id: 'crucian', name: '붕어 가는축', go: 4, gapMm: 3.8, wireMm: 0.26, shape: 'fine', barbed: false,
    purpose: '붕어 · 작은 떡밥 · 무미늘',
    desc: '가는 축으로 약한 챔질에도 박히는 붕어용. 무미늘이라 줄을 느슨하게 하면 빠지기 쉽다. 큰 옥수수·새우와 강한 대물 제압에는 불리하다',
    stages: [[1, 1.2, 160], [1.37, 1.25, 760], [1.9, 1.3, 2500], [2.55, 1.35, 7000]] },
  { id: 'carp', name: '잉어 둥근강축', go: 12, gapMm: 11, wireMm: 0.95, shape: 'round', barbed: true,
    purpose: '대물 잉어·향어 · 옥수수·어분',
    desc: '둥근 굽과 굵은 축으로 강한 돌진을 버틴다. 미늘이 유지력을 돕지만 굵은 축을 박으려면 정확한 챔질이 필요하다. 작은 입에는 큰 폭이 불리하다',
    stages: [[1.9, 0.76, 420], [3.3, 0.8, 1750], [5.7, 0.84, 5200], [9, 0.88, 12800]] },
  { id: 'catfish', name: '메기 긴축', go: 13, gapMm: 12.5, wireMm: 0.8, shape: 'long', barbed: true,
    purpose: '메기·가물치 · 지렁이·새우',
    desc: '긴 축에 큰 생미끼를 달아 메기·가물치를 노린다. 미늘과 강한 유지력이 유리하지만 작고 예민한 입질에는 긴 형태와 넓은 폭이 불리하다',
    stages: [[1.7, 0.8, 390], [3, 0.84, 1620], [4.9, 0.88, 4900], [7.8, 0.92, 12000]] },
  { id: 'allround', name: '범용 광폭', go: 8, gapMm: 7, wireMm: 0.52, shape: 'wide', barbed: true,
    purpose: '중형어 · 다양한 미끼 · 광폭',
    desc: '넓은 굽으로 다양한 미끼를 받는 중형어용. 가는 축형보다 박힘은 둔하고 강축형보다 최대 하중은 낮다. 작은 입에는 넓은 형태가 불리하다',
    stages: [[1.3, 1.04, 250], [2.1, 1.08, 1150], [3.25, 1.12, 3600], [5.1, 1.16, 9500]] },
];

export const SPECIALIST_HOOKS: HookSpec[] = SERIES.flatMap(series => series.stages.map(([hold, attraction, price], i) => ({
  id: `specialist-${series.id}-${i + 1}`, name: `버들못 ${series.name} ${STAGES[i]} ${series.go}호`,
  gapMm: series.gapMm, wireMm: series.wireMm, shape: series.shape, barbed: series.barbed,
  sharpness: SHARPNESS[i],
  hold, attraction, price, level: LEVELS[i], rarity: RARITIES[i], purpose: series.purpose,
  desc: `${series.desc}. 게임 규격: 폭 ${series.gapMm}mm · 축 ${series.wireMm}mm · ${series.barbed ? '미늘 있음' : '무미늘'}`,
})));

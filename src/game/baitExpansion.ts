import type { BaitId, SpeciesId } from './data';
import type { BaitProduct } from './realCatalog';

type Affinity = Partial<Record<SpeciesId, number>>;
type Variant = [name: string, purpose: string, desc: string, affinity: Affinity];
const VARIANTS: Record<BaitId | 'chum', Variant[]> = {
  worm: [
    ['흙지렁이', '생미끼 · 범용', '가격 부담이 적은 지렁이. 블루길 입질도 자주 섞인다.', { crucian: 1.05, yellowcat: 1.05, bluegill: 1.15 }],
    ['선별 홍지렁이', '홍지렁이 · 붕어·동자개', '붕어·동자개에 맞춘 작은 홍지렁이. 잉어 공략에는 덜 유리하다.', { crucian: 1.22, yellowcat: 1.25, carp: 0.85, mirror: 0.85 }],
    ['굵은 대물지렁이', '대물지렁이 · 메기', '메기와 잉어를 노리는 굵은 지렁이. 붕어·블루길 입질은 줄어든다.', { catfish: 1.42, carp: 1.18, crucian: 0.65, bluegill: 0.4 }],
    ['야행성 어종 지렁이', '생미끼 · 메기·동자개', '메기·동자개 선호에 맞춘 선별 구성. 붕어와 블루길에는 불리하다.', { catfish: 1.62, yellowcat: 1.4, crucian: 0.55, bluegill: 0.3, carp: 0.8 }],
    ['특선 동자개 지렁이', '특선 생미끼 · 동자개', '동자개에 집중한 선별품. 잉어·붕어 입질까지 늘려 주지는 않는다.', { yellowcat: 1.85, catfish: 1.3, carp: 0.55, mirror: 0.55, crucian: 0.45, bluegill: 0.2 }],
  ],
  shrimp: [
    ['작은 민물새우', '생새우 · 동자개·쏘가리', '작은 육식어를 노리는 기본 새우. 잡어도 접근한다.', { yellowcat: 1.12, mandarin: 1.05, bluegill: 1.1 }],
    ['선별 민물새우', '생새우 · 메기', '메기 입질에 맞춘 새우 구성. 붕어 공략에는 불리하다.', { catfish: 1.3, yellowcat: 1.15, crucian: 0.75 }],
    ['쏘가리 새우', '생새우 · 쏘가리', '쏘가리 선호를 높이고 메기·블루길 입질을 줄였다.', { mandarin: 1.5, catfish: 0.8, bluegill: 0.5, crucian: 0.6 }],
    ['가물치 왕새우', '왕새우 · 가물치·배스', '가물치·배스를 노리는 큰 새우. 쏘가리·동자개에는 덜 맞는다.', { snakehead: 1.65, bass: 1.35, mandarin: 0.75, yellowcat: 0.7, bluegill: 0.3 }],
    ['특선 쏘가리 새우', '특선 생새우 · 쏘가리', '쏘가리에 집중한 선별 새우. 메기와 잔챙이 입질은 크게 줄어든다.', { mandarin: 1.9, bass: 1.1, catfish: 0.55, yellowcat: 0.65, bluegill: 0.2, crucian: 0.45 }],
  ],
  corn: [
    ['삶은 옥수수', '곡물 알갱이 · 잉어', '잉어를 노리는 저렴한 기본 옥수수.', { carp: 1.08, mirror: 1.04 }],
    ['연한 단옥수수', '작은 알갱이 · 붕어·잉어', '붕어도 먹기 좋은 연한 알갱이. 향어 특화 미끼는 아니다.', { crucian: 1.28, carp: 1.15, mirror: 0.85 }],
    ['굵은 잉어 옥수수', '굵은 알갱이 · 잉어', '잉어에 맞춘 굵은 알갱이. 붕어 입질은 줄어든다.', { carp: 1.5, mirror: 1.08, crucian: 0.6, bluegill: 0.4 }],
    ['향어 발효옥수수', '발효 곡물 · 향어', '향어 선호를 높인 발효 배합. 붕어에는 덜 맞는다.', { mirror: 1.65, carp: 1.16, crucian: 0.45, bluegill: 0.3 }],
    ['특선 잉어 옥수수', '특선 곡물 · 잉어', '잉어 선택성을 높인 자체 배합. 향어·붕어는 다른 옥수수가 유리하다.', { carp: 1.9, mirror: 0.8, crucian: 0.25, bluegill: 0.2 }],
  ],
  paste: [
    ['보리 곡물떡밥', '곡물 · 붕어·잉어', '붕어와 잉어를 함께 노리는 저렴한 보리 배합.', { crucian: 1.08, carp: 1.06 }],
    ['옥수수 곡물떡밥', '곡물 · 잉어 중심', '옥수수 배합으로 잉어 선호를 높였다. 붕어 선택성은 낮다.', { carp: 1.28, crucian: 0.95, mirror: 1.1 }],
    ['붕어 미세 곡물떡밥', '미세 곡물 · 붕어', '붕어 중심으로 입질을 모으는 배합. 잉어·향어에는 덜 유리하다.', { crucian: 1.5, carp: 0.8, mirror: 0.75 }],
    ['잉향 곡물떡밥', '곡물 · 잉어·향어', '잉어와 향어를 함께 공략한다. 붕어 입질은 줄어든다.', { carp: 1.5, mirror: 1.4, crucian: 0.65 }],
    ['특선 붕어 곡물떡밥', '특선 곡물 · 붕어', '붕어에 집중한 고가 배합. 잉어·향어 범용성은 낮다.', { crucian: 1.85, carp: 0.55, mirror: 0.5, bluegill: 0.4 }],
  ],
  gluten: [
    ['기본 글루텐', '글루텐 · 붕어', '붕어 찌낚시를 시작하는 저렴한 기본 배합.', { crucian: 1.1, carp: 1.02 }],
    ['고구마 글루텐', '글루텐 · 붕어·잉어', '고구마 향으로 붕어와 잉어를 함께 노린다.', { crucian: 1.15, carp: 1.3, mirror: 0.9 }],
    ['솜결 붕어 글루텐', '섬세한 배합 · 붕어', '붕어 선호에 맞춘 섬세한 배합. 잉어·향어는 덜 반긴다.', { crucian: 1.52, carp: 0.75, mirror: 0.7 }],
    ['어분 향어 글루텐', '어분 글루텐 · 향어', '향어 중심의 어분 혼합. 붕어 전용 글루텐보다 붕어 선호가 낮다.', { mirror: 1.7, carp: 1.3, crucian: 0.8 }],
    ['특선 붕어 글루텐', '특선 글루텐 · 붕어', '붕어 선택성을 가장 높인 자체 배합. 다른 어종에는 불리하다.', { crucian: 1.9, carp: 0.5, mirror: 0.45, bluegill: 0.3 }],
  ],
  pellet: [
    ['기본 어분떡밥', '어분 · 잉어·향어', '부담 없이 쓰는 잉어·향어용 어분 배합.', { carp: 1.06, mirror: 1.08 }],
    ['곡물 혼합 어분', '어분·곡물 · 붕어·잉어', '붕어와 잉어가 섞인 자리용. 향어 선택성은 낮다.', { crucian: 1.3, carp: 1.2, mirror: 0.9 }],
    ['향어 집중 어분', '어분 · 향어', '향어 선호를 높였다. 붕어에는 잘 맞지 않는다.', { mirror: 1.55, carp: 1.16, crucian: 0.65 }],
    ['잉어 발효 어분', '발효 어분 · 잉어', '잉어 공략에 집중한 배합. 향어와 붕어 입질은 줄어든다.', { carp: 1.75, mirror: 0.85, crucian: 0.55 }],
    ['특선 향어 어분', '특선 어분 · 향어', '향어 선택성을 높인 자체 배합. 잉어에는 중간 등급 배합이 더 유리할 수 있다.', { mirror: 1.95, carp: 0.8, crucian: 0.4, bluegill: 0.3 }],
  ],
  chum: [
    ['보리 배합떡밥', '곡물 · 붕어·잉어', '바늘에 다는 곡물 향 중심의 붕어·잉어용 배합.', { crucian: 1.1, carp: 1.05, mirror: 0.9 }],
    ['잉향 배합떡밥', '어분 · 잉어·향어', '바늘에 다는 잉어·향어용 어분 배합. 붕어에는 덜 유리하다.', { carp: 1.2, mirror: 1.3, crucian: 0.75 }],
    ['붕어 집중 배합떡밥', '글루텐 · 붕어', '바늘에 다는 붕어용 글루텐 배합. 잉어·향어에는 덜 유리하다.', { crucian: 1.5, carp: 0.65, mirror: 0.55 }],
    ['잉어 발효 배합떡밥', '옥수수 · 잉어', '바늘에 다는 잉어용 곡물 배합. 붕어·향어에는 덜 맞는다.', { carp: 1.65, mirror: 0.6, crucian: 0.45 }],
    ['특선 향어 배합떡밥', '특선 어분 · 향어', '바늘에 다는 향어용 어분 배합. 모든 어종에 유리한 만능 배합은 아니다.', { mirror: 1.8, carp: 0.55, crucian: 0.3, bluegill: 0.4 }],
  ],
};
const BASE_PRICE: Record<BaitId | 'chum', number> = { worm: 30, shrimp: 65, corn: 35, paste: 40, gluten: 45, pellet: 50, chum: 60 };
const FLAVORS: BaitId[] = ['paste', 'pellet', 'gluten', 'corn', 'pellet'];

/** 버들못 상점의 게임 전용 선별·배합 상품. 실존 제조사 제품명·출처를 만들지 않는다. */
export function createHouseBaits(): BaitProduct[] {
  return (Object.entries(VARIANTS) as [BaitId | 'chum', Variant[]][]).flatMap(([series, variants]) => variants.map(([name, purpose, desc, speciesAffinity], index) => ({
    id: `house-${series}-${index + 1}`, name: `버들못 ${name}`, baseBait: series === 'chum' ? FLAVORS[index] : series,
    count: series === 'chum' ? 5 : 10, price: Math.round(BASE_PRICE[series] * [1, 2, 4, 7, 11][index]),
    level: [1, 2, 4, 7, 10][index], qualityTier: (index + 1) as 1 | 2 | 3 | 4 | 5,
    origin: 'house', facts: '버들못 자체 선별·배합 · 게임 전용 상품', purpose, desc, speciesAffinity,
    // 품질을 만능 입질 배율로 쓰지 않고 어종별 선호로 구별한다.
    biteScale: 1, chumScale: series === 'chum' ? [1, 1.08, 1.15, 1.22, 1.3][index] : 1,
  })));
}

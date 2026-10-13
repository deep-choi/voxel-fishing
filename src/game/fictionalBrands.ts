export type BrandProductKind = 'bait' | 'ingredient' | 'rod' | 'line' | 'float' | 'hook' | 'net' | 'keepnet';

export interface GameBrand {
  id: string;
  name: string;
  specialty: string;
  signature: string;
  story: string;
}

export const GAME_BRANDS: readonly GameBrand[] = [
  { id: 'jukgyeol', name: '죽결', specialty: '낚싯대', signature: '대나무대의 부드러운 휨을 카본대에 담아요.', story: '대나무 민장대를 깎던 공방에서 출발했어요. 카본대로 바뀐 뒤에도 대나무대의 휨 곡선을 연구하며 낚싯대를 만듭니다.' },
  { id: 'gangsim', name: '강심', specialty: '낚싯대', signature: '부러진 대를 고치던 수리점의 강한 허리 설계.', story: '큰 잉어가 걸릴 때마다 부러진 낚싯대를 고쳐 주던 저수지 수리점이, 파손을 줄이는 대를 직접 만들기 시작했어요.' },
  { id: 'gaondae', name: '가온대', specialty: '낚싯대', signature: '규격 생산으로 가격과 기본 성능을 맞춰요.', story: '처음 낚시를 시작하는 사람도 부담 없이 장비를 갖추도록 길이와 휨새를 표준화한 지역 공방입니다.' },
  { id: 'seum', name: '세움', specialty: '찌', signature: '갈대 몸통을 손으로 깎고 부력을 하나씩 맞춰요.', story: '갈대찌를 손으로 다듬던 장인이 찌마다 무게중심을 맞추는 작업장을 열며 알려졌어요.' },
  { id: 'jangyeol', name: '잔결', specialty: '찌', signature: '정밀한 무게중심으로 작은 움직임을 보여줘요.', story: '시계 수리공이 찌의 미세한 무게 차이를 재기 시작했어요. 작은 입질을 알아보기 좋은 찌가 대표 제품입니다.' },
  { id: 'ddoryeot', name: '또렷', specialty: '찌', signature: '찌톱의 색과 눈금을 읽기 쉽게 다듬어요.', story: '찌톱을 칠하던 도색 공방에서 시작했어요. 물 위에서 올림과 내림을 구분하기 쉽도록 색과 눈금 간격을 연구합니다.' },
  { id: 'malgeunsil', name: '맑은실', specialty: '원줄', signature: '가는 굵기와 낮은 수중 노출을 연구해요.', story: '방적 실을 만들던 공장이 낚싯줄 사업을 시작하며, 얇고 물속에서 덜 눈에 띄는 원줄에 집중했어요.' },
  { id: 'dolgyeol', name: '돌결', specialty: '원줄', signature: '바위와 수초에 쓸리는 원줄을 오래 연구했어요.', story: '바닷가 그물과 밧줄을 수선하던 작업장이 거친 표면에 버티는 재료와 짜임을 낚싯줄에 적용했습니다.' },
  { id: 'maedeupson', name: '매듭손', specialty: '원줄', signature: '매듭을 묶고 당겨 보며 연결부를 다듬어요.', story: '어망을 엮던 장인들이 매듭에서 줄이 끊기는 일을 줄이려고 여러 매듭과 실의 조합을 시험하며 만든 브랜드예요.' },
  { id: 'nalgeut', name: '날끝', specialty: '바늘', signature: '송곳을 갈던 손으로 바늘 끝을 다듬어요.', story: '바늘과 송곳을 만들던 대장장이가 붕어바늘 끝의 각도와 갈림을 연구하며 낚시바늘을 만들기 시작했습니다.' },
  { id: 'gangteok', name: '강턱', specialty: '바늘', signature: '굵은 축과 넓은 바늘 폭을 다루는 대장간.', story: '농기구와 굵은 철물을 만들던 대장간이 큰 물고기의 힘을 버틸 바늘을 만들면서 낚시꾼들에게 이름을 알렸어요.' },
  { id: 'jeongho', name: '정호', specialty: '바늘', signature: '호수마다 폭과 축 굵기를 일정하게 맞춰요.', story: '바늘 크기의 편차를 줄이는 데 집중해 온 제조사입니다. 같은 호수 제품을 다시 사도 규격을 익숙하게 쓸 수 있도록 만들어요.' },
  { id: 'deurhyang', name: '들향', specialty: '미끼·떡밥', signature: '곡물 발효와 집어 배합이 대표예요.', story: '저수지 마을에서 보리와 곡물을 발효해 쓰던 집어 배합을 바탕으로 성장한 떡밥 공방입니다.' },
  { id: 'gyeolchak', name: '결착', specialty: '미끼·떡밥', signature: '글루텐과 배합 결을 연구해 바늘에 오래 붙여요.', story: '식품 재료 공방에서 글루텐과 전분의 결합을 연구하다가, 바늘에 잘 붙고 천천히 풀리는 떡밥을 만들기 시작했어요.' },
  { id: 'eosim', name: '어심', specialty: '미끼·떡밥', signature: '어분과 펠릿을 섞는 배합에 집중해요.', story: '사료 공장에서 낚시용 어분 배합을 연구하며 출발했습니다. 어분 향과 알갱이 비율을 바꾼 떡밥이 대표 제품이에요.' },
  { id: 'sodam', name: '소담', specialty: '실속 장비', signature: '낚시점 조합이 함께 만들어 부담을 낮춰요.', story: '여러 동네 낚시점이 자주 팔리는 규격을 함께 생산하며 시작했어요. 꼭 필요한 성능을 갖춘 상품을 합리적인 가격에 내놓습니다.' },
  { id: 'baekun', name: '백운', specialty: '고급 장비', signature: '재료 선택과 마감을 오래 살펴 완성도를 높여요.', story: '각 분야 장인들이 재료를 함께 고르고 마감 기준을 맞추는 제조 연합입니다. 완성도와 가격을 함께 따져 고르는 고급 상품을 만들어요.' },
  { id: 'geumulmok', name: '그물목', specialty: '뜰채·살림망', signature: '그물과 연결부를 직접 수선하던 작업장 출신.', story: '찢어진 그물을 기우고 손잡이와 망목을 고치던 수선소에서 출발했어요. 뜰채의 테두리와 살림망의 연결부를 오래 쓰도록 만드는 데 익숙합니다.' },
];

const BRAND_BY_ID = new Map(GAME_BRANDS.map(brand => [brand.id, brand]));
export const gameBrand = (id: string) => BRAND_BY_ID.get(id) ?? GAME_BRANDS[15];

export interface BrandProduct {
  id: string; name: string; price?: number; level?: number; rarity?: string;
  brandId?: string; modelId?: string; modelName?: string; size?: number;
  power?: number; flex?: number; length?: number; sensitivity?: number; sway?: number; notches?: number; shape?: string;
  light?: string; material?: string; diameterMm?: number; strength?: number; visibility?: number; hold?: number; wireMm?: number; sharpness?: number; gapMm?: number;
  qualityTier?: number; baseBait?: string; origin?: string; maxKg?: number; capacity?: number;
}
const n = (item: BrandProduct, key: keyof BrandProduct) => Number(item[key] ?? 0);
const s = (item: BrandProduct, key: keyof BrandProduct) => String(item[key] ?? '');

export function brandIdForProduct(kind: BrandProductKind, item: BrandProduct): string {
  if (item.brandId && BRAND_BY_ID.has(item.brandId)) return item.brandId;
  if (kind === 'rod') {
    if (n(item, 'price') <= 250) return 'sodam';
    if (n(item, 'power') >= 10 || (n(item, 'power') >= 5.5 && n(item, 'flex') < 1.7)) return 'gangsim';
    if (n(item, 'flex') >= 2.2) return 'jukgyeol';
    if (item.rarity === 'legendary' || n(item, 'price') >= 24500) return 'baekun';
    if (n(item, 'price') <= 800) return 'gaondae';
    return n(item, 'price') >= 7000 ? 'baekun' : 'sodam';
  }
  if (kind === 'float') {
    if (n(item, 'price') === 0) return 'sodam';
    if (n(item, 'sensitivity') >= 1.38 && n(item, 'sway') > 1) return 'jangyeol';
    if (item.shape === 'reed' || item.shape === 'peacock') return 'seum';
    if (item.light || item.shape === 'short' || n(item, 'sway') < 0.75) return 'ddoryeot';
    if (n(item, 'price') >= 9800 || item.rarity === 'legendary') return 'baekun';
    return 'ddoryeot';
  }
  if (kind === 'line') {
    if (n(item, 'price') === 0) return 'sodam';
    if (n(item, 'diameterMm') >= 0.37 && n(item, 'strength') >= 8) return 'dolgyeol';
    if (n(item, 'visibility') <= 0.05 || n(item, 'diameterMm') > 0 && n(item, 'diameterMm') <= 0.165) return 'malgeunsil';
    if (n(item, 'price') >= 6500 || item.rarity === 'legendary') return 'baekun';
    return 'maedeupson';
  }
  if (kind === 'hook') {
    if (n(item, 'price') === 0) return 'sodam';
    if (n(item, 'hold') >= 3.2 || n(item, 'wireMm') >= 0.6) return 'gangteok';
    if (n(item, 'sharpness') >= 1.16 || item.shape === 'fine') return 'nalgeut';
    if (n(item, 'price') >= 5700 || item.rarity === 'legendary') return 'baekun';
    return 'jeongho';
  }
  if (kind === 'bait') {
    if (n(item, 'qualityTier') >= 5 || n(item, 'price') >= 650) return 'baekun';
    const base = s(item, 'baseBait') || item.id;
    if (base === 'paste' || base === 'corn') return 'deurhyang';
    if (base === 'gluten') return 'gyeolchak';
    if (base === 'pellet') return 'eosim';
    return 'sodam';
  }
  if (kind === 'ingredient') {
    if (item.id === 'glutenpowder') return 'gyeolchak';
    if (item.id === 'fishmeal' || item.id === 'attractor') return 'eosim';
    if (item.id === 'bran' || item.id === 'cornmeal' || item.id === 'barley' || item.id === 'strawberry') return 'deurhyang';
    return 'sodam';
  }
  if (kind === 'net' || kind === 'keepnet') {
    if (n(item, 'price') === 0) return 'sodam';
    if (kind === 'net' ? n(item, 'maxKg') >= 60 || n(item, 'price') >= 10000 : n(item, 'capacity') >= 200 || n(item, 'price') >= 5500) return 'baekun';
    return 'geumulmok';
  }
  return 'sodam';
}

export function productBrand(kind: BrandProductKind, item: BrandProduct): GameBrand {
  return gameBrand(brandIdForProduct(kind, item));
}

function numberFromName(name: string, suffix: string): string | undefined {
  return name.match(new RegExp(`([\\d.]+)${suffix}`))?.[1];
}

function brandedName(kind: BrandProductKind, item: BrandProduct, brand: GameBrand): string {
  const original = item.name;
  if (kind === 'rod') {
    const length = n(item, 'length');
    const series = n(item, 'power') >= 20 ? '초대물 강공' : n(item, 'power') >= 7 ? '중량 허리' : n(item, 'flex') >= 2.2 ? '깊은 휨' : length <= 4.5 ? '연안' : length >= 7.5 ? '장척' : '균형';
    return `${brand.name} ${series} ${length.toFixed(2)}m 낚싯대`;
  }
  if (kind === 'float') {
    const shape = ({ stick: '막대', short: '단찌', slim: '저부력', egg: '안정', long: '장찌', reed: '갈대', peacock: '공작', electro: '전자' } as Record<string, string>)[s(item, 'shape')] ?? '균형';
    const light = item.light ? (item.light === 'electro' ? ' 발광' : ' 케미') : '';
    return `${brand.name} ${shape}${light} ${n(item, 'notches') || 10}마디찌`;
  }
  if (kind === 'line') {
    const namedSize = numberFromName(original, '호');
    const diameter = n(item, 'diameterMm') || 0.235;
    const size = namedSize ?? (diameter <= 0.18 ? '1' : diameter <= 0.22 ? '1.5' : diameter <= 0.25 ? '2' : diameter <= 0.29 ? '2.5' : diameter <= 0.36 ? '4' : diameter <= 0.42 ? '6' : '8');
    const material = item.material === 'fluorocarbon' ? '카본' : item.material === 'braid' ? '합사' : '나일론';
    return `${brand.name} ${material} 원줄 ${size}호`;
  }
  if (kind === 'hook') {
    if (item.modelName && item.size) return `${item.modelName} ${item.size}호`;
    const number = numberFromName(original, '호') ?? String(Math.max(3, Math.round(n(item, 'gapMm') || n(item, 'hold') * 5)));
    const series = n(item, 'hold') >= 3.2 ? '강축' : n(item, 'sharpness') >= 1.16 || item.shape === 'fine' ? '세축' : '표준';
    return `${brand.name} ${series} 바늘 ${number}호`;
  }
  if (kind === 'bait') {
    const safeNames: Record<string, string> = {
      worm: '지렁이', paste: '곡물떡밥', corn: '옥수수', gluten: '글루텐떡밥', pellet: '어분떡밥', shrimp: '민물새우',
    };
    const packName = safeNames[item.id] ?? safeNames[s(item, 'baseBait')] ?? '';
    if (item.origin === 'house') return `${brand.name} ${original.replace(/^버들못\s*/, '')}`;
    const productNames: Record<string, string> = {
      'kw-burger': '오곡 곡물떡밥', 'kw-aqua2': '담수 어분떡밥', 'kw-chum': '곡물·어분 배합떡밥',
      'toco-fish': '어분 글루텐', 'toco-vanilla': '바닐라 글루텐', 'toco-11': '분홍 어분떡밥',
      'mq-wata': '솜결 글루텐', 'mq-nozuri': '들글루텐', 'mq-imo': '고구마 글루텐',
      'mq-alpha21': '가벼운 글루텐', 'mq-ookoi': '잉어 어분떡밥',
    };
    return `${brand.name} ${productNames[item.id] ?? packName ?? '민물 미끼'}`;
  }
  if (kind === 'ingredient') {
    const names: Record<string, string> = { bran: '미강', cornmeal: '옥수수 가루', attractor: '새우분', fishmeal: '어분', glutenpowder: '글루텐 가루', barley: '보리 가루', strawberry: '딸기향 분말' };
    return `${brand.name} ${names[item.id] ?? '떡밥 재료'}`;
  }
  if (kind === 'net') return `${brand.name} ${n(item, 'maxKg') >= 60 ? '대물' : n(item, 'maxKg') >= 15 ? '넓은 망' : '기본'} 뜰채 ${n(item, 'maxKg')}kg`;
  return `${brand.name} ${n(item, 'capacity') >= 150 ? '장시간' : n(item, 'capacity') >= 50 ? '확장' : '기본'} 살림망 ${n(item, 'capacity')}마리`;
}

export function applyFictionalProductName<T extends BrandProduct>(kind: BrandProductKind, item: T): T {
  item.name = brandedName(kind, item, productBrand(kind, item));
  return item;
}

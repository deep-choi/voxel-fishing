import type { BaitId, SpeciesId } from './data';
import { createHouseBaits } from './baitExpansion';

/** 실제 모델의 조사 자료. 가격·해금·하중·입질 배율은 별도의 게임 수치다. */
export const BRANDS = {
  banax: '바낙스', silstar: '은성', apis: '아피스', marukyu: '마루큐',
  kyongwon: '경원', toco: '토코', gamakatsu: '가마카츠', owner: '오너', sunline: '선라인', haidon: '해동',
} as const;
export type BrandId = keyof typeof BRANDS;
export interface ProductInfo { brand: BrandId; source: string; sourceKind: 'official' | 'retailer'; facts: string }
export const SOURCES = {
  banax: 'https://banaxgallery.co.kr/sub_mall/list.php?cate=0005_',
  banaxClassic: 'https://www.banaxgallery.co.kr/sub_mall/list.php?cate=0005_&sort=sales_charts',
  silstar: 'https://silstar.co.kr/product/dia수향받침대/45/',
  silstarParts: 'https://silstar.co.kr/product/detail.html?product_no=90',
  apis: 'https://mw.apis.co.kr/mw_apis/sub_list.php?ac_id=96',
  apisNet: 'https://mw.apis.co.kr/mw_apis/sub_list.php?ac_id=1',
  apisZoom: 'https://mw.apis.co.kr/mw_apis/sub_list.php?ac_id=98',
  nylon: 'https://fishing.sunline.co.jp/line/265/',
  herabito: 'https://fishing.sunline.co.jp/line/263/',
  fluorocarbon: 'https://fishing.sunline.co.jp/line/23841/',
  owner: 'https://www.owner.co.jp/search/369/',
  gamakatsu: 'https://www.gamakatsu.co.jp/products/12-206/',
  kw: 'https://gwanmoon.com/category/경원/207/',
  kwRecipe: 'https://onefishing.co.kr/product/경원323-떡밥레시피-아쿠아텍2-찐버거1/30015/',
  toco: 'https://eosin.co.kr/product/토코-어분글루텐-고농축새우-토코떡밥-붕어떡밥/3349/',
  tocoVanilla: 'https://eosin.co.kr/product/토코-바닐라-어분글루텐-농축새우-토코떡밥-붕어떡밥/3551/',
  toco11: 'https://eosin.co.kr/product/토코-토코텍11-핑크-어분-토코떡밥-붕어-잉어-향어-떡밥/3907/',
  wata: 'https://www.marukyu.com/product/858/',
  nogluten: 'https://www.marukyu.com/product/864/',
  imo: 'https://www.marukyu.com/product/860/',
  a21: 'https://www.marukyu.com/product/859/',
  koi: 'https://www.marukyu.com/product/935/',
  haidonFloat: 'https://dasolfishing.co.kr/shop/shopbrand.html?mcode=007&type=X&xcode=088',
  haidonNet: 'https://www.coupang.com/vp/products/6691076004',
  haidonKeepnet: 'https://www.dasolfishing.co.kr/m/product.html?branduid=982068',
  haidonKeepnet50: 'https://m.jeilleisure.co.kr/product/list.html?cate_no=5268&page=1&sort_method=4',
} as const;
const official = (brand: BrandId, source: string, facts: string): ProductInfo => ({ brand, source, facts, sourceKind: 'official' });
const retailer = (brand: BrandId, source: string, facts: string): ProductInfo => ({ brand, source, facts, sourceKind: 'retailer' });
export const PRODUCT_INFO: Record<string, ProductInfo> = {
  'rod:starter': official('banax', SOURCES.banax, '강궁 SPECIAL · 민물대 제품군'),
  'rod:long': official('banax', SOURCES.banaxClassic, '하람 · 민물대 제품군'),
  'rod:light': official('banax', SOURCES.banaxClassic, '진궁 PRIME · 민물대 제품군'),
  'rod:carbon': official('banax', SOURCES.banax, 'IGNIS V2 · 민물대 제품군'),
  'rod:power': official('silstar', SOURCES.silstarParts, 'KDF신수향Ⅱ · 제조사 부품 목록으로 모델명 확인'),
  'rod:legend': official('apis', SOURCES.apis, '천년지기 프리미엄 · 민물 대물낚싯대'),
  'rod:mugung': official('banax', SOURCES.banax, '무궁 MASTER 초경 · 민물대 제품군'),
  'rod:grand': official('silstar', SOURCES.silstar, '그랜드 수향 · 제조사 수향 시리즈 설명에서 모델명 확인'),
  'rod:memphis': official('apis', SOURCES.apis, '멤피스 프로 · 민물 대물낚싯대'),
  'rod:gold': official('apis', SOURCES.apis, '천년지기 골드 · 민물 대물낚싯대'),
  'float:ha566': retailer('haidon', SOURCES.haidonFloat, 'HA-566 내림 붕어낚시 채비세트의 찌 구성품'),
  'net:mid': retailer('haidon', SOURCES.haidonNet, '카본 죽 20 ZOOM · 2단 민물뜰채'),
  'net:big': official('apis', SOURCES.apisNet, '블랙센스 옥내림뜰채 · 뜰채망 별도 판매'),
  'net:pro': official('apis', SOURCES.apisZoom, '천지인 줌 뜰채 · 게임에서는 망 포함'),
  'keepnet:mid': retailer('haidon', SOURCES.haidonKeepnet, 'HB-461 지트락 EVA 사각접이식 부력살림망'),
  'keepnet:big': retailer('haidon', SOURCES.haidonKeepnet50, 'HB-462 EVA 사각접이식 부력살림망 50'),
  'ingredient:fishmeal': retailer('kyongwon', SOURCES.kw, '아쿠아텍II(아쿠아텍2) · 집어/떡밥'),
  'ingredient:glutenpowder': official('marukyu', SOURCES.wata, '와타글루(わたグル) · 물속에서 부풀며 바늘에 남는 글루텐'),
};
for (const id of ['1.5', '2', '3', 'n1', 'n25']) PRODUCT_INFO[`line:${id}`] = official('sunline', SOURCES.nylon, '헤라 원줄 노즈리 · 나일론 · 실제 포장 50m');
for (const id of ['4', 'c2', 'c3', 'fc15', 'fc4']) PRODUCT_INFO[`line:${id}`] = official('sunline', SOURCES.fluorocarbon, '토네이도 V하드 · 플루오로카본 목줄 · 실제 포장 50m / 게임 공용줄');
PRODUCT_INFO['line:herabito'] = official('sunline', SOURCES.herabito, '헤라비토 원줄 · 민물 헤라 원줄 제품군');
for (const id of ['small', 'sharp', 'owner7']) PRODUCT_INFO[`hook:${id}`] = official('owner', SOURCES.owner, 'OH 갈색 헤라 개량스레 · 제조사 1~8호 목록');
for (const id of ['medium', 'large', 'monster', 'ise5', 'ise9']) PRODUCT_INFO[`hook:${id}`] = official('gamakatsu', SOURCES.gamakatsu, '이세니(伊勢尼) · 굵은 축, 안쪽으로 향한 바늘 끝 · 제조사 1~15호 목록');
export const catalogInfo = (kind: string, id: string) => PRODUCT_INFO[`${kind}:${id}`];

export interface BaitProduct extends Partial<ProductInfo> {
  id: string; name: string; baseBait: BaitId | 'chum'; count: number; price: number; level: number; desc: string;
  /** 자체 상품에는 실존 브랜드나 출처 링크를 붙이지 않는다. */
  origin?: 'house'; qualityTier?: 1 | 2 | 3 | 4 | 5; purpose?: string;
  speciesAffinity?: Partial<Record<SpeciesId, number>>;
  chumFlavor?: BaitId;
  /** 실제 제품의 효능 수치가 아니라 게임에서 제품을 구별하는 배율 */
  biteScale: number; chumScale: number;
}
export const BAIT_PRODUCTS: BaitProduct[] = [
  { ...retailer('kyongwon', SOURCES.kw, '찐버거 · 국내 판매 제품명 확인'), id: 'kw-burger', name: '경원 찐버거', baseBait: 'paste', count: 20, price: 80, level: 1, desc: '붕어용 곡물 계열 바늘 떡밥', biteScale: 1.06, chumScale: 1.1 },
  { ...retailer('kyongwon', SOURCES.kw, '아쿠아텍II · 국내 판매 제품명 확인'), id: 'kw-aqua2', name: '경원 아쿠아텍2', baseBait: 'pellet', count: 20, price: 100, level: 1, desc: '잉어·향어 공략용 어분 계열 떡밥', biteScale: 1.08, chumScale: 1.2 },
  { ...retailer('kyongwon', SOURCES.kwRecipe, '아쿠아텍2·찐버거1 혼합 판매 구성 · 혼합 비율은 게임용'), id: 'kw-chum', name: '경원 아쿠아텍2·찐버거 배합', baseBait: 'chum', count: 10, price: 110, level: 1, desc: '찌 주변에 뿌리는 배합 집어 떡밥', biteScale: 1, chumScale: 1.15 },
  { ...retailer('toco', SOURCES.toco, '어분글루텐 · 판매 표기 300g'), id: 'toco-fish', name: '토코 어분글루텐', baseBait: 'gluten', count: 20, price: 110, level: 1, desc: '글루텐 결합력에 어분 향을 더한 바늘 떡밥', biteScale: 1.1, chumScale: 1.15 },
  { ...retailer('toco', SOURCES.tocoVanilla, '바닐라 어분글루텐 · 국내 판매 제품명 확인'), id: 'toco-vanilla', name: '토코 바닐라 어분글루텐', baseBait: 'gluten', count: 20, price: 130, level: 2, desc: '향을 달리해 붕어를 노리는 글루텐 떡밥', biteScale: 1.15, chumScale: 1.1 },
  { ...retailer('toco', SOURCES.toco11, '토코텍11 핑크 어분 · 판매 표기 400g'), id: 'toco-11', name: '토코 토코텍11', baseBait: 'chum', count: 10, price: 120, level: 2, desc: '붕어·잉어·향어용 어분 집어 떡밥', biteScale: 1, chumScale: 1.3 },
  { ...official('marukyu', SOURCES.wata, 'わたグル · 물속에서 솜처럼 부풀며 바늘에 잔존'), id: 'mq-wata', name: '마루큐 와타글루', baseBait: 'gluten', count: 20, price: 120, level: 1, desc: '바늘에 남는 글루텐 섬유로 붕어 입질을 기다린다', biteScale: 1.12, chumScale: 1 },
  { ...official('marukyu', SOURCES.nogluten, '野釣りグルテン · 고구마 매시, 아미노산·마늘 성분'), id: 'mq-nozuri', name: '마루큐 노즈리 글루텐', baseBait: 'gluten', count: 20, price: 140, level: 2, desc: '노지 붕어의 바닥낚시용 글루텐 떡밥', biteScale: 1.16, chumScale: 1.2 },
  { ...official('marukyu', SOURCES.imo, 'いもグルテン · 제조사 내용량 250g'), id: 'mq-imo', name: '마루큐 이모글루텐', baseBait: 'gluten', count: 20, price: 100, level: 1, desc: '바닥 자리에서 붕어를 노리는 글루텐 떡밥', biteScale: 1.08, chumScale: 1.05 },
  { ...official('marukyu', SOURCES.a21, 'グルテンα21 · 가벼운 에사, 오래 기다리는 낚시용'), id: 'mq-alpha21', name: '마루큐 글루텐 α21', baseBait: 'gluten', count: 20, price: 160, level: 3, desc: '예민한 붕어용 가벼운 글루텐 떡밥', biteScale: 1.2, chumScale: 0.95 },
  { ...official('marukyu', SOURCES.koi, '大ごい · 실제 포장 300g / 덕용 1,000g · 잉어 찌낚시 겸용'), id: 'mq-ookoi', name: '마루큐 오끼고이', baseBait: 'pellet', count: 20, price: 140, level: 2, desc: '잉어용 배합 떡밥. 게임에서는 어분 계열로 사용', biteScale: 1.18, chumScale: 1.25 },
];
BAIT_PRODUCTS.find(p => p.id === 'kw-chum')!.chumFlavor = 'paste';
BAIT_PRODUCTS.find(p => p.id === 'toco-11')!.chumFlavor = 'pellet';
BAIT_PRODUCTS.push(...createHouseBaits());
export const baitProduct = (id?: string) => BAIT_PRODUCTS.find(p => p.id === id);
for (const p of BAIT_PRODUCTS) if (p.brand && p.source && p.sourceKind && p.facts) {
  PRODUCT_INFO[`bait:${p.id}`] = { brand: p.brand, source: p.source, sourceKind: p.sourceKind, facts: p.facts };
}

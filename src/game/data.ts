import { createExtraSpecies } from './extraSpecies';
import { SIZE_RANKS } from './sizeRanks';
import { FISH_LOOKS, type FishLook } from './fishArt';
export type { FishLook } from './fishArt';
// 어종과 채비 데이터. 수심·출현율·장비 수치는 게임 밸런스다.

export type BaitId = 'worm' | 'paste' | 'corn' | 'gluten' | 'pellet' | 'shrimp';
export type ExtraSpeciesId = 'catfish' | 'yellowcat' | 'snakehead' | 'mandarin' | 'bass';
export type SpeciesId = 'crucian' | 'carp' | 'mirror' | 'bluegill' | ExtraSpeciesId;
/** 입질 모양: 붕어 찌올림 / 잉어 끌고 들어감 / 블루길 깔짝깔짝 */
export type BiteStyle = 'rise' | 'sink' | 'jitter' | 'drag' | 'dart';

export interface Bait {
  id: BaitId;
  name: string;
  desc: string;
  /** 같은 자리에 계속 던지면 물고기를 모으는 효과 (집어) */
  chum: number;
  unit?: '개' | '마리';
}

export const BAITS: Record<BaitId, Bait> = {
  worm: { id: 'worm', name: '지렁이', desc: '거의 모든 물고기가 먹는다. 잔챙이도 잘 덤빈다.', chum: 0, unit: '마리' },
  paste: { id: 'paste', name: '곡물떡밥', desc: '붕어·잉어용. 같은 자리에 계속 던지면 고기가 모인다.', chum: 1 },
  corn: { id: 'corn', name: '옥수수', desc: '잉어가 좋아한다. 잔챙이 입질이 적다.', chum: 0.3 },
  gluten: { id: 'gluten', name: '글루텐떡밥', desc: '붕어 찌낚시용. 바늘에 남아 천천히 풀어진다.', chum: 0.55 },
  pellet: { id: 'pellet', name: '어분떡밥', desc: '잉어·향어용. 물속에서 어분 향이 퍼진다.', chum: 1.3 },
  shrimp: { id: 'shrimp', name: '민물새우', desc: '메기·쏘가리 같은 육식성 어종을 노린다.', chum: 0, unit: '마리' },
};
export const BAIT_IDS = Object.keys(BAITS) as BaitId[];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
/** 상점·가방에서 공통으로 쓰는 등급과 해금 레벨 */
export interface GearMeta { rarity: Rarity; level: number }

export interface LineSpec extends GearMeta {
  id: string;
  name: string;
  /** 끊어지는 힘 (kgf) */
  strength: number;
  /** 줄이 굵을수록 예민한 물고기가 덜 문다 (어종별 shy와 곱해짐) */
  visibility: number;
  price: number;
  desc: string;
}

// 순서가 저장된 lineIdx와 이어지므로 새 원줄은 뒤에 붙인다.
// 실제 모델명·출처는 realCatalog.ts. 가격·하중·길이는 게임 규격이다.
export const LINES: LineSpec[] = [
  { id: '1.5', name: '선라인 헤라 원줄 노즈리 1.5호', strength: 2.7, visibility: 0, price: 0, level: 1, rarity: 'common', desc: '가늘어 예민한 붕어도 잘 문다' },
  { id: '2', name: '선라인 헤라 원줄 노즈리 2호', strength: 3.6, visibility: 0.12, price: 0, level: 1, rarity: 'common', desc: '붕어 찌낚시 기본 원줄' },
  { id: '3', name: '선라인 헤라 원줄 노즈리 3호', strength: 5.4, visibility: 0.3, price: 120, level: 2, rarity: 'common', desc: '잉어가 섞이는 자리용' },
  { id: '4', name: '선라인 토네이도 V하드 4호', strength: 7.2, visibility: 0.45, price: 240, level: 4, rarity: 'uncommon', desc: '대물 잉어·가물치를 버틴다' },
  { id: 'c2', name: '선라인 토네이도 V하드 2호', strength: 4.1, visibility: 0.04, price: 600, level: 5, rarity: 'rare', desc: '물속에서 잘 안 보이고 빨리 가라앉는다' },
  { id: 'c3', name: '선라인 토네이도 V하드 3호', strength: 6.3, visibility: 0.14, price: 1100, level: 7, rarity: 'epic', desc: '굵기 대비 질기고 눈에 덜 띈다' },
];

LINES.push(
  { id: 'n1', name: '선라인 헤라 원줄 노즈리 1호', strength: 1.9, visibility: 0, price: 80, level: 1, rarity: 'common', desc: '얕은 물의 예민한 붕어용. 큰 잉어에는 조심' },
  { id: 'n25', name: '선라인 헤라 원줄 노즈리 2.5호', strength: 4.5, visibility: 0.2, price: 200, level: 2, rarity: 'uncommon', desc: '붕어와 중형 잉어 사이의 균형' },
  { id: 'herabito', name: '선라인 헤라비토 원줄', strength: 4.2, visibility: 0.09, price: 480, level: 3, rarity: 'rare', desc: '민물 헤라 원줄. 게임에서는 예민한 붕어와 중형어에 맞춤' },
  { id: 'fc15', name: '선라인 토네이도 V하드 1.5호', strength: 3.1, visibility: 0.01, price: 440, level: 3, rarity: 'rare', desc: '플루오로카본 목줄을 게임의 공용줄로 사용' },
  { id: 'fc4', name: '선라인 토네이도 V하드 4호 대물 채비', strength: 8.6, visibility: 0.24, price: 1600, level: 8, rarity: 'epic', desc: '같은 실제 모델의 게임 대물 세팅. 하중은 게임 수치' },
);

/** 민장대 (릴 없는 붕어 찌낚싯대). 게임에서 1칸 = 1.8m */
export const ROD = {
  id: 'starter',
  name: '바낙스 강궁 SPECIAL',
  length: 5.76,
  /** 원줄 길이: 대 길이보다 조금 짧게 */
  line: 5.4,
  /** 낚싯대가 끝까지 휘는 힘 (kgf) */
  power: 2.6,
  /** 대가 휘며 받아 주는 길이 (m) */
  flex: 1.3,
};

/** 휨새(조자): 1에 가까울수록 경질(7:3, 끝에서만 휨), 0에 가까울수록 연질(5:5, 허리까지 휨) */
export const ROD_ACTION: Record<string, number> = { starter: 0.55, long: 0.5, power: 0.68, light: 0.42, carbon: 0.78, legend: 0.6 };
export const rodAction = (id: string) => ROD_ACTION[id] ?? 0.6;
export interface RodSpec extends GearMeta { id: string; name: string; length: number; line: number; power: number; flex: number; price: number; desc: string }
export const RODS: RodSpec[] = [
  { ...ROD, price: 180, level: 1, rarity: 'common', desc: '가볍고 부드러운 기본 낚싯대' },
  { id: 'long', name: '바낙스 하람', length: 7.2, line: 8.6, power: 3.2, flex: 1.6, price: 650, level: 3, rarity: 'uncommon', desc: '긴 원줄로 먼 포인트와 깊은 수심 공략' },
  { id: 'power', name: '은성 KDF신수향Ⅱ', length: 6.48, line: 9.4, power: 5.2, flex: 1.8, price: 950, level: 5, rarity: 'rare', desc: '깊은 곳의 큰 잉어와 향어를 위한 긴 원줄 채비' },
  { id: 'light', name: '바낙스 진궁 PRIME', length: 4.68, line: 4.3, power: 2.0, flex: 1.1, price: 120, level: 1, rarity: 'common', desc: '짧고 가벼워 얕은 연안 붕어를 노린다' },
  { id: 'carbon', name: '바낙스 IGNIS V2', length: 6.84, line: 7.8, power: 4.0, flex: 1.5, price: 2400, level: 7, rarity: 'epic', desc: '반발력이 좋아 잉어·향어를 빨리 띄운다' },
  { id: 'legend', name: '아피스 천년지기 프리미엄', length: 7.92, line: 10.5, power: 6.5, flex: 2.0, price: 6800, level: 10, rarity: 'legendary', desc: '긴 대로 깊은 포인트와 대물을 노린다' },
];
export interface FloatSpec extends GearMeta { id: string; name: string; sensitivity: number; sinkSpeed: number; scale: number; price: number; desc: string; glow?: number }
export const FLOATS: FloatSpec[] = [
  { id: 'basic', name: '막대찌', sensitivity: 1, sinkSpeed: 0.4, scale: 1, price: 0, level: 1, rarity: 'common', desc: '균형 잡힌 기본 찌' },
  { id: 'sensitive', name: '예민한 저부력찌', sensitivity: 1.4, sinkSpeed: 0.3, scale: 0.8, price: 220, level: 2, rarity: 'uncommon', desc: '작은 입질도 크게 보이지만 천천히 가라앉는다' },
  { id: 'deep', name: '깊은 수심용 찌', sensitivity: 0.8, sinkSpeed: 0.7, scale: 1.2, price: 320, level: 4, rarity: 'uncommon', desc: '빠르게 자리 잡고 깊은 곳을 공략한다' },
  { id: 'night', name: '케미 야광찌', sensitivity: 1.1, sinkSpeed: 0.45, scale: 1, price: 420, level: 3, rarity: 'rare', glow: 1.6, desc: '케미라이트를 꽂아 밤에도 찌톱이 보인다' },
  { id: 'electro', name: '고감도 전자찌', sensitivity: 1.5, sinkSpeed: 0.4, scale: 1, price: 1200, level: 6, rarity: 'epic', glow: 3, desc: '밤에 밝게 빛나고 작은 입질도 크게 보인다' },
];
export interface HookSpec extends GearMeta { id: string; name: string; hold: number; attraction: number; price: number; desc: string }
export const HOOKS: HookSpec[] = [
  { id: 'small', name: '오너 OH 갈색 헤라 개량스레 5호', hold: 0.9, attraction: 1.1, price: 0, level: 1, rarity: 'common', desc: '붕어와 작은 물고기에게 유리' },
  { id: 'medium', name: '가마카츠 이세니 7호', hold: 1.15, attraction: 1, price: 160, level: 2, rarity: 'common', desc: '붕어와 잉어를 함께 노린다' },
  { id: 'large', name: '가마카츠 이세니 10호', hold: 1.5, attraction: 0.8, price: 280, level: 4, rarity: 'uncommon', desc: '큰 물고기를 단단히 걸지만 잔챙이 입질은 줄어든다' },
  { id: 'sharp', name: '오너 OH 갈색 헤라 개량스레 4호', hold: 1.1, attraction: 1.25, price: 520, level: 5, rarity: 'rare', desc: '바늘 끝이 날카로워 약한 입질에도 박힌다' },
  { id: 'monster', name: '가마카츠 이세니 13호', hold: 1.9, attraction: 0.72, price: 1500, level: 8, rarity: 'epic', desc: '메기·가물치 대물도 빠지지 않는다' },
];
export const BAIT_PACKS = [
  { id: 'worm', name: '지렁이 10마리', count: 10, price: 30 },
  { id: 'paste', name: '곡물떡밥 10회분', count: 10, price: 40 },
  { id: 'corn', name: '옥수수 10알', count: 10, price: 35 },
  { id: 'chum', name: '기본 집어 떡밥 5회분', count: 5, price: 60 },
  { id: 'gluten', name: '기본 글루텐떡밥 10회분', count: 10, price: 45 },
  { id: 'pellet', name: '기본 어분떡밥 10회분', count: 10, price: 50 },
  { id: 'shrimp', name: '민물새우 10마리', count: 10, price: 65 },
] as const;

// 실제 제품군에 게임 규격을 붙인다. 제조사 하중 사양으로 해석하지 않는다.
RODS.push(
  { id: 'memphis', name: '아피스 멤피스 프로', length: 5.4, line: 5.2, power: 3.3, flex: 1.35, price: 380, level: 2, rarity: 'uncommon', desc: '게임 3.0칸. 붕어와 중형 잉어용 짧은 대물대' },
  { id: 'grand', name: '은성 그랜드 수향', length: 6.12, line: 6.0, power: 3.8, flex: 1.55, price: 780, level: 4, rarity: 'rare', desc: '게임 3.4칸. 부드러운 휨으로 급한 돌진을 받는다' },
  { id: 'gold', name: '아피스 천년지기 골드', length: 6.84, line: 7.4, power: 4.6, flex: 1.7, price: 1900, level: 6, rarity: 'epic', desc: '게임 3.8칸. 수초 옆 대물 잉어 공략' },
  { id: 'mugung', name: '바낙스 무궁 MASTER 초경', length: 7.2, line: 8.2, power: 5.6, flex: 1.75, price: 3900, level: 8, rarity: 'epic', desc: '게임 4.0칸. 깊은 좌대에서 큰 고기를 제압한다' },
);
HOOKS.push(
  { id: 'ise5', name: '가마카츠 이세니 5호', hold: 1.02, attraction: 1.12, price: 110, level: 1, rarity: 'common', desc: '작은 미끼로 붕어와 중형어를 노린다' },
  { id: 'ise9', name: '가마카츠 이세니 9호', hold: 1.4, attraction: 0.9, price: 360, level: 3, rarity: 'uncommon', desc: '옥수수·어분 채비로 잉어를 노린다' },
  { id: 'owner7', name: '오너 OH 갈색 헤라 개량스레 7호', hold: 1.25, attraction: 1.08, price: 340, level: 3, rarity: 'rare', desc: '글루텐 떡밥을 사용하는 민물 찌낚시용' },
);
FLOATS.push({ id: 'ha566', name: '해동 HA-566 내림찌', sensitivity: 1.3, sinkSpeed: 0.55, scale: 0.85, price: 280, level: 2, rarity: 'uncommon', desc: '내림 붕어낚시 채비세트의 찌를 게임에서 단독 장착' });

export const MAX_DEPLOYED_RODS = 3;
export const INGREDIENTS = [
  { id: 'bran', name: '미강', desc: '곡물떡밥과 집어제의 기본 재료', price: 25, count: 10 },
  { id: 'cornmeal', name: '옥수수 가루', desc: '곡물 향과 먹이 입자를 더한다', price: 35, count: 10 },
  { id: 'attractor', name: '새우분', desc: '집어 떡밥에 새우 향을 더한다', price: 45, count: 5 },
  { id: 'fishmeal', name: '경원 아쿠아텍2', desc: '어분 떡밥. 잉어·향어용 바늘 떡밥 재료', price: 40, count: 10 },
  { id: 'glutenpowder', name: '마루큐 와타글루 배합 재료', desc: '글루텐이 많아 바늘에 오래 붙는다. 떡밥의 결합력을 높인다', price: 35, count: 10 },
] as const;
export type IngredientId = typeof INGREDIENTS[number]['id'];
export const FEED_RECIPES: { id: string; name: string; materials: Partial<Record<IngredientId, number>>; yield: number; bait: BaitId | 'chum' }[] = [
  { id: 'grain', name: '곡물 집어 떡밥', materials: { bran: 2, cornmeal: 1 }, yield: 3, bait: 'chum' },
  { id: 'aroma', name: '새우분 집어 떡밥', materials: { bran: 2, cornmeal: 2, attractor: 1 }, yield: 5, bait: 'chum' },
  { id: 'hook-grain', name: '곡물떡밥', materials: { bran: 2, cornmeal: 1 }, yield: 4, bait: 'paste' },
  { id: 'hook-gluten', name: '글루텐떡밥', materials: { glutenpowder: 2, cornmeal: 1 }, yield: 5, bait: 'gluten' },
  { id: 'hook-fishmeal', name: '어분떡밥', materials: { fishmeal: 2, bran: 1 }, yield: 5, bait: 'pellet' },
];


export interface Species {
  id: SpeciesId;
  name: string;
  /** 길이 분포 (cm): 중앙값, 퍼짐(로그정규), 최소, 최대 */
  len: { median: number; sigma: number; min: number; max: number };
  /** 무게(g) = a × 길이(cm)^b */
  wa: number;
  wb: number;
  /** 사는 수심 (m): 최소, 가장 좋은, 최대 */
  depth: [number, number, number];
  /** 바닥 미끼 선호 (1 = 바닥에만, 0 = 상관없음) */
  bottom: number;
  baits: Record<BaitId, number>;
  /** 이상적인 조건에서 분당 입질 수 */
  abundance: number;
  /** 굵은 줄을 꺼리는 정도 */
  shy: number;
  /** 몸무게 1kg당 당기는 힘 (kgf) */
  power: number;
  /** 최고 속도 (m/s) */
  speed: number;
  /** 버티는 시간 (초, 1kg 기준 + kg당) */
  stamina: [number, number];
  bite: BiteStyle;
  /** 기록 등급: [이름, 길이(cm)] 큰 순 */
  ranks: [string, number][];
  look: FishLook;
}

const BASE_SPECIES: Record<'crucian' | 'carp' | 'bluegill', Species> = {
  crucian: {
    id: 'crucian',
    name: '붕어',
    len: { median: 21, sigma: 0.24, min: 9, max: 55 },
    wa: 0.0186,
    wb: 3.0,
    depth: [0.6, 2.0, 4.5],
    bottom: 0.85,
    baits: { worm: 1.0, paste: 1.15, corn: 0.35, gluten: 1.4, pellet: 0.6, shrimp: 0.75 },
    abundance: 1.0,
    shy: 1.0,
    power: 1.7,
    speed: 1.6,
    stamina: [11, 14],
    bite: 'rise',
    ranks: SIZE_RANKS.crucian,
    look: FISH_LOOKS.crucian,
  },
  carp: {
    id: 'carp',
    name: '잉어',
    len: { median: 52, sigma: 0.24, min: 28, max: 110 },
    wa: 0.0135,
    wb: 3.05,
    depth: [1.4, 3.6, 7],
    bottom: 0.95,
    baits: { worm: 0.55, paste: 1.0, corn: 1.4, gluten: 0.65, pellet: 1.3, shrimp: 0.4 },
    abundance: 0.28,
    shy: 0.55,
    power: 1.45,
    speed: 3.0,
    stamina: [16, 6],
    bite: 'sink',
    ranks: SIZE_RANKS.carp,
    look: FISH_LOOKS.carp,
  },
  bluegill: {
    id: 'bluegill',
    name: '블루길',
    len: { median: 13, sigma: 0.2, min: 6, max: 25 },
    wa: 0.0158,
    wb: 3.1,
    depth: [0.4, 1.5, 3.5],
    bottom: 0.2,
    baits: { worm: 1.6, paste: 0.35, corn: 0.05, gluten: 0.15, pellet: 0.25, shrimp: 1.25 },
    abundance: 1.25,
    shy: 0.2,
    power: 2.4,
    speed: 1.3,
    stamina: [6, 20],
    bite: 'jitter',
    ranks: SIZE_RANKS.bluegill,
    look: FISH_LOOKS.bluegill,
  },
};

export const SPECIES: Record<SpeciesId, Species> = { ...BASE_SPECIES,
  ...createExtraSpecies(),
  mirror: { ...BASE_SPECIES.carp, id: 'mirror', name: '향어',
    len: { median: 45, sigma: 0.26, min: 22, max: 90 }, depth: [1.8, 4.8, 8],
    baits: { worm: 0.35, paste: 1.45, corn: 0.8, gluten: 0.4, pellet: 1.7, shrimp: 0.3 }, abundance: 0.42, power: 1.65,
    stamina: [18, 7], ranks: SIZE_RANKS.mirror,
    look: FISH_LOOKS.mirror },
};
export const SPECIES_LIST = Object.values(SPECIES);

export function weightKg(sp: Species, cm: number): number {
  return (sp.wa * Math.pow(cm, sp.wb)) / 1000;
}

/** 길이 → 기록 등급 이름 (없으면 null) */
export function rankOf(sp: Species, cm: number): string | null {
  for (const [name, min] of sp.ranks) if (cm >= min) return name;
  return null;
}

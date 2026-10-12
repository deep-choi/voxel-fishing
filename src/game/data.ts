import { createExtraSpecies } from './extraSpecies';
import { createExpandedSpecies } from './speciesExpansion';
import { SIZE_RANKS } from './sizeRanks';
import { EXPANDED_FLOATS, EXPANDED_HOOKS, EXPANDED_LINES, EXPANDED_RODS, EXPANDED_ROD_ACTION } from './gearExpansion';
import { SPECIALIST_HOOKS } from './hookCatalog';
import { FISH_LOOKS, type FishLook } from './fishArt';
export type { FishLook } from './fishArt';
// 어종과 채비 데이터. 수심·출현율·장비 수치는 게임 밸런스다.

export type BaitId = 'worm' | 'paste' | 'corn' | 'gluten' | 'pellet' | 'shrimp';
export type ExtraSpeciesId = 'catfish' | 'yellowcat' | 'snakehead' | 'mandarin' | 'bass';
export type ExpandedSpeciesId = 'hera' | 'nuchi' | 'koi' | 'leather' | 'bredmirror' | 'grasscarp';
export type SpeciesId = 'crucian' | 'carp' | 'mirror' | 'bluegill' | ExtraSpeciesId | ExpandedSpeciesId;
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
export interface GearMeta { rarity: Rarity; level: number; purpose?: string }

export type LineMaterial = 'nylon' | 'fluorocarbon' | 'braid';
export interface LineSpec extends GearMeta {
  id: string;
  name: string;
  material: LineMaterial;
  /** 끊어지는 힘 (kgf) */
  strength: number;
  /** 줄이 굵을수록 예민한 물고기가 덜 문다 (어종별 shy와 곱해짐) */
  visibility: number;
  /** 게임 채비 계산용 실제 굵기(mm). 저장된 원줄 순서와 별도로 관리한다. */
  diameterMm?: number;
  price: number;
  desc: string;
}

// 순서가 저장된 lineIdx와 이어지므로 새 원줄은 뒤에 붙인다.
// 실제 모델명·출처는 realCatalog.ts. 가격·하중·길이는 게임 규격이다.
export const LINES: LineSpec[] = [
  { id: '1.5', name: '선라인 헤라 원줄 노즈리 1.5호', strength: 2.7, material: 'nylon', visibility: 0, price: 0, level: 1, rarity: 'common', desc: '가늘어 예민한 붕어도 잘 문다' },
  { id: '2', name: '선라인 헤라 원줄 노즈리 2호', strength: 3.6, material: 'nylon', visibility: 0.12, price: 0, level: 1, rarity: 'common', desc: '붕어 찌낚시 기본 원줄' },
  { id: '3', name: '선라인 헤라 원줄 노즈리 3호', strength: 5.4, material: 'nylon', visibility: 0.3, price: 120, level: 2, rarity: 'common', desc: '잉어가 섞이는 자리용' },
  { id: '4', name: '선라인 토네이도 V하드 4호', strength: 8.6, material: 'fluorocarbon', visibility: 0.24, price: 1250, level: 4, rarity: 'rare', desc: '대물 잉어·가물치를 버틴다' },
  { id: 'c2', name: '선라인 토네이도 V하드 2호', strength: 4.1, material: 'fluorocarbon', visibility: 0.04, price: 600, level: 4, rarity: 'rare', desc: '물속에서 잘 안 보이고 빨리 가라앉는다' },
  { id: 'c3', name: '선라인 토네이도 V하드 3호', strength: 6.3, material: 'fluorocarbon', visibility: 0.14, price: 1100, level: 4, rarity: 'rare', desc: '굵기 대비 질기고 눈에 덜 띈다' },
];

LINES.push(
  { id: 'n1', name: '선라인 헤라 원줄 노즈리 1호', strength: 1.9, material: 'nylon', visibility: 0, price: 80, level: 1, rarity: 'common', desc: '얕은 물의 예민한 붕어용. 큰 잉어에는 조심' },
  { id: 'n25', name: '선라인 헤라 원줄 노즈리 2.5호', strength: 4.5, material: 'nylon', visibility: 0.2, price: 100, level: 2, rarity: 'common', desc: '붕어와 중형 잉어 사이의 균형' },
  { id: 'herabito', name: '선라인 헤라비토 원줄', strength: 4.2, material: 'nylon', visibility: 0.09, price: 480, level: 3, rarity: 'rare', desc: '민물 헤라 원줄. 게임에서는 예민한 붕어와 중형어에 맞춤' },
  { id: 'fc15', name: '선라인 토네이도 V하드 1.5호', strength: 3.1, material: 'fluorocarbon', visibility: 0.01, price: 440, level: 4, rarity: 'rare', desc: '플루오로카본 목줄을 게임의 공용줄로 사용' },
  { id: 'fc4', name: '선라인 토네이도 V하드 4호 대물 채비', strength: 8.6, material: 'fluorocarbon', visibility: 0.24, price: 1250, level: 4, rarity: 'rare', desc: '같은 실제 모델의 게임 대물 세팅. 하중은 게임 수치' },
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
/** 찌 몸통 모양 (render/tackle.ts·아이콘이 같은 값을 쓴다) */
export type FloatShape = 'stick' | 'short' | 'slim' | 'egg' | 'long' | 'reed' | 'peacock' | 'electro';
export interface FloatSpec extends GearMeta {
  id: string; name: string; sensitivity: number; sinkSpeed: number; scale: number; price: number; desc: string;
  /** 밤 밝기 (케미·전자찌) */
  glow?: number;
  shape?: FloatShape;
  /** 찌톱 마디 수 (한 마디 약 2cm). 길수록 올림이 길게 보인다. 기본 10 */
  notches?: number;
  /** 물결·바람에 흔들리는 정도 배수. 짧고 굵을수록 작다. 기본 1 */
  sway?: number;
  /** 불빛: 케미라이트를 꽂는 찌 / 전지로 켜는 전자찌 */
  light?: 'chemi' | 'electro';
  glowColor?: string;
  /** 변색 전자찌: 찌가 올라오면 바뀌는 색 */
  shift?: string;
}
export const FLOATS: FloatSpec[] = [
  { id: 'basic', name: '막대찌', shape: 'stick', sensitivity: 1, sinkSpeed: 0.4, scale: 1, price: 0, level: 1, rarity: 'common', desc: '균형 잡힌 기본 오동나무 막대찌' },
  { id: 'short', name: '단찌', shape: 'short', notches: 6, sway: 0.55, sensitivity: 0.9, sinkSpeed: 0.6, scale: 0.9, price: 150, level: 1, rarity: 'common', desc: '찌톱이 짧고 몸통이 굵어 바람·물결에 덜 흔들린다. 얕은 연안용' },
  { id: 'sensitive', name: '나노 저부력찌', shape: 'slim', notches: 12, sway: 1.25, sensitivity: 1.4, sinkSpeed: 0.3, scale: 0.8, price: 220, level: 2, rarity: 'uncommon', desc: '가늘고 가벼워 작은 입질도 크게 보이지만 천천히 서고 물결을 탄다' },
  { id: 'reed', name: '갈대찌', shape: 'reed', notches: 11, sensitivity: 1.25, sinkSpeed: 0.42, scale: 1, price: 260, level: 2, rarity: 'uncommon', desc: '가볍고 부력 좋은 갈대 몸통. 올림이 시원하게 보인다' },
  { id: 'deep', name: '대물 올림찌', shape: 'egg', sway: 0.8, sensitivity: 0.8, sinkSpeed: 0.7, scale: 1.2, price: 320, level: 4, rarity: 'uncommon', desc: '몸통이 굵어 빨리 자리 잡고 깊은 곳·무거운 채비를 버틴다' },
  { id: 'long', name: '장찌', shape: 'long', notches: 15, sway: 1.1, sensitivity: 1.2, sinkSpeed: 0.5, scale: 1.1, price: 380, level: 3, rarity: 'uncommon', desc: '찌톱이 길어 쭈욱 올라오는 본신이 길게 보인다. 깊은 수심·먼 거리' },
  { id: 'peacock', name: '공작찌', shape: 'peacock', notches: 12, sway: 0.9, sensitivity: 1.35, sinkSpeed: 0.45, scale: 1, price: 680, level: 4, rarity: 'rare', desc: '공작 깃 몸통이라 가볍고 곧게 선다. 예민하면서도 덜 흔들린다' },
  { id: 'night', name: '케미 막대찌', shape: 'stick', light: 'chemi', sensitivity: 1.1, sinkSpeed: 0.45, scale: 1, price: 420, level: 3, rarity: 'rare', glow: 1.6, desc: '찌톱 끝에 케미라이트를 꽂아 밤에도 연두빛으로 보인다' },
  { id: 'chemiLong', name: '케미 장찌', shape: 'long', light: 'chemi', notches: 15, sway: 1.1, sensitivity: 1.25, sinkSpeed: 0.5, scale: 1.1, price: 720, level: 5, rarity: 'rare', glow: 1.8, desc: '긴 찌톱 끝 케미가 밤에 길게 솟아오른다' },
  { id: 'electro', name: '고감도 전자찌', shape: 'electro', light: 'electro', notches: 9, sensitivity: 1.5, sinkSpeed: 0.4, scale: 1, price: 1200, level: 6, rarity: 'epic', glow: 3, desc: '전지로 찌톱 LED가 밝게 빛나고 작은 입질도 크게 보인다' },
  { id: 'electroShift', name: '변색 전자찌', shape: 'electro', light: 'electro', notches: 12, sensitivity: 1.5, sinkSpeed: 0.45, scale: 1.05, price: 2600, level: 8, rarity: 'legendary', glow: 3, glowColor: '#ff4a3a', shift: '#4dff7a', desc: '찌가 올라오면 LED가 빨강에서 초록으로 바뀐다' },
];
/** 찌 특성 한 줄 (가방·상점·채비 화면) */
export function floatTraits(f: FloatSpec) {
  const sway = f.sway ?? 1;
  return [`찌톱 ${f.notches ?? 10}마디`, `예민함 ${f.sensitivity}`, sway < 0.95 ? '물결에 강함' : sway > 1.05 ? '물결에 약함' : '',
    f.light === 'electro' ? (f.shift ? '변색 LED' : 'LED 발광') : f.light === 'chemi' ? '케미 발광' : ''].filter(Boolean).join(' · ');
}
export interface HookSpec extends GearMeta {
  id: string; name: string; hold: number; attraction: number; price: number; desc: string; gapMm?: number;
  shape?: 'fine' | 'round' | 'long' | 'wide'; wireMm?: number; barbed?: boolean; sharpness?: number;
}
export const HOOKS: HookSpec[] = [
  { id: 'small', name: '오너 OH 갈색 헤라 개량스레 5호', hold: 0.9, attraction: 1.1, price: 0, level: 1, rarity: 'uncommon', desc: '붕어와 작은 물고기에게 유리' },
  { id: 'medium', name: '가마카츠 이세니 7호', hold: 1.15, attraction: 1, price: 160, level: 1, rarity: 'uncommon', desc: '붕어와 잉어를 함께 노린다' },
  { id: 'large', name: '가마카츠 이세니 10호', hold: 1.5, attraction: 0.8, price: 280, level: 1, rarity: 'uncommon', desc: '큰 물고기를 단단히 걸지만 잔챙이 입질은 줄어든다' },
  { id: 'sharp', name: '오너 OH 갈색 헤라 개량스레 4호', hold: 0.85, attraction: 1.25, price: 90, level: 1, rarity: 'uncommon', desc: '폭이 작아 작은 입의 붕어와 글루텐 떡밥에 맞는 무미늘 바늘' },
  { id: 'monster', name: '가마카츠 이세니 13호', hold: 1.9, attraction: 0.72, price: 400, level: 1, rarity: 'uncommon', desc: '큰 미끼를 다는 메기·가물치용. 작은 물고기는 삼키기 어렵다' },
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
  { id: 'ise5', name: '가마카츠 이세니 5호', hold: 1.02, attraction: 1.12, price: 110, level: 1, rarity: 'uncommon', desc: '작은 미끼로 붕어와 중형어를 노린다' },
  { id: 'ise9', name: '가마카츠 이세니 9호', hold: 1.4, attraction: 0.9, price: 230, level: 1, rarity: 'uncommon', desc: '옥수수·어분 채비로 잉어를 노린다' },
  { id: 'owner7', name: '오너 OH 갈색 헤라 개량스레 7호', hold: 1.25, attraction: 1.08, price: 140, level: 1, rarity: 'uncommon', desc: '글루텐 떡밥을 사용하는 민물 찌낚시용' },
);
FLOATS.push({ id: 'ha566', name: '해동 HA-566 내림찌', shape: 'slim', notches: 13, sway: 1.2, sensitivity: 1.3, sinkSpeed: 0.55, scale: 0.85, price: 280, level: 2, rarity: 'uncommon', desc: '내림 붕어낚시 채비세트의 찌를 게임에서 단독 장착' });

export const MAX_DEPLOYED_RODS = 3;
// 버들못 자체 게임 장비. 실제 제조사 제품명·성능을 뜻하지 않는다.
// 품질이 높아도 섬세한 채비는 약하고, 대물 채비는 굵고 둔하다.
RODS.push(
  { id: 'willow-soft', name: '버들못 연안 연질대', length: 4.5, line: 4.1, power: 2.3, flex: 1.65, price: 340, level: 2, rarity: 'uncommon', desc: '짧은 거리의 붕어용. 깊게 휘어 돌진을 받지만 제압력과 사거리가 낮다' },
  { id: 'willow-finesse', name: '버들못 세류 정밀대', length: 5.4, line: 5.1, power: 2.8, flex: 1.75, price: 1450, level: 5, rarity: 'rare', desc: '가느다란 원줄에 맞춘 연질 붕어대. 대물 제압보다 충격 흡수에 집중' },
  { id: 'willow-guard', name: '버들못 수초 강공대', length: 5.76, line: 5.5, power: 5.8, flex: 1.1, price: 2900, level: 7, rarity: 'epic', desc: '짧고 단단한 대물용. 강하게 당기지만 가는 원줄의 충격 완충은 적다' },
  { id: 'willow-master', name: '버들못 명인 연질대', length: 6.12, line: 5.9, power: 3.4, flex: 2.25, price: 5900, level: 10, rarity: 'legendary', desc: '허리까지 휘는 고급 붕어용. 대물대보다 약하고 짧지만 충격을 길게 받아 준다' },
);
Object.assign(ROD_ACTION, { 'willow-soft': 0.3, 'willow-finesse': 0.25, 'willow-guard': 0.88, 'willow-master': 0.18 });
LINES.push(
  { id: 'willow-entry', name: '버들못 실속 원줄 2.5호', diameterMm: 0.26, strength: 3.9, material: 'nylon', visibility: 0.22, price: 65, level: 1, rarity: 'common', desc: '저렴한 중간 굵기. 예민한 붕어보다 일반 낚시에 알맞다' },
  { id: 'willow-silk', name: '버들못 세사 원줄 0.8호', diameterMm: 0.145, strength: 1.8, material: 'nylon', visibility: 0, price: 300, level: 2, rarity: 'uncommon', desc: '매우 가늘어 섬세한 채비에 적합. 작은 하중에도 끊어지니 큰 고기는 피한다' },
  { id: 'willow-balance', name: '버들못 정밀 원줄 1.7호', diameterMm: 0.22, strength: 4.5, material: 'nylon', visibility: 0.08, price: 850, level: 5, rarity: 'rare', desc: '붕어와 중형 잉어 사이의 균형. 초대물용 강도는 없다' },
  { id: 'willow-heavy', name: '버들못 강공 원줄 6호', diameterMm: 0.405, strength: 10.5, material: 'nylon', visibility: 0.55, price: 2100, level: 8, rarity: 'epic', desc: '대물의 힘을 버티는 굵은 줄. 경계심 높은 고기의 입질과 채비 예민함은 줄어든다' },
  { id: 'willow-master', name: '버들못 명인 세사 원줄 1호', diameterMm: 0.165, strength: 3.0, material: 'nylon', visibility: 0, price: 3300, level: 10, rarity: 'legendary', desc: '얇은 줄의 강도를 보강한 붕어용. 굵은 대물 원줄보다 버티는 힘은 낮다' },
);
HOOKS.push(
  { id: 'willow-entry', name: '버들못 실속 붕어바늘 5호', gapMm: 4.5, hold: 0.96, attraction: 1.08, price: 65, level: 1, rarity: 'common', desc: '작은 지렁이와 떡밥을 쓰는 기본 붕어바늘' },
  { id: 'willow-fine', name: '버들못 세축 바늘 3호', gapMm: 3.2, hold: 0.92, attraction: 1.3, price: 240, level: 2, rarity: 'uncommon', shape: 'fine', wireMm: 0.24, barbed: false, sharpness: 1.04, desc: '작은 입에도 잘 들어가지만 큰 미끼를 달기 어렵고 대물에는 쉽게 빠진다' },
  { id: 'willow-balance', name: '버들못 정밀 바늘 7호', gapMm: 6, hold: 1.28, attraction: 1.06, price: 620, level: 4, rarity: 'rare', sharpness: 1.08, desc: '옥수수와 떡밥을 두루 쓰는 중형어용. 작은 붕어에는 다소 크다' },
  { id: 'willow-forged', name: '버들못 강축 대물바늘 12호', gapMm: 11, hold: 3.8, attraction: 0.8, price: 1900, level: 7, rarity: 'epic', shape: 'round', wireMm: 0.75, barbed: true, sharpness: 1.14, desc: '큰 잉어와 메기용. 큰 미끼는 잘 받지만 작은 물고기는 삼키기 어렵다' },
  { id: 'willow-master', name: '버들못 명인 세축바늘 4호', gapMm: 3.8, hold: 2.05, attraction: 1.32, price: 3100, level: 10, rarity: 'legendary', shape: 'fine', wireMm: 0.23, barbed: false, sharpness: 1.2, desc: '약한 입질을 노리는 정밀 붕어용. 넓은 입의 대물에는 강축바늘이 유리하다' },
);
FLOATS.push(
  { id: 'willow-wind', name: '버들못 바람 단찌', shape: 'short', notches: 6, sway: 0.35, sensitivity: 0.85, sinkSpeed: 0.65, scale: 1, price: 240, level: 2, rarity: 'uncommon', desc: '짧고 안정적인 수면 표시. 바람에 강하지만 작은 입질을 덜 보여 준다' },
  { id: 'willow-fine', name: '버들못 세류 저부력찌', shape: 'slim', notches: 14, sway: 1.45, sensitivity: 1.6, sinkSpeed: 0.22, scale: 0.7, price: 880, level: 5, rarity: 'rare', desc: '고요한 물에서 섬세한 입질을 크게 표시. 자리 잡기가 느리고 물결에 약하다' },
  { id: 'willow-deep', name: '버들못 심수 야광찌', shape: 'egg', notches: 10, sway: 0.55, light: 'chemi', glow: 2.2, sensitivity: 0.95, sinkSpeed: 0.8, scale: 1.25, price: 1650, level: 7, rarity: 'epic', desc: '깊은 수심과 야간 대물용. 빨리 서고 안정적이지만 저부력찌보다 둔하다' },
  { id: 'willow-master', name: '버들못 명인 장찌', shape: 'peacock', notches: 18, sway: 1.35, sensitivity: 1.7, sinkSpeed: 0.25, scale: 0.85, price: 3600, level: 10, rarity: 'legendary', desc: '고요한 수면의 작은 올림을 길게 읽는다. 천천히 서고 바람·야간에는 불리하다' },
);

// 4단계 전용 장비 계열. 저장된 원줄 인덱스를 보존하려고 기존 상품 뒤에 추가한다.
RODS.push(...EXPANDED_RODS);
Object.assign(ROD_ACTION, EXPANDED_ROD_ACTION);
LINES.push(...EXPANDED_LINES);
HOOKS.push(...EXPANDED_HOOKS);
HOOKS.push(...SPECIALIST_HOOKS);
FLOATS.push(...EXPANDED_FLOATS);

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
  classificationText?: string;
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
    classificationText: '잉어의 양식 품종 · 향어',
    len: { median: 45, sigma: 0.26, min: 22, max: 90 }, depth: [1.8, 4.8, 8],
    baits: { worm: 0.35, paste: 1.45, corn: 0.8, gluten: 0.4, pellet: 1.7, shrimp: 0.3 }, abundance: 0.42, power: 1.65,
    stamina: [18, 7], ranks: SIZE_RANKS.mirror,
    look: FISH_LOOKS.mirror },
  ...createExpandedSpecies(),
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

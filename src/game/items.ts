import type { GearMeta, Rarity, SpeciesId } from './data';

// 낚싯대·채비 밖의 장비: 뜰채, 살림망. 등급 색은 마인크래프트 아이템 이름 색을 따른다.
// 상품명의 브랜드는 실제 국내 판매 브랜드다. 출시 전 상표 사용 허락을 받거나 가상 이름으로 바꾼다.

export const RARITY: Record<Rarity, { name: string; color: string }> = {
  common: { name: '일반', color: '#e8e8e0' },
  uncommon: { name: '고급', color: '#7fdc6a' },
  rare: { name: '희귀', color: '#5fb4ff' },
  epic: { name: '영웅', color: '#d78cff' },
  legendary: { name: '전설', color: '#ffbf4d' },
};

export interface NetSpec extends GearMeta { id: string; name: string; maxKg: number; price: number; desc: string }
/** 뜰채: 한계보다 무거운 고기는 떠내다 놓칠 수 있다 (러시안피싱4의 뜰채 규칙) */
export const NETS: NetSpec[] = [
  { id: 'basic', name: '접이식 뜰채', maxKg: 2.5, price: 0, level: 1, rarity: 'common', desc: '붕어용 작은 뜰채' },
  { id: 'mid', name: '해동 카본 죽 20 ZOOM', maxKg: 7, price: 480, level: 3, rarity: 'uncommon', desc: '중형 잉어까지 안전하게 떠낸다' },
  { id: 'big', name: '아피스 블랙센스 옥내림뜰채', maxKg: 20, price: 1300, level: 6, rarity: 'rare', desc: '대물 잉어·메기용 넓은 그물' },
  { id: 'pro', name: '아피스 천지인 줌 뜰채', maxKg: 60, price: 3200, level: 9, rarity: 'epic', desc: '미터급도 한 번에 담는다' },
];

/** 살림망: 담을 수 있는 마릿수가 한도다 */
export interface KeepnetSpec extends GearMeta { id: string; name: string; capacity: number; price: number; desc: string }
export const KEEPNETS: KeepnetSpec[] = [
  { id: 'basic', name: '기본 살림망', capacity: 20, price: 0, level: 1, rarity: 'common', desc: '20마리까지 담는 작은 망' },
  { id: 'mid', name: '해동 HB-461 지트락 EVA 부력살림망', capacity: 50, price: 400, level: 3, rarity: 'uncommon', desc: '50마리까지 넉넉하다' },
  { id: 'big', name: '해동 HB-462 EVA 부력살림망 50', capacity: 100, price: 1200, level: 6, rarity: 'rare', desc: '대회용. 100마리, 하루 조과를 모두 담는다' },
];


/** 어종별 시세·규정. 배스·블루길은 생태계교란종이라 방생 대신 수매한다. */
export const SPECIES_RULES: Record<SpeciesId, { perKg: number; minKeepCm?: number; bounty?: number; active: 'day' | 'night' | 'twilight' | 'any' }> = {
  crucian: { perKg: 260, active: 'twilight' },
  carp: { perKg: 90, active: 'night' },
  mirror: { perKg: 120, active: 'any' },
  bluegill: { perKg: 40, bounty: 60, active: 'day' },
  catfish: { perKg: 110, active: 'night' },
  yellowcat: { perKg: 240, active: 'night' },
  snakehead: { perKg: 100, active: 'day' },
  mandarin: { perKg: 480, minKeepCm: 18, active: 'night' },
  bass: { perKg: 60, bounty: 250, active: 'twilight' },
};

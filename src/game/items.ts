import type { GearMeta, Rarity, SpeciesId } from './data';
import { EXPANDED_KEEPNETS, EXPANDED_NETS } from './gearExpansion';

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
  { id: 'willow-small', name: '버들못 실속 뜰채', maxKg: 4.5, price: 190, level: 2, rarity: 'common', desc: '적은 비용으로 붕어와 작은 잉어를 떠낸다. 대물에는 작은 망' },
  { id: 'willow-wide', name: '버들못 넓은 뜰채', maxKg: 14, price: 860, level: 4, rarity: 'rare', desc: '중형 잉어·향어용. 큰 뜰채를 사기 전 실용적인 선택' },
  { id: 'willow-master', name: '버들못 명인 대물뜰채', maxKg: 80, price: 6200, level: 11, rarity: 'legendary', desc: '큰 물고기를 위한 최대 하중. 작은 어종 위주라면 기본 뜰채로 충분하다' },
];

/** 살림망: 담을 수 있는 마릿수가 한도다 */
export interface KeepnetSpec extends GearMeta { id: string; name: string; capacity: number; price: number; desc: string }
export const KEEPNETS: KeepnetSpec[] = [
  { id: 'basic', name: '기본 살림망', capacity: 20, price: 0, level: 1, rarity: 'common', desc: '20마리까지 담는 작은 망' },
  { id: 'mid', name: '해동 HB-461 지트락 EVA 부력살림망', capacity: 50, price: 400, level: 3, rarity: 'uncommon', desc: '50마리까지 넉넉하다' },
  { id: 'big', name: '해동 HB-462 EVA 부력살림망 50', capacity: 100, price: 1200, level: 6, rarity: 'rare', desc: '대회용. 100마리, 하루 조과를 모두 담는다' },
  { id: 'willow-small', name: '버들못 실속 살림망', capacity: 35, price: 180, level: 2, rarity: 'common', desc: '짧은 낚시를 위한 35칸. 작은 비용으로 보관 공간을 늘린다' },
  { id: 'willow-session', name: '버들못 장시간 살림망', capacity: 150, price: 2600, level: 8, rarity: 'epic', desc: '오래 머무는 낚시를 위한 150칸. 입질이나 물고기 크기를 늘리지는 않는다' },
  { id: 'willow-master', name: '버들못 명인 살림망', capacity: 220, price: 5800, level: 11, rarity: 'legendary', desc: '장시간 조과를 담는 220칸. 수시로 판매한다면 작은 살림망으로 충분하다' },
];


NETS.push(...EXPANDED_NETS);
KEEPNETS.push(...EXPANDED_KEEPNETS);

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
  hera: { perKg: 220, active: 'day' },
  nuchi: { perKg: 170, active: 'day' },
  koi: { perKg: 180, active: 'any' },
  leather: { perKg: 100, active: 'night' },
  bredmirror: { perKg: 110, active: 'any' },
  grasscarp: { perKg: 85, active: 'day' },
};

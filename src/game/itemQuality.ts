import { BAITS, FLOATS, HOOKS, LINES, RODS, type BaitId, type GearMeta, type Rarity } from './data';
import { KEEPNETS, NETS } from './items';
import { BAIT_PRODUCTS } from './realCatalog';

/** 게임 안에서의 품질·용도 분류이며, 실존 제조사 제품의 품질 평가가 아니다. */
export interface ItemQuality { label: string; tier: number; purpose: string }
export const QUALITY_LABELS = ['기본', '실용', '고급', '전문', '명품'] as const;
const TIERS: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
const quality = (tier: number, purpose: string): ItemQuality => ({ tier, label: QUALITY_LABELS[tier - 1] ?? QUALITY_LABELS[0], purpose });
const gearQuality = (gear: GearMeta | undefined, purpose: string) => quality(gear ? TIERS[gear.rarity] : 1, gear?.purpose ?? purpose);
const BAIT_USE: Record<BaitId | 'chum', string> = {
  worm: '생미끼 · 다양한 어종', paste: '곡물 · 붕어·잉어', corn: '큰 미끼 · 잉어',
  gluten: '섬세한 떡밥 · 붕어', pellet: '어분 · 잉어·향어', shrimp: '생미끼 · 육식어', chum: '주변 집어',
};
const BAIT_TIERS: Record<string, number> = {
  'kw-burger': 2, 'kw-aqua2': 2, 'kw-chum': 2, 'toco-fish': 2, 'toco-vanilla': 3,
  'toco-11': 3, 'mq-wata': 2, 'mq-nozuri': 3, 'mq-imo': 2, 'mq-alpha21': 4, 'mq-ookoi': 3,
};
const INGREDIENT_QUALITY: Record<string, ItemQuality> = {
  bran: quality(1, '곡물 배합 · 집어'), cornmeal: quality(1, '곡물 배합 · 먹이 입자'),
  attractor: quality(2, '새우 향 · 집어'), fishmeal: quality(2, '어분 배합 · 잉어·향어'),
  glutenpowder: quality(2, '글루텐 배합 · 바늘 잔존'),
};

/** 모든 상점 종류와 기존 저장 ID를 받는다. 미등록 ID도 기본 품질로 안전하게 표시한다. */
export function itemQuality(kind: string, id: string): ItemQuality {
  switch (kind) {
    case 'rod': {
      const item = RODS.find(x => x.id === id);
      const purpose = !item ? '균형' : item.power >= 4.5 ? '대물 제압' : item.length >= 7 ? '먼 거리·깊은 수심' : item.flex >= 1.65 ? '붕어 · 연질 완충' : item.power <= 2.8 ? '붕어 · 연안' : '붕어·중형어 균형';
      return gearQuality(item, purpose);
    }
    case 'line': {
      const item = LINES.find(x => x.id === id);
      return gearQuality(item, !item ? '균형' : item.strength >= 7 ? '대물 · 강도 우선' : item.strength <= 3.1 ? '섬세 · 가는 줄' : '중형어 · 균형');
    }
    case 'hook': {
      const item = HOOKS.find(x => x.id === id);
      return gearQuality(item, !item ? '균형' : item.hold >= 1.4 ? '대물 · 큰 미끼' : item.attraction >= 1.2 ? '섬세 · 작은 미끼' : '붕어·중형어 균형');
    }
    case 'float': {
      const item = FLOATS.find(x => x.id === id);
      const purpose = !item ? '균형' : item.light ? (item.sinkSpeed >= 0.7 ? '야간 · 깊은 수심' : '야간 시인성') : (item.sway ?? 1) <= 0.8 ? '물결 안정' : item.sensitivity >= 1.3 ? '섬세한 입질' : item.notches && item.notches >= 15 ? '긴 찌올림' : '일반 찌낚시';
      return gearQuality(item, purpose);
    }
    case 'net': {
      const item = NETS.find(x => x.id === id);
      return gearQuality(item, !item ? '포획 보조' : item.maxKg <= 4.5 ? '붕어·소형어' : item.maxKg <= 14 ? '중형 잉어·향어' : '대물 포획');
    }
    case 'keepnet': {
      const item = KEEPNETS.find(x => x.id === id);
      return gearQuality(item, !item ? '조과 보관' : item.capacity <= 35 ? '짧은 출조' : item.capacity <= 100 ? '다수 조과 보관' : '장시간 출조');
    }
    case 'bait': {
      const product = BAIT_PRODUCTS.find(x => x.id === id);
      if (product) return quality(product.qualityTier ?? BAIT_TIERS[id] ?? 2, product.purpose ?? BAIT_USE[product.baseBait]);
      if (id === 'chum') return quality(1, BAIT_USE.chum);
      return quality(1, BAITS[id as BaitId] ? BAIT_USE[id as BaitId] : '기본 미끼');
    }
    case 'ing':
    case 'ingredient': return INGREDIENT_QUALITY[id] ?? quality(1, '떡밥 배합');
    default: return quality(1, '일반 용도');
  }
}

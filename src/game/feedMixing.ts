import { INGREDIENTS, SPECIES_LIST, type BaitId, type IngredientId, type SpeciesId } from './data';
import { baitAffinity } from './ecology';
import { BAIT_PRODUCTS, LEGACY_CHUM_PRODUCTS, baitProduct, type BaitProduct } from './realCatalog';
import { productAffinity } from './speciesFamilies';

export interface FeedPart { key: string; count: number }
export interface FeedDraft { name: string; parts: FeedPart[] }
export interface FeedBlend extends BaitProduct { parts: FeedPart[] }
export interface FeedMaterial { key: string; name: string; flavor: BaitId; product?: BaitProduct; binding: number }

const INGREDIENT_FLAVORS: Record<IngredientId, BaitId> = {
  bran: 'paste', cornmeal: 'corn', attractor: 'shrimp', fishmeal: 'pellet', glutenpowder: 'gluten', barley: 'paste', strawberry: 'paste',
};
const MIXABLE = new Set<BaitId>(['paste', 'gluten', 'pellet']);
// 향과 곡물의 차이는 게임 배합값이며, 실존 제품의 효능 수치가 아니다.
const ingredientProduct = (id: IngredientId): BaitProduct | undefined => id === 'fishmeal' ? baitProduct('kw-aqua2')
  : id === 'glutenpowder' ? baitProduct('mq-wata')
  : id === 'barley' || id === 'strawberry' ? {
    id, name: id, baseBait: 'paste', count: 1, price: 0, level: 1, desc: '', biteScale: 1, chumScale: 1,
    speciesAffinity: id === 'barley' ? { crucian: 1.05, carp: 1.12, mirror: 1.04 }
      : { crucian: 1.18, carp: 0.92, mirror: 0.85 },
  } : undefined;
export const FEED_MATERIALS: FeedMaterial[] = [
  ...BAIT_PRODUCTS.filter(p => MIXABLE.has(p.baseBait) || LEGACY_CHUM_PRODUCTS.has(p.id)).map(p => ({
    key: `product:${p.id}`, name: p.name, product: p,
    flavor: p.baseBait,
    binding: p.baseBait === 'gluten' ? 1 : 0.2,
  })),
  ...INGREDIENTS.map(i => ({ key: `ingredient:${i.id}`, name: i.name, flavor: INGREDIENT_FLAVORS[i.id], product: ingredientProduct(i.id), binding: i.id === 'glutenpowder' ? 1 : 0.1 })),
  ...(['paste', 'gluten', 'pellet'] as const).map(id => ({
    key: `generic:${id}`, name: { paste: '기본 곡물떡밥', gluten: '기본 글루텐떡밥', pellet: '기본 어분떡밥' }[id],
    flavor: id, binding: id === 'gluten' ? 1 : 0.2,
  })),
];

/** 정해진 조합 없이, 재료와 양만으로 배합을 만든다. 저장된 성능도 이 함수로 다시 계산한다. */
export function createFeedBlend(id: string, draft: FeedDraft): FeedBlend | null {
  if (!draft || !Array.isArray(draft.parts) || draft.parts.length > FEED_MATERIALS.length + 1) return null;
  const combined = new Map<string, number>();
  for (const part of draft.parts) {
    if (!part) return null;
    const key = part.key === 'generic:chum' ? 'generic:paste' : part.key;
    if (!FEED_MATERIALS.some(m => m.key === key) || !Number.isSafeInteger(part.count) || part.count <= 0) return null;
    combined.set(key, (combined.get(key) ?? 0) + part.count);
  }
  const parts = [...combined].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count }));
  const total = parts.reduce((n, p) => n + p.count, 0);
  if (total <= 0 || total > 1000) return null;
  const materials = parts.map(part => ({ ...FEED_MATERIALS.find(m => m.key === part.key)!, share: part.count / total }));
  const weights: Partial<Record<BaitId, number>> = {};
  for (const m of materials) weights[m.flavor] = (weights[m.flavor] ?? 0) + m.share;
  const dominant = (Object.entries(weights) as [BaitId, number][]).sort((a, b) => b[1] - a[1])[0][0];
  // 동물성 첨가물이나 옥수수 가루도 완성품은 떡밥으로 장착한다.
  const flavor = ['paste', 'gluten', 'pellet'].includes(dominant) ? dominant : dominant === 'shrimp' ? 'pellet' : 'paste';
  const blendPreferences: Partial<Record<SpeciesId, number>> = {};
  const speciesAffinity: Partial<Record<SpeciesId, number>> = {};
  for (const sp of SPECIES_LIST) {
    blendPreferences[sp.id] = materials.reduce((n, m) => n + m.share * baitAffinity(sp, m.flavor, m.product) * (m.product?.biteScale ?? 1), 0);
    const taste = materials.reduce((n, m) => n + m.share * sp.baits[m.flavor] * productAffinity(m.product?.speciesAffinity, sp.id), 0);
    speciesAffinity[sp.id] = taste / Math.max(0.01, sp.baits[flavor]);
  }
  const name = typeof draft.name === 'string' ? draft.name.trim().slice(0, 32) : '';
  return {
    id, name: name || '나만의 떡밥', parts, baseBait: flavor,
    count: total, price: 0, level: 1, desc: materials.map(m => `${m.name} ${Math.round(m.share * 100)}%`).join(' · '),
    biteScale: 1, chumScale: materials.reduce((n, m) => n + m.share * (m.product?.chumScale ?? 1), 0),
    holdingScale: 0.85 + materials.reduce((n, m) => n + m.share * m.binding, 0) * 0.3,
    blendPreferences, speciesAffinity,
  };
}

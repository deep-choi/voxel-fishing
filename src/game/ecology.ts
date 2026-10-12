import { BAITS, SPECIES_LIST, type BaitId, type Species, type SpeciesId } from './data';
import { ACTIVE_FISHERY } from './fisheries';
import type { BaitProduct } from './realCatalog';
import { smoothstep } from '../world/noise';

/** 실제 효능을 주장하지 않는 게임 먹이 모델. 기본 선호도는 Species.baits에 한 번만 정의한다. */
const PRODUCT_TARGETS: Record<string, Partial<Record<SpeciesId, number>>> = {
  'kw-burger': { crucian: 1.22, carp: 1.12, mirror: 1.1 },
  'kw-aqua2': { mirror: 1.35, carp: 1.18, crucian: 0.9 },
  'toco-fish': { crucian: 1.12, carp: 1.18, mirror: 1.3 },
  'toco-vanilla': { crucian: 1.35, carp: 1.05 },
  'mq-wata': { crucian: 1.32, mirror: 0.85 },
  'mq-nozuri': { crucian: 1.25, carp: 1.15 },
  'mq-imo': { crucian: 1.15, carp: 1.2 },
  'mq-alpha21': { crucian: 1.4, carp: 0.9, mirror: 0.8 },
  'mq-ookoi': { carp: 1.42, mirror: 1.2, crucian: 0.75 },
};
export const baitAffinity = (sp: Species, bait: BaitId, product?: BaitProduct) =>
  sp.baits[bait] * (product ? PRODUCT_TARGETS[product.id]?.[sp.id] ?? 1 : 1);
export const preferredBaits = (sp: Species) => Object.values(BAITS).sort((a, b) => sp.baits[b.id] - sp.baits[a.id]);
export const affinityLabel = (n: number) => n >= 1.3 ? '매우 좋아함' : n >= 0.8 ? '좋아함' : n >= 0.3 ? '보통' : n >= 0.08 ? '잘 안 먹음' : '거의 안 먹음';

export interface EncounterFactors {
  population: number; bait: number; habitat: number; baitDepth: number; spot: number;
  line: number; chum: number; hook: number; environment: number; product: number;
}
export interface EncounterRate { sp: Species; perMin: number; factors: EncounterFactors }
export interface EncounterContext {
  waterDepth: number; baitDepth: number; bait: BaitId; product?: BaitProduct;
  spotQuality: (seed: number) => number; visibility: number; hookAttraction: number; chum: number | ((sp: Species) => number);
  environment: (sp: Species) => number;
}
export function encounterRates(c: EncounterContext): EncounterRate[] {
  return SPECIES_LIST.map((sp, i) => {
    const [lo, best, hi] = sp.depth;
    const d = c.waterDepth;
    let habitat = d <= 0 ? 0 : d < lo || d > hi ? 0.04 : d < best ? 0.28 + 0.72 * smoothstep(lo, best, d) : 0.28 + 0.72 * (1 - smoothstep(best, hi, d));
    const above = Math.max(0, d - c.baitDepth);
    // 바닥 어종은 미끼가 떠 있으면 불리하고, 수초 포식자는 떠 있는 미끼도 먹는다.
    const baitDepth = 1 - sp.bottom * smoothstep(0.12, 1.4, above) * 0.94;
    const predator = sp.bottom < 0.5 && c.baitDepth < d - 0.3 ? 1.1 : 1;
    habitat *= predator;
    const feed = typeof c.chum === 'function' ? c.chum(sp) : c.chum;
    const factors: EncounterFactors = {
      population: ACTIVE_FISHERY.population[sp.id], bait: baitAffinity(sp, c.bait, c.product), habitat, baitDepth,
      spot: 0.4 + 1.4 * Math.pow(c.spotQuality(i), 1.5), line: Math.max(0.22, 1 - sp.shy * c.visibility * 1.4),
      // 집어는 잡식성 어종에 주로 작용한다. 새우를 쓰는 포식자에게 어분 집어를 만능으로 적용하지 않는다.
      chum: 1 + feed * sp.bottom * Math.min(1, sp.baits.pellet + sp.baits.paste),
      hook: sp.len.median < 30 ? c.hookAttraction : Math.max(0.35, 1.2 - (c.hookAttraction - 0.8)),
      environment: c.environment(sp), product: c.product?.biteScale ?? 1,
    };
    const raw = sp.abundance * Object.values(factors).reduce((n, v) => n * v, 1);
    return { sp, factors, perMin: Number.isFinite(raw) ? Math.max(0, raw) : 0 };
  });
}
/** 경쟁 입질: 먼저 전체 입질 사건을 뽑고, 그 안에서 어종을 가중 선택한다. 배열 앞 어종 우선 편향이 없다. */
export const biteProbability = (ratePerMinute: number, seconds: number) => -Math.expm1(-Math.max(0, ratePerMinute) * Math.max(0, seconds) / 60);
export function pickEncounter(rates: EncounterRate[], random = Math.random): Species | null {
  const candidates = rates.filter(r => r.perMin > 0);
  const total = candidates.reduce((n, r) => n + r.perMin, 0);
  if (total <= 0) return null;
  let draw = random() * total;
  for (const row of candidates) { draw -= row.perMin; if (draw < 0) return row.sp; }
  return candidates[candidates.length - 1].sp;
}

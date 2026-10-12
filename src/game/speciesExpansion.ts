import type { ExpandedSpeciesId, Species } from './data';
import { FISH_LOOKS } from './fishArt';
import { SIZE_RANKS } from './sizeRanks';

/** 생물학적 종과 양식 품종을 구분해 표시한다. 조과·체장·무게·힘은 게임용 수치다. */
export function createExpandedSpecies(): Record<ExpandedSpeciesId, Species> {
  const make = (id: ExpandedSpeciesId, name: string, classificationText: string, values: Partial<Species>): Species => ({
    id, name, classificationText, look: FISH_LOOKS[id], ranks: SIZE_RANKS[id],
    len: { median: 45, sigma: 0.23, min: 20, max: 100 }, wa: 0.012, wb: 3,
    depth: [1, 3, 7], bottom: 0.85, baits: { worm: 0.55, paste: 1, corn: 1.25, gluten: 0.6, pellet: 1.3, shrimp: 0.35 },
    abundance: 0.3, shy: 0.6, power: 1.4, speed: 2.6, stamina: [16, 6], bite: 'sink', ...values,
  });
  return {
    hera: make('hera', '떡붕어', '붕어속의 별개 종 · Carassius cuvieri', {
      len: { median: 29, sigma: 0.24, min: 12, max: 60 }, wa: 0.018, depth: [0.7, 2.5, 5.5], bottom: 0.35,
      baits: { worm: 0.22, paste: 1.2, corn: 0.15, gluten: 1.65, pellet: 0.5, shrimp: 0.08 },
      abundance: 0.55, shy: 1.15, power: 1.55, speed: 1.9, stamina: [12, 12], bite: 'rise',
    }),
    nuchi: make('nuchi', '누치', '별개 종 · Hemibarbus labeo', {
      len: { median: 38, sigma: 0.24, min: 16, max: 75 }, wa: 0.009, depth: [0.8, 2.8, 6.5], bottom: 0.95,
      baits: { worm: 1.55, paste: 0.22, corn: 0.08, gluten: 0.12, pellet: 0.45, shrimp: 1.05 },
      abundance: 0.48, shy: 0.72, power: 1.75, speed: 3.1, stamina: [13, 8], bite: 'jitter',
    }),
    koi: make('koi', '비단잉어', '잉어의 관상용 개량 품종 · 별개 생물학적 종 아님', {
      len: { median: 48, sigma: 0.24, min: 20, max: 100 }, wa: 0.012,
      depth: [0.7, 2.7, 6], bottom: 0.65, baits: { worm: 0.55, paste: 1.15, corn: 1.4, gluten: 0.65, pellet: 1.25, shrimp: 0.25 },
      abundance: 0.25, shy: 0.8, power: 1.35, speed: 2.8, bite: 'sink',
    }),
    leather: make('leather', '가죽잉어', '잉어의 개량 품종 · 비늘이 매우 적은 향어 계열', {
      len: { median: 49, sigma: 0.23, min: 24, max: 100 }, wa: 0.0185,
      depth: [1.5, 4.2, 8], bottom: 0.96, baits: { worm: 0.28, paste: 1.25, corn: 0.9, gluten: 0.3, pellet: 1.75, shrimp: 0.18 },
      abundance: 0.33, shy: 0.52, power: 1.4, speed: 2.3, stamina: [18, 7], bite: 'drag',
    }),
    bredmirror: make('bredmirror', '육종향어', '향어를 선발 육종한 양식 품종 · 별개 생물학적 종 아님', {
      len: { median: 54, sigma: 0.22, min: 25, max: 100 }, wa: 0.0215,
      depth: [1.5, 4.5, 8], bottom: 0.95, baits: { worm: 0.22, paste: 1.2, corn: 0.8, gluten: 0.35, pellet: 1.85, shrimp: 0.16 },
      abundance: 0.28, shy: 0.65, power: 1.35, speed: 2.1, stamina: [20, 6], bite: 'drag',
    }),
    grasscarp: make('grasscarp', '초어', '잉어와 다른 종 · Ctenopharyngodon idellus', {
      len: { median: 61, sigma: 0.24, min: 28, max: 110 }, wa: 0.0125,
      depth: [0.6, 2.2, 5.5], bottom: 0.45, baits: { worm: 0.08, paste: 1.4, corn: 1.6, gluten: 0.75, pellet: 0.5, shrimp: 0.02 },
      abundance: 0.3, shy: 0.82, power: 1.45, speed: 3.25, stamina: [18, 6], bite: 'drag',
    }),
  };
}

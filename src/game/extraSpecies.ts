import type { ExtraSpeciesId, FishLook, Species } from './data';
import { FISH_LOOKS } from './fishArt';
import { SIZE_RANKS } from './sizeRanks';

export function createExtraSpecies(): Record<ExtraSpeciesId, Species> {
  const L = FISH_LOOKS;
  const make = (id: ExtraSpeciesId, name: string, look: FishLook, values: Partial<Species>): Species => ({
    id, name, look, len: { median: 35, sigma: 0.25, min: 12, max: 75 }, wa: 0.012, wb: 3.05,
    depth: [0.7, 2.4, 7], bottom: 0.7, baits: { worm: 1, paste: 0.05, corn: 0.02, gluten: 0.03, pellet: 0.1, shrimp: 1.2 },
    abundance: 0.45, shy: 0.5, power: 1.8, speed: 2.5, stamina: [14, 8], bite: 'sink',
    ranks: SIZE_RANKS[id], ...values,
  });
  return {
    catfish: make('catfish', '메기', L.catfish, { len: { median: 48, sigma: 0.3, min: 18, max: 115 }, wa: 0.007, wb: 3.08,
      depth: [1, 3.8, 8], baits: { worm: 1.4, paste: 0.08, corn: 0.02, gluten: 0.04, pellet: 0.35, shrimp: 1.65 },
      bottom: 0.95, power: 2, speed: 2.2, stamina: [20, 8], bite: 'drag', abundance: 0.55,
    }),
    yellowcat: make('yellowcat', '동자개', L.yellowcat, { len: { median: 22, sigma: 0.24, min: 8, max: 42 }, wa: 0.014, wb: 3,
      depth: [0.6, 2.5, 5.5], bottom: 0.9, abundance: 0.8, speed: 1.6, stamina: [9, 12], bite: 'jitter',
      baits: { worm: 1.5, paste: 0.08, corn: 0.02, gluten: 0.03, pellet: 0.2, shrimp: 1.25 } }),
    snakehead: make('snakehead', '가물치', L.snakehead, { len: { median: 58, sigma: 0.24, min: 25, max: 110 }, wa: 0.0065, wb: 3.12,
      depth: [0.4, 1.8, 4.5], bottom: 0.25, power: 2.25, speed: 3.3, stamina: [22, 7], bite: 'drag', abundance: 0.22,
      baits: { worm: 0.55, paste: 0.01, corn: 0.01, gluten: 0.01, pellet: 0.03, shrimp: 1.6 },
    }),
    mandarin: make('mandarin', '쏘가리', L.mandarin, { len: { median: 31, sigma: 0.24, min: 12, max: 65 }, wa: 0.018, wb: 3,
      depth: [1, 2.8, 6], bottom: 0.5, speed: 3.4, power: 2.2, bite: 'dart', abundance: 0.28, shy: 0.85,
      baits: { worm: 0.4, paste: 0.01, corn: 0.01, gluten: 0.01, pellet: 0.04, shrimp: 1.8 },
    }),
    bass: make('bass', '배스', L.bass, { len: { median: 35, sigma: 0.25, min: 14, max: 65 }, wa: 0.016, wb: 3,
      depth: [0.5, 2, 5.5], bottom: 0.25, power: 2.3, speed: 3.8, bite: 'dart', abundance: 0.65,
      baits: { worm: 1.15, paste: 0.02, corn: 0.01, gluten: 0.01, pellet: 0.05, shrimp: 1.55 },
    }),
  };
}

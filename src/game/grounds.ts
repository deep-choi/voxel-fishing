import type { BaitId, Species, SpeciesId } from './data';
import { productAffinity } from './speciesFamilies';
/** 저수지 환경은 플레이어 기록과 분리한다. 모든 낚싯대가 같은 집어 상태를 읽는다. */
export class FishingGrounds {
  private time = 0;
  private feed: { x: number; z: number; amount: number; at: number; flavor?: BaitId; affinity?: Partial<Record<SpeciesId, number>> }[] = [];
  update(dt: number) { this.time += dt; this.feed = this.feed.filter(f => this.time - f.at < 900); }
  addFeed(x: number, z: number, amount: number, flavor?: BaitId, affinity?: Partial<Record<SpeciesId, number>>) {
    this.feed.push({ x, z, amount, at: this.time, flavor, affinity });
    if (this.feed.length > 100) this.feed.shift();
  }
  attraction(x: number, z: number, species?: Species) {
    return Math.min(2.2, this.feed.reduce((n, f) => {
      const taste = species ? Math.min(1.7, (f.flavor ? species.baits[f.flavor] : (species.baits.paste + species.baits.pellet) / 2) * productAffinity(f.affinity, species.id)) : 1;
      return n + f.amount * taste * Math.exp(-((f.x - x) ** 2 + (f.z - z) ** 2) / 30) * Math.exp(-(this.time - f.at) / 420);
    }, 0) * 0.35);
  }
}

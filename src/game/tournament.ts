import type { SpeciesId } from './data';
import { ACTIVE_FISHERY } from './fisheries';

// 낚시 대회: 참가비를 내고 정해진 시간 동안 규칙에 맞는 조과로 순위를 다툰다.
// 봇은 넣지 않는다. 실제 참가자(멀티플레이)가 붙을 때까지 대회는 닫아 둔다 (TOURNAMENTS_OPEN).
// 순위표 구조는 서버 랭킹과 같게 둔다.
export const TOURNAMENTS_OPEN = false;

export type Scoring = 'max-cm' | 'total-kg' | 'count';
export interface TournamentDef {
  id: string; name: string; desc: string;
  target: SpeciesId[] | 'any'; scoring: Scoring;
  /** 실제 시간 (분) */
  minutes: number; entry: number; prizes: number[]; level: number;
}
export const TOURNAMENTS: TournamentDef[] = [
  { id: 'crucian-max', name: '새벽 붕어 최대어전', desc: '가장 긴 붕어 한 마리로 순위를 정한다', target: ['crucian'], scoring: 'max-cm', minutes: 8, entry: 50, prizes: [600, 300, 120], level: 1 },
  { id: 'invasive', name: '교란종 퇴치 대회', desc: '배스·블루길을 많이 낚을수록 높은 순위', target: ['bass', 'bluegill'], scoring: 'count', minutes: 6, entry: 0, prizes: [400, 200, 100], level: 1 },
  { id: 'total', name: `${ACTIVE_FISHERY.name} 총중량전`, desc: '어종 상관없이 낚은 무게의 합', target: 'any', scoring: 'total-kg', minutes: 10, entry: 150, prizes: [1500, 700, 300], level: 3 },
  { id: 'carp-max', name: '대물 잉어 챌린지', desc: '잉어·향어 중 가장 긴 한 마리', target: ['carp', 'mirror'], scoring: 'max-cm', minutes: 12, entry: 300, prizes: [3000, 1400, 600], level: 5 },
];

export const tournamentAvailable = (def: TournamentDef) => def.target === 'any' || def.target.some(id => ACTIVE_FISHERY.population[id] > 0);
export interface Entry { name: string; score: number; player?: boolean }

export class Tournament {
  elapsed = 0;
  /** 참가자. 지금은 나뿐이고, 다른 조사는 서버에서 받아 채운다 */
  readonly entries: Entry[] = [{ name: '나', score: 0, player: true }];
  constructor(readonly def: TournamentDef) {}
  get duration() { return this.def.minutes * 60; }
  get remaining() { return Math.max(0, this.duration - this.elapsed); }
  get done() { return this.elapsed >= this.duration; }
  get player() { return this.entries[0]; }
  get standings() { return [...this.entries].sort((a, b) => b.score - a.score); }
  get rank() { return this.standings.indexOf(this.player) + 1; }

  counts(id: SpeciesId) { return this.def.target === 'any' || this.def.target.includes(id); }
  /** 규칙에 맞는 조과를 점수에 반영한다. 반영됐으면 true */
  submit(id: SpeciesId, cm: number, kg: number) {
    if (this.done || !this.counts(id)) return false;
    this.player.score = this.next(this.player.score, cm, kg);
    return true;
  }
  private next(score: number, cm: number, kg: number) {
    return this.def.scoring === 'max-cm' ? Math.max(score, cm) : this.def.scoring === 'total-kg' ? score + kg : score + 1;
  }
  update(dt: number) {
    if (this.done) return;
    this.elapsed += dt;
  }
  scoreText(score: number) {
    return this.def.scoring === 'max-cm' ? `${score.toFixed(1)}cm` : this.def.scoring === 'total-kg' ? `${score.toFixed(2)}kg` : `${score}마리`;
  }
}

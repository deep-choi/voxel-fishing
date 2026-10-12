import { SPECIES_LIST, type SpeciesId } from './data';
import { canEnterFishery, FISHERIES, type FisheryId } from './fisheries';
import type { PlayerSave } from './profile';

export interface PersonalGoal {
  id: string; group: 'start' | 'species' | 'fishery' | 'record' | 'challenge';
  name: string; desc: string; have: number; need: number; coins: number; xp: number;
  claimed: boolean; locked: boolean; fisheryId?: FisheryId; speciesId?: SpeciesId;
}

/** 기존 조과로 진행도를 복원한다. 보상은 profile의 영구 수령 목록으로 한 번만 지급한다. */
export function personalGoals(save: PlayerSave): PersonalGoal[] {
  const result: PersonalGoal[] = [];
  const add = (goal: Omit<PersonalGoal, 'claimed'>) => result.push({ ...goal,
    have: Math.min(goal.need, goal.have), claimed: save.personalGoalClaims.includes(goal.id) });
  const hasCatch = save.catches.length > 0;
  const hasSale = save.catches.some(c => c.kept && c.sold && !c.released && c.value > 0);
  add({ id: 'start:catch', group: 'start', name: '첫 손맛의 시작', desc: '물고기 한 마리를 낚으세요', have: +hasCatch, need: 1, coins: 20, xp: 15, locked: false });
  add({ id: 'start:sale', group: 'start', name: '첫 판매', desc: '살림망의 물고기를 어시장에서 판매하세요', have: +hasSale, need: 1, coins: 30, xp: 20, locked: !hasCatch });
  add({ id: 'start:gear', group: 'start', name: '나만의 첫 장비', desc: '낚싯대·찌·바늘·원줄·뜰채·살림망 중 유료 장비를 구매하세요', have: save.stats.equipmentPurchases, need: 1, coins: 40, xp: 25, locked: !hasSale });

  for (const species of SPECIES_LIST) {
    const catches = save.catches.filter(c => c.species === species.id);
    const best = catches.reduce((n, c) => Math.max(n, c.cm), 0);
    add({ id: `species:${species.id}:first`, group: 'species', speciesId: species.id,
      name: `${species.name} 첫 만남`, desc: `${species.name}를 처음으로 낚으세요`, have: +!!catches.length, need: 1, coins: 0, xp: 15, locked: false });
    let previousThreshold = 0;
    for (const [index, [rank, threshold]] of [...species.ranks].reverse().filter(([rank]) => rank !== '준대물').entries()) {
      add({ id: `species:${species.id}:rank${index + 1}`, group: 'species', speciesId: species.id,
        name: `${species.name} ${rank}`, desc: `${threshold}cm 이상 낚기 · 최고 ${best.toFixed(1)}cm`,
        have: +Boolean(best >= threshold), need: 1, coins: 20 + index * 20, xp: 30 + index * 20,
        locked: index === 0 ? !catches.length : best < previousThreshold });
      previousThreshold = threshold;
    }
  }
  for (const fishery of FISHERIES) {
    const resident = SPECIES_LIST.filter(s => fishery.population[s.id] > 0);
    const discovered = new Set(save.catches.filter(c => (c.fisheryId ?? 'willow') === fishery.id).map(c => c.species));
    add({ id: `fishery:${fishery.id}:collection`, group: 'fishery', fisheryId: fishery.id,
      name: `${fishery.name} 도감`, desc: `이 낚시터에 서식하는 ${resident.length}종을 모두 낚으세요`,
      have: resident.filter(s => discovered.has(s.id)).length, need: resident.length, coins: 100, xp: 100, locked: !canEnterFishery(fishery.id) });
  }
  const best: Partial<Record<SpeciesId, number>> = {};
  let records = 0;
  for (const c of [...save.catches].sort((a, b) => a.at - b.at)) {
    if (best[c.species] !== undefined && c.cm > best[c.species]!) records++;
    best[c.species] = Math.max(best[c.species] ?? 0, c.cm);
  }
  for (const count of [1, 5, 15]) add({ id: `record:${count}`, group: 'record', name: `어제의 나를 넘어서 ${count}`,
    desc: `첫 포획 이후 어종별 최고 길이 ${count}회 갱신`, have: records, need: count, coins: count === 1 ? 20 : 40, xp: count === 1 ? 25 : 50,
    locked: count === 1 ? !hasCatch : records < (count === 5 ? 1 : 5) });
  const worms = new Set(save.catches.filter(c => c.rig?.bait === 'worm').map(c => c.species));
  add({ id: 'challenge:worm-three', group: 'challenge', name: '지렁이 탐험가', desc: '지렁이 미끼로 서로 다른 어종 3종 낚기', have: worms.size, need: 3, coins: 30, xp: 40, locked: false });
  const crucian = SPECIES_LIST.find(s => s.id === 'crucian')!;
  const threshold = crucian.ranks.find(([rank]) => rank === '대물')![1];
  add({ id: 'challenge:starter-crucian', group: 'challenge', name: '기본 장비의 손맛', desc: `기본 낚싯대로 ${threshold}cm 이상 붕어 낚기`,
    have: +save.catches.some(c => c.species === 'crucian' && c.cm >= threshold && c.rig?.rodId === 'starter'), need: 1, coins: 40, xp: 60, locked: false });
  return result;
}

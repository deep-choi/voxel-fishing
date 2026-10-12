import type { SpeciesId } from './data';

// 게임 미끼의 목적 어종을 확장 어종·품종에도 적용한다. 생물학적 분류표가 아니다.
const BAIT_FAMILY: Partial<Record<SpeciesId, SpeciesId>> = {
  hera: 'crucian', koi: 'carp', leather: 'carp', bredmirror: 'mirror', grasscarp: 'carp',
};
export function productAffinity(affinity: Partial<Record<SpeciesId, number>> | undefined, id: SpeciesId) {
  return affinity?.[id] ?? affinity?.[BAIT_FAMILY[id] ?? id] ?? 1;
}

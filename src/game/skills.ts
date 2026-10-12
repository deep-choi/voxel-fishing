// 레벨이 오를 때마다 1포인트. 러시안피싱4의 기술 트리를 4갈래로 줄였다. (예전 체력 기술에 쓴 포인트는 저장을 불러올 때 돌려받는다)

export type SkillId = 'hookset' | 'strength' | 'chum' | 'trade';
export const SKILL_MAX = 5;
export const SKILLS: { id: SkillId; name: string; desc: (lv: number) => string }[] = [
  { id: 'hookset', name: '챔질 감각', desc: lv => `챔질 판정 +${(lv * 0.06).toFixed(2)}초` },
  { id: 'strength', name: '버티기', desc: lv => `원줄 강도 +${lv * 4}%` },
  { id: 'chum', name: '집어 달인', desc: lv => `집어 효과 +${lv * 15}%` },
  { id: 'trade', name: '흥정', desc: lv => `판매가 +${lv * 5}%` },
];
export const SKILL_IDS = SKILLS.map(s => s.id);

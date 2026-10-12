import { rankOf, SPECIES, SPECIES_LIST, type SpeciesId } from './data';
import { seeded } from './environment';
import { SPECIES_RULES } from './items';

// 경제: 오늘의 시세, 일일 의뢰, 업적. 날짜를 씨앗으로 써서 서버 없이도 모두 같은 값을 본다.

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNumber = (day: string) => Math.floor(new Date(`${day}T00:00:00`).getTime() / 86400000);

/** 오늘의 어종별 시세 배수 (0.75 ~ 1.35) */
export function marketMul(id: SpeciesId, day = today()) {
  return 0.75 + 0.6 * seeded(dayNumber(day) * 13 + SPECIES_LIST.findIndex(s => s.id === id));
}

/** 판매가: 무게 × kg당 시세 + 길이 보너스, 기록 등급이면 더 비싸다 */
export function fishValue(id: SpeciesId, cm: number, kg: number, tradeLevel = 0) {
  const sp = SPECIES[id];
  const rank = rankOf(sp, cm);
  const rankBonus = rank ? 1 + 0.5 * (sp.ranks.length - sp.ranks.findIndex(r => r[0] === rank)) : 1;
  return Math.max(10, Math.round((kg * SPECIES_RULES[id].perKg + cm) * marketMul(id) * rankBonus * (1 + tradeLevel * 0.05)));
}

// ── 일일 의뢰 ─────────────────────────────

export type QuestKind = 'catch' | 'weight' | 'release' | 'chum' | 'sell';
export interface QuestDef { id: string; kind: QuestKind; species?: SpeciesId; target: number; text: string; coins: number; xp: number }
export interface QuestState { id: string; progress: number; claimed: boolean }

const QUEST_POOL: Omit<QuestDef, 'id'>[] = [
  { kind: 'catch', species: 'crucian', target: 5, text: '붕어 5마리 낚기', coins: 150, xp: 80 },
  { kind: 'catch', species: 'carp', target: 2, text: '잉어 2마리 낚기', coins: 260, xp: 140 },
  { kind: 'catch', species: 'bluegill', target: 6, text: '블루길 6마리 퇴치', coins: 120, xp: 60 },
  { kind: 'catch', species: 'bass', target: 2, text: '배스 2마리 퇴치', coins: 200, xp: 100 },
  { kind: 'catch', species: 'catfish', target: 1, text: '메기 1마리 낚기 (밤에 유리)', coins: 220, xp: 120 },
  { kind: 'catch', species: 'mirror', target: 2, text: '향어 2마리 낚기', coins: 240, xp: 130 },
  { kind: 'weight', target: 2, text: '2kg 넘는 고기 낚기', coins: 300, xp: 160 },
  { kind: 'release', target: 4, text: '고기 4마리 방생하기', coins: 100, xp: 90 },
  { kind: 'chum', target: 5, text: '집어 떡밥 5번 뿌리기', coins: 80, xp: 50 },
  { kind: 'sell', target: 500, text: '살림망을 팔아 500원 벌기', coins: 120, xp: 70 },
];

export function dailyQuests(day = today()): QuestDef[] {
  const n = dayNumber(day);
  const picks: number[] = [];
  for (let i = 0; picks.length < 3 && i < 40; i++) {
    const k = Math.floor(seeded(n * 7 + i) * QUEST_POOL.length);
    if (!picks.includes(k)) picks.push(k);
  }
  return picks.map(k => ({ ...QUEST_POOL[k], id: `${day}:${k}` }));
}

// ── 업적 ────────────────────────────────

export interface AchievementStats { catches: { species: SpeciesId; cm: number; kg: number }[]; earned: number; released: number; wins: number }
export interface AchievementDef { id: string; name: string; desc: string; coins: number; check(s: AchievementStats): [number, number] }
const count = (n: number) => (s: AchievementStats): [number, number] => [Math.min(n, s.catches.length), n];
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: '첫 손맛', desc: '처음으로 물고기를 낚는다', coins: 50, check: count(1) },
  { id: 'c50', name: '단골 조사', desc: '물고기 50마리를 낚는다', coins: 400, check: count(50) },
  { id: 'c200', name: '버들못 터줏대감', desc: '물고기 200마리를 낚는다', coins: 1500, check: count(200) },
  { id: 'wolchuk', name: '첫 붕어 대물', desc: '대물 등급 붕어를 낚는다 (30.3cm 이상)', coins: 500, check: s => [s.catches.some(c => c.species === 'crucian' && c.cm >= 30.3) ? 1 : 0, 1] },
  { id: 'meter', name: '미터급', desc: '100cm 넘는 고기를 낚는다', coins: 3000, check: s => [s.catches.some(c => c.cm >= 100) ? 1 : 0, 1] },
  { id: 'heavy', name: '묵직한 손맛', desc: '10kg 넘는 고기를 낚는다', coins: 1200, check: s => [s.catches.some(c => c.kg >= 10) ? 1 : 0, 1] },
  { id: 'dex5', name: '어류 관찰자', desc: '5종을 도감에 올린다', coins: 300, check: s => [Math.min(5, new Set(s.catches.map(c => c.species)).size), 5] },
  { id: 'dexall', name: '버들못 박사', desc: `${SPECIES_LIST.length}종 도감을 완성한다`, coins: 2000, check: s => [new Set(s.catches.map(c => c.species)).size, SPECIES_LIST.length] },
  { id: 'rich', name: '만원의 행복', desc: '판매로 10,000원을 번다', coins: 800, check: s => [Math.min(10000, s.earned), 10000] },
  { id: 'eco', name: '생태 지킴이', desc: '고기 30마리를 방생한다', coins: 400, check: s => [Math.min(30, s.released), 30] },
  { id: 'champ', name: '대회 우승', desc: '낚시 대회에서 1등을 한다', coins: 1000, check: s => [Math.min(1, s.wins), 1] },
];

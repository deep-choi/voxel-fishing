import { BAIT_IDS, BAIT_PACKS, FLOATS, HOOKS, INGREDIENTS, LINES, MAX_DEPLOYED_RODS, RODS, SPECIES, type BaitId, type IngredientId, type SpeciesId } from './data';
import { ACHIEVEMENTS, dailyQuests, fishValue, today, type QuestKind, type QuestState } from './economy';
import { KEEPNETS, NETS, SPECIES_RULES } from './items';
import { SKILL_IDS, SKILL_MAX, type SkillId } from './skills';
import type { Catch } from './fishing';
import { BAIT_PRODUCTS, LEGACY_CHUM_PRODUCTS, baitProduct } from './realCatalog';
import { ACTIVE_FISHERY, FISHERIES, type FisheryId } from './fisheries';
import { personalGoals } from './personalGoals';
import { createFeedBlend, FEED_MATERIALS, type FeedBlend, type FeedDraft } from './feedMixing';

export interface Rig { rodId: string; floatId: string; hookId: string; bait: BaitId; baitProductId?: string; lineIdx: number; depthSet: number }
export interface CatchRecord { id: string; species: SpeciesId; cm: number; kg: number; at: number; platform: number; fisheryId?: FisheryId; kept: boolean; sold: boolean; value: number; released?: boolean; rig?: Rig; releaseBonusPaid?: boolean }
export interface PlacedRig { slotId: string; ownerId: string; rig: Rig; fisheryId?: FisheryId }
export interface TournamentResult { id: string; name: string; at: number; rank: number; of: number; prize: number; score: string }
export interface PlayerSave {
  version: 1; playerId: string; coins: number; xp: number;
  baitMode: 'hook-only';
  /** chum은 구버전 재고 이전용이며 현재 저장에서는 항상 0이다. */
  baits: Record<BaitId | 'chum', number>; rods: Record<string, number>;
  /** 브랜드 재고는 baits 총량에 포함된다. 예전 저장은 전부 일반 미끼다. */
  baitProducts: Record<string, number>;
  baitBlends: FeedBlend[];
  ingredients: Record<IngredientId, number>;
  floats: string[]; hooks: string[]; rig: Rig; catches: CatchRecord[]; placed: PlacedRig[];
  // 러시안피싱4식 확장 (예전 저장에는 없을 수 있다)
  lines: string[]; nets: string[]; net: string; keepnets: string[]; keepnetId: string;
  /** 장비 마모 0~1: 'rod:starter', 'line:2' */
  wear: Record<string, number>;
  skills: Record<SkillId, number>;
  quests: { day: string; list: QuestState[] };
  achievements: string[];
  personalGoalClaims: string[];
  shopGoal?: { kind: ShopKind; id: string };
  stats: { earned: number; released: number; wins: number; equipmentPurchases: number };
  tournaments: TournamentResult[];
}
export type ShopKind = 'rod' | 'float' | 'hook' | 'line' | 'bait' | 'ingredient' | 'net' | 'keepnet';
const SHOP_KINDS: readonly ShopKind[] = ['rod', 'float', 'hook', 'line', 'bait', 'ingredient', 'net', 'keepnet'];

/** 로컬 저장소를 서버 저장소로 교체할 수 있도록 플레이어 데이터 경계를 분리한다. */
export interface ProfileRepository { load(): unknown; save(profile: PlayerSave): void }
export class LocalProfileRepository implements ProfileRepository {
  load(): unknown { try { return JSON.parse(localStorage.getItem('fishing-player-v1') ?? 'null'); } catch { return null; } }
  save(profile: PlayerSave) { localStorage.setItem('fishing-player-v1', JSON.stringify(profile)); }
}
const initial = (): PlayerSave => ({ version: 1, baitMode: 'hook-only', playerId: 'local-player', coins: 500, xp: 0,
  baitProducts: { 'kw-burger': 10, 'kw-aqua2': 5, 'mq-wata': 5 },
  baitBlends: [],
  baits: { worm: 20, paste: 25, corn: 10, chum: 0, gluten: 10, pellet: 10, shrimp: 10 }, rods: { starter: 3 }, floats: ['basic'], hooks: ['small'],
  ingredients: { bran: 10, cornmeal: 10, attractor: 3, fishmeal: 8, glutenpowder: 8, barley: 0, strawberry: 0 },
  rig: { rodId: 'starter', floatId: 'basic', hookId: 'small', bait: 'worm', lineIdx: 1, depthSet: 2.4 }, catches: [], placed: [],
  lines: ['1.5', '2'], nets: ['basic'], net: 'basic', keepnets: ['basic'], keepnetId: 'basic',
  wear: {},
  skills: { hookset: 0, strength: 0, chum: 0, trade: 0 },
  quests: { day: '', list: [] }, achievements: [], personalGoalClaims: [], stats: { earned: 0, released: 0, wins: 0, equipmentPurchases: 0 }, tournaments: [],
});
const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
const ids = (value: unknown, allowed: { id: string; price: number }[], fallback: string[]) =>
  Array.isArray(value) ? allowed.filter(a => a.price === 0 || value.includes(a.id)).map(a => a.id) : fallback;

export class PlayerProgress {
  readonly data: PlayerSave;
  readonly best: Record<string, number> = {};
  readonly keepnet: Catch[] = [];
  saveFailed = false;
  private goalCache: ReturnType<typeof personalGoals> | null = null;
  constructor(private readonly repository: ProfileRepository = new LocalProfileRepository()) {
    this.data = initial();
    const raw = repository.load();
    if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 1) {
      const s = raw as Partial<PlayerSave>;
      const d = this.data;
      d.coins = Math.floor(number(s.coins, 500)); d.xp = Math.floor(number(s.xp, 0));
      for (const id of [...BAIT_IDS, 'chum' as const]) d.baits[id] = Math.floor(number(s.baits?.[id], d.baits[id]));
      d.baitProducts = {};
      if (Array.isArray(s.baitBlends)) {
        const seen = new Set<string>();
        d.baitBlends = s.baitBlends.flatMap(raw => {
          if (!raw || typeof raw.id !== 'string' || !/^blend-[a-zA-Z0-9-]{1,80}$/.test(raw.id) || seen.has(raw.id)) return [];
          const blend = createFeedBlend(raw.id, raw);
          if (!blend) return [];
          seen.add(blend.id); return [blend];
        });
      }
      if (s.baitMode !== 'hook-only') {
        // 예전 총 집어 재고에는 제품·직접 배합·기본 떡밥이 모두 포함된다.
        const oldBlends = new Set((Array.isArray(s.baitBlends) ? s.baitBlends : []).filter(b => {
          const old = b as unknown as { use?: string; baseBait?: string };
          return old && (old.use === 'chum' || old.baseBait === 'chum');
        }).map(b => b.id));
        let remainingChum = d.baits.chum;
        for (const product of this.baitCatalog) {
          if (!LEGACY_CHUM_PRODUCTS.has(product.id) && !oldBlends.has(product.id)) continue;
          const count = Math.min(remainingChum, Math.floor(number(s.baitProducts?.[product.id], 0)));
          d.baits[product.baseBait] += count;
          remainingChum -= count;
        }
        d.baits.paste += remainingChum;
      }
      d.baits.chum = 0;
      // 제품별 재고 합이 총량을 넘지 않게 오래된/손상된 저장도 받아들인다.
      const remaining = { ...d.baits };
      for (const product of this.baitCatalog) {
        const count = Math.min(remaining[product.baseBait], Math.floor(number(s.baitProducts?.[product.id], 0)));
        d.baitProducts[product.id] = count;
        remaining[product.baseBait] -= count;
      }
      for (const item of INGREDIENTS) d.ingredients[item.id] = Math.floor(number(s.ingredients?.[item.id], d.ingredients[item.id]));
      for (const rod of RODS) d.rods[rod.id] = Math.floor(number(s.rods?.[rod.id], rod.id === 'starter' ? 3 : 0));
      d.floats = ids(s.floats, FLOATS, d.floats);
      d.hooks = ids(s.hooks, HOOKS, d.hooks);
      // 예전에는 원줄 4종이 모두 기본이었다
      d.lines = ids(s.lines ?? LINES.slice(0, 4).map(l => l.id), LINES, d.lines);
      d.nets = ids(s.nets, NETS, d.nets);
      d.keepnets = ids(s.keepnets, KEEPNETS, d.keepnets);
      if (s.net && d.nets.includes(s.net)) d.net = s.net;
      if (s.keepnetId && d.keepnets.includes(s.keepnetId)) d.keepnetId = s.keepnetId;
      if (s.wear && typeof s.wear === 'object') for (const [k, v] of Object.entries(s.wear)) d.wear[k] = Math.min(1, number(v, 0));
      for (const id of SKILL_IDS) d.skills[id] = Math.min(SKILL_MAX, Math.floor(number(s.skills?.[id], 0)));
      if (s.quests && typeof s.quests.day === 'string' && Array.isArray(s.quests.list)) d.quests = s.quests;
      if (s.baitMode !== 'hook-only') for (const quest of d.quests.list) {
        if (typeof quest.id === 'string' && quest.id.endsWith(':8') && !quest.claimed) quest.progress = 0;
      }
      if (Array.isArray(s.achievements)) d.achievements = s.achievements.filter(a => typeof a === 'string');
      if (Array.isArray(s.personalGoalClaims)) d.personalGoalClaims = [...new Set(s.personalGoalClaims.filter(a => typeof a === 'string'))];
      if (s.shopGoal && SHOP_KINDS.includes(s.shopGoal.kind) && PlayerProgress.catalog(s.shopGoal.kind).some(i => i.id === s.shopGoal!.id)) d.shopGoal = { kind: s.shopGoal.kind, id: s.shopGoal.id };
      // 구버전에도 보유 중인 유료 장비는 첫 구매 목표로 인정한다.
      const paidGear = RODS.some(r => r.price > 0 && d.rods[r.id] > (r.id === 'starter' ? 3 : 0))
        || (['float', 'hook', 'line', 'net', 'keepnet'] as const).some(kind => PlayerProgress.catalog(kind).some(i =>
          i.price > 0 && this.owns(kind, i.id) && !(kind === 'line' && ['1.5', '2', '3', '4'].includes(i.id))));
      d.stats = { earned: number(s.stats?.earned, 0), released: number(s.stats?.released, 0), wins: number(s.stats?.wins, 0), equipmentPurchases: Math.floor(number(s.stats?.equipmentPurchases, +paidGear)) };
      if (Array.isArray(s.tournaments)) d.tournaments = s.tournaments.slice(-20);
      if (s.rig) d.rig = this.normalizeRig(s.rig);
      if (Array.isArray(s.catches)) {
        const seen = new Set<string>();
        d.catches = s.catches.filter(c => {
          if (!c || !(c.species in SPECIES) || typeof c.id !== 'string' || seen.has(c.id) || !(c.cm > 0) || !Number.isFinite(c.cm) || !(c.kg > 0) || !Number.isFinite(c.kg) || !Number.isFinite(c.at) || !Number.isFinite(c.value) || c.value < 0) return false;
          seen.add(c.id); return true;
        });
      }
      if (Array.isArray(s.placed)) d.placed = FISHERIES.flatMap(f => {
        const seen = new Set<string>();
        return s.placed!.filter(p => {
          if (!p || typeof p.slotId !== 'string' || (p.fisheryId ?? 'willow') !== f.id || seen.has(p.slotId)) return false;
          seen.add(p.slotId); return true;
        }).slice(0, MAX_DEPLOYED_RODS).map(p => ({ slotId: p.slotId, ownerId: d.playerId, rig: this.normalizeRig(p.rig), fisheryId: f.id }));
      });
    }
    for (const c of this.data.catches) {
      this.best[c.species] = Math.max(this.best[c.species] ?? 0, c.cm);
      if (c.kept && !c.sold && !c.released) this.keepnet.push({ id: c.id, species: SPECIES[c.species], cm: c.cm, kg: c.kg, at: c.at, rank: null, best: false });
    }
    // 이전 프로토타입의 최대어 기록을 이어받는다.
    try { const legacy = JSON.parse(localStorage.getItem('fishing-best') ?? '{}'); for (const id of Object.keys(SPECIES)) this.best[id] = Math.max(this.best[id] ?? 0, number(legacy[id], 0)); } catch { /* 이전 기록 없음 */ }
    this.ensureQuests();
  }
  normalizeRig(rig: Partial<Rig> = {}): Rig {
    const rod = RODS.find(r => r.id === rig.rodId && this.data.rods[r.id] > 0) ?? RODS[0];
    const lineIdx = Math.min(LINES.length - 1, Math.floor(number(rig.lineIdx, 1)));
    const product = this.baitProduct(rig.baitProductId);
    return { rodId: rod.id, floatId: this.data.floats.includes(rig.floatId ?? '') ? rig.floatId! : 'basic',
      hookId: this.data.hooks.includes(rig.hookId ?? '') ? rig.hookId! : 'small',
      bait: rig.bait && BAIT_IDS.includes(rig.bait) ? rig.bait : 'worm',
      baitProductId: product && product.baseBait === rig.bait ? product.id : undefined,
      lineIdx: this.data.lines.includes(LINES[lineIdx].id) ? lineIdx : 1, depthSet: Math.max(0.3, Math.min(rod.line, number(rig.depthSet, 2.4))) };
  }
  get ownerId() { return this.data.playerId; }
  get level() { return 1 + Math.floor(Math.sqrt(this.data.xp / 100)); }
  /** 다음 레벨까지 진행도 0~1 (마인크래프트 경험치 바) */
  get levelProgress() {
    const lv = this.level, from = (lv - 1) ** 2 * 100, to = lv ** 2 * 100;
    return (this.data.xp - from) / (to - from);
  }
  get skillPoints() { return this.level - 1 - SKILL_IDS.reduce((n, id) => n + this.data.skills[id], 0); }
  get netSpec() { return NETS.find(n => n.id === this.data.net) ?? NETS[0]; }
  get keepnetSpec() { return KEEPNETS.find(k => k.id === this.data.keepnetId) ?? KEEPNETS[0]; }
  get keepnetKg() { return this.keepnet.reduce((n, c) => n + c.kg, 0); }
  save() { this.goalCache = null; try { this.repository.save(this.data); this.saveFailed = false; } catch { this.saveFailed = true; } }
  get baitCatalog() { return [...BAIT_PRODUCTS, ...this.data.baitBlends]; }
  baitProduct = (id?: string) => this.data.baitBlends.find(b => b.id === id) ?? baitProduct(id);
  genericBaitCount(id: BaitId) {
    return Math.max(0, this.data.baits[id] - this.baitCatalog.filter(p => p.baseBait === id).reduce((n, p) => n + (this.data.baitProducts[p.id] ?? 0), 0));
  }
  consumeBait = (id: BaitId, productId?: string): boolean => {
    if (this.data.baits[id] <= 0) return false;
    if (productId) {
      const product = this.baitProduct(productId);
      if (!product || product.baseBait !== id || !(this.data.baitProducts[productId] > 0)) return false;
      this.data.baitProducts[productId]--;
    } else if (this.genericBaitCount(id) <= 0) return false;
    this.data.baits[id]--;
    this.save(); return true;
  };

  static catalog(kind: ShopKind): { id: string; name: string; price: number; level?: number }[] {
    return kind === 'rod' ? RODS : kind === 'float' ? FLOATS : kind === 'hook' ? HOOKS : kind === 'line' ? LINES
      : kind === 'bait' ? [...BAIT_PACKS, ...BAIT_PRODUCTS] : kind === 'ingredient' ? [...INGREDIENTS] : kind === 'net' ? NETS : KEEPNETS;
  }
  get shopGoal() {
    const goal = this.data.shopGoal;
    if (!goal || this.owns(goal.kind, goal.id)) return undefined;
    const item = PlayerProgress.catalog(goal.kind).find(i => i.id === goal.id);
    return item ? { ...item, kind: goal.kind } : undefined;
  }
  setShopGoal(kind: ShopKind, id: string) {
    if (!SHOP_KINDS.includes(kind) || !PlayerProgress.catalog(kind).some(i => i.id === id)) return '상품을 찾을 수 없어요';
    if (this.owns(kind, id)) return '이미 보유한 장비예요';
    this.data.shopGoal = { kind, id }; this.save(); return '구매 목표를 정했어요';
  }
  clearShopGoal() { delete this.data.shopGoal; this.save(); return '구매 목표를 해제했어요'; }
  /** 한 번 사면 계속 쓰는 장비 */
  owns(kind: ShopKind, id: string) {
    const d = this.data;
    return kind === 'float' ? d.floats.includes(id) : kind === 'hook' ? d.hooks.includes(id) : kind === 'line' ? d.lines.includes(id)
      : kind === 'net' ? d.nets.includes(id) : kind === 'keepnet' ? d.keepnets.includes(id) : false;
  }
  buy(kind: ShopKind, id: string): string {
    const item = PlayerProgress.catalog(kind).find(i => i.id === id);
    if (!item) return '상품을 찾을 수 없어요';
    if (this.owns(kind, id)) return '이미 보유한 장비예요';
    if ((item.level ?? 1) > this.level) return `레벨 ${item.level}부터 살 수 있어요`;
    if (this.data.coins < item.price) return '보유 금액이 부족해요';
    const d = this.data;
    d.coins -= item.price;
    if (kind === 'rod') d.rods[id] = (d.rods[id] ?? 0) + 1;
    if (kind === 'float') d.floats.push(id);
    if (kind === 'hook') d.hooks.push(id);
    if (kind === 'line') d.lines.push(id);
    if (kind === 'net') { d.nets.push(id); d.net = id; }
    if (kind === 'keepnet') { d.keepnets.push(id); d.keepnetId = id; }
    if (kind === 'bait' && 'count' in item) {
      const product = baitProduct(id);
      const baseBait = product?.baseBait ?? (id as BaitId);
      d.baits[baseBait] += item.count as number;
      if (product) d.baitProducts[id] = (d.baitProducts[id] ?? 0) + (item.count as number);
    }
    if (kind === 'ingredient' && 'count' in item) d.ingredients[id as IngredientId] += item.count as number;
    if (item.price > 0 && kind !== 'bait' && kind !== 'ingredient') d.stats.equipmentPurchases++;
    if (d.shopGoal?.kind === kind && d.shopGoal.id === id) delete d.shopGoal;
    this.save(); return `${item.name} 구매 완료`;
  }
  equip(kind: 'net' | 'keepnet', id: string) {
    if (kind === 'net' && this.data.nets.includes(id)) this.data.net = id;
    if (kind === 'keepnet' && this.data.keepnets.includes(id)) {
      const spec = KEEPNETS.find(k => k.id === id)!;
      if (this.keepnet.length > spec.capacity) return `지금 담긴 고기가 그 살림망 한도(${spec.capacity}마리)보다 많아요`;
      this.data.keepnetId = id;
    }
    this.save(); return '장착했어요';
  }

  // ── 장비 마모·수리 ──
  wearOf(key: string) { return this.data.wear[key] ?? 0; }
  addWear(key: string, amount: number) { this.data.wear[key] = Math.min(1, this.wearOf(key) + amount); }
  repairCost(key: string) {
    const [kind, id] = key.split(':');
    // 기본 채비는 무료 정비하여 돈·미끼가 모두 없어도 다시 낚시할 수 있다.
    if ((kind === 'rod' && id === 'starter') || (kind === 'line' && ['1.5', '2'].includes(id))) return 0;
    const price = kind === 'rod' ? RODS.find(r => r.id === id)?.price ?? 100 : LINES.find(l => l.id === id)?.price ?? 0;
    // 원줄은 새로 감는다 (최소 20원), 낚싯대는 마모만큼 수리비
    return kind === 'line' ? Math.max(20, Math.round(price * 0.4)) : Math.max(10, Math.round(price * 0.45 * this.wearOf(key)));
  }
  repair(key: string) {
    const [kind, id] = key.split(':');
    if (!(kind === 'rod' ? this.data.rods[id] > 0 : kind === 'line' && this.data.lines.includes(id))) return '보유한 장비만 정비할 수 있어요';
    if (this.wearOf(key) < 0.01) return '수리할 필요가 없어요';
    const cost = this.repairCost(key);
    if (this.data.coins < cost) return '수리비가 부족해요';
    this.data.coins -= cost; this.data.wear[key] = 0; this.save();
    return key.startsWith('line') ? '새 원줄로 감았어요' : '낚싯대를 수리했어요';
  }

  // ── 조과·판매 ──
  catchValue(c: Catch) { return fishValue(c.species.id, c.cm, c.kg, this.data.skills.trade); }
  /** 생태계교란종은 방생 대신 수매금을 받는다 */
  bounty(c: Catch) { return SPECIES_RULES[c.species.id].bounty ?? 0; }
  /** 금지 체장: 이보다 작으면 살림망에 넣을 수 없다 */
  tooSmall(c: Catch) { const min = SPECIES_RULES[c.species.id].minKeepCm; return min !== undefined && c.cm < min; }
  recordCatch(c: Catch, kept: boolean, platform: number, rig?: Rig) {
    if (c.id && this.data.catches.some(record => record.id === c.id)) return { xp: 0, bounty: 0 };
    const id = c.id ?? crypto.randomUUID();
    c.id = id;
    const bounty = !kept ? this.bounty(c) : 0;
    this.data.catches.push({ id, species: c.species.id, cm: c.cm, kg: c.kg, at: c.at, platform, fisheryId: ACTIVE_FISHERY.id, kept, sold: !kept, released: !kept && !bounty, value: kept ? this.catchValue(c) : bounty, rig: rig ? { ...rig } : undefined, releaseBonusPaid: !kept });
    if (bounty) { this.data.coins += bounty; this.data.stats.earned += bounty; }
    else if (!kept) { this.data.stats.released++; this.progressQuest('release', 1); }
    this.progressQuest('catch', 1, c.species.id);
    if (c.kg >= 2) this.progressQuest('weight', 1);
    // 방생하면 경험치를 조금 더 준다
    const xp = Math.max(10, Math.round((c.cm + c.kg * 15) * (kept ? 1 : 1.2)));
    this.data.xp += xp;
    this.save(); return { xp, bounty };
  }
  sellKeepnet() {
    let coins = 0;
    for (const c of this.data.catches) if (c.kept && !c.sold && !c.released) { coins += c.value; c.sold = true; }
    this.data.coins += coins; this.data.stats.earned += coins; this.keepnet.length = 0;
    this.progressQuest('sell', coins);
    this.save(); return coins;
  }
  /** 어시장: 살림망에서 한 마리를 판다 */
  sellFish(id: string) {
    const record = this.data.catches.find(c => c.id === id && c.kept && !c.sold && !c.released);
    const i = this.keepnet.findIndex(c => c.id === id);
    if (!record || i < 0) return '';
    const c = this.keepnet[i];
    this.keepnet.splice(i, 1);
    record.sold = true;
    this.data.coins += record.value; this.data.stats.earned += record.value;
    this.progressQuest('sell', record.value);
    this.save(); return `${c.species.name} 판매 +${record.value.toLocaleString()}원`;
  }
  /** 살림망에서 한 마리를 꺼내 놓아준다 */
  releaseFromKeepnet(id: string) {
    const record = this.data.catches.find(c => c.id === id && c.kept && !c.sold && !c.released);
    const i = this.keepnet.findIndex(c => c.id === id);
    if (!record || i < 0) return '';
    const c = this.keepnet[i];
    this.keepnet.splice(i, 1);
    record.sold = true; record.value = 0;
    // 즉시 방생과 살림망에서 나중에 방생하는 경우의 총 경험치를 같게 맞춘다.
    if (!record.releaseBonusPaid) {
      const base = record.cm + record.kg * 15;
      this.data.xp += Math.max(10, Math.round(base * 1.2)) - Math.max(10, Math.round(base));
      record.releaseBonusPaid = true;
    }
    if (this.bounty(c)) return this.sellOne(record);
    record.released = true; this.data.stats.released++; this.progressQuest('release', 1);
    this.save(); return `${c.species.name}을(를) 놓아줬어요`;
  }
  private sellOne(record: CatchRecord) {
    const bounty = SPECIES_RULES[record.species].bounty ?? 0;
    record.value = bounty; this.data.coins += bounty; this.data.stats.earned += bounty;
    this.save(); return `교란종 수매 +${bounty}원`;
  }
  get canGatherWorms() { return this.data.baits.worm === 0 && this.data.coins < (BAIT_PACKS.find(p => p.id === 'worm')?.price ?? 30); }
  gatherWorms() {
    if (!this.canGatherWorms) return '지렁이가 없고 구매할 돈이 부족할 때 채집할 수 있어요';
    this.data.baits.worm += 5; this.save(); return '지렁이 5개를 채집했어요';
  }
  feedMaterialCount(key: string) {
    if (!FEED_MATERIALS.some(m => m.key === key)) return 0;
    const [kind, id] = key.split(':');
    return kind === 'ingredient' ? this.data.ingredients[id as IngredientId] ?? 0
      : kind === 'product' ? this.data.baitProducts[id] ?? 0 : this.genericBaitCount(id as BaitId);
  }
  craftFeed(draft: FeedDraft): { ok: boolean; message: string } {
    const blend = createFeedBlend(`blend-${crypto.randomUUID()}`, draft);
    if (!blend) return { ok: false, message: '재료와 배합량을 확인해 주세요' };
    if (blend.parts.some(p => this.feedMaterialCount(p.key) < p.count)) return { ok: false, message: '떡밥 재료가 부족해요' };
    for (const part of blend.parts) {
      const [kind, id] = part.key.split(':');
      if (kind === 'ingredient') this.data.ingredients[id as IngredientId] -= part.count;
      else {
        const base = kind === 'product' ? baitProduct(id)!.baseBait : id as BaitId;
        this.data.baits[base] -= part.count;
        if (kind === 'product') this.data.baitProducts[id] -= part.count;
      }
    }
    this.data.baitBlends.push(blend);
    this.data.baitProducts[blend.id] = blend.count;
    this.data.baits[blend.baseBait] += blend.count;
    this.save();
    return { ok: true, message: `${blend.name} ${blend.count}회분을 만들었어요` };
  }

  // ── 기술 ──
  learn(id: SkillId) {
    if (this.skillPoints <= 0) return '기술 포인트가 없어요. 레벨을 올려 보세요';
    if (this.data.skills[id] >= SKILL_MAX) return '이미 최고 단계예요';
    this.data.skills[id]++; this.save(); return '기술을 배웠어요';
  }

  // ── 일일 의뢰·업적 ──
  get personalGoals() { return this.goalCache ??= personalGoals(this.data); }
  claimPersonalGoal(id: string) {
    const goal = this.personalGoals.find(g => g.id === id);
    if (!goal || goal.claimed) return '이미 받은 목표 보상이에요';
    if (goal.locked || goal.have < goal.need) return '아직 달성하지 못했어요';
    this.data.personalGoalClaims.push(id);
    this.data.coins += goal.coins; this.data.xp += goal.xp;
    this.save(); return `목표 달성 · +${goal.coins}원 · +${goal.xp} 경험치`;
  }
  ensureQuests() {
    const day = today();
    if (this.data.quests.day === day) return;
    this.data.quests = { day, list: dailyQuests(day).map(q => ({ id: q.id, progress: 0, claimed: false })) };
  }
  progressQuest(kind: QuestKind, amount: number, species?: SpeciesId) {
    this.ensureQuests();
    const defs = dailyQuests(this.data.quests.day);
    for (const state of this.data.quests.list) {
      const def = defs.find(d => d.id === state.id);
      if (!def || def.kind !== kind || (def.species && def.species !== species)) continue;
      state.progress = Math.min(def.target, state.progress + amount);
    }
  }
  claimQuest(id: string) {
    const def = dailyQuests(this.data.quests.day).find(d => d.id === id);
    const state = this.data.quests.list.find(q => q.id === id);
    if (!def || !state || state.claimed || state.progress < def.target) return '아직 완료하지 못했어요';
    state.claimed = true; this.data.coins += def.coins; this.data.xp += def.xp;
    this.save(); return `의뢰 보상 +${def.coins}원 · +${def.xp} 경험치`;
  }
  get achievementStats() {
    return { catches: this.data.catches, earned: this.data.stats.earned, released: this.data.stats.released, wins: this.data.stats.wins };
  }
  claimAchievement(id: string) {
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def || this.data.achievements.includes(id)) return '';
    const [have, need] = def.check(this.achievementStats);
    if (have < need) return '아직 달성하지 못했어요';
    this.data.achievements.push(id); this.data.coins += def.coins;
    this.save(); return `업적 「${def.name}」 보상 +${def.coins}원`;
  }
  get claimable() {
    const quests = this.data.quests.list.filter(q => !q.claimed && q.progress >= (dailyQuests(this.data.quests.day).find(d => d.id === q.id)?.target ?? Infinity)).length;
    const achievements = ACHIEVEMENTS.filter(a => !this.data.achievements.includes(a.id) && (([h, n]) => h >= n)(a.check(this.achievementStats))).length;
    const goals = this.personalGoals.filter(g => !g.claimed && !g.locked && g.have >= g.need).length;
    return quests + achievements + goals;
  }

  // ── 대회 ──
  payEntry(fee: number) {
    if (this.data.coins < fee) return false;
    this.data.coins -= fee; this.save(); return true;
  }
  finishTournament(result: TournamentResult) {
    this.data.tournaments.push(result);
    this.data.tournaments = this.data.tournaments.slice(-20);
    this.data.coins += result.prize; this.data.stats.earned += result.prize;
    if (result.rank === 1) this.data.stats.wins++;
    this.save();
  }
}

import { BAITS, BAIT_PACKS, FEED_RECIPES, FLOATS, HOOKS, floatTraits, INGREDIENTS, LINES, MAX_DEPLOYED_RODS, RODS, SPECIES, SPECIES_LIST, type BaitId, type IngredientId, type Rarity, type SpeciesId } from '../game/data';
import { ACHIEVEMENTS, dailyQuests, marketMul } from '../game/economy';
import { WEATHER, type Environment } from '../game/environment';
import type { Fishing } from '../game/fishing';
import { ACTIVE_FISHERY, FISHERIES, FISHERY_CAPACITY, canEnterFishery, findFishery } from '../game/fisheries';
import { KEEPNETS, NETS, SPECIES_RULES } from '../game/items';
import type { PlayerProgress, ShopKind } from '../game/profile';
import { BAIT_PRODUCTS, BRANDS, catalogInfo } from '../game/realCatalog';
import { SKILLS, SKILL_MAX } from '../game/skills';
import { TOURNAMENTS, TOURNAMENTS_OPEN, tournamentAvailable, type Tournament } from '../game/tournament';
import { fishIcon, itemIcon } from './pixelIcons';
import type { Settings } from './settings';
import type { OnlineState, OnlineTab } from '../game/onlineState';
import type { FisheryId } from '../game/fisheries';
import { hookGap, hookLoad, hookSharpness, hookSizeLabel, lineDiameter, lineGo } from '../game/rigMechanics';
import { rankOf } from '../game/data';
import './sizeRanks.css';
import { itemQuality, QUALITY_LABELS } from '../game/itemQuality';
import './shopQuality.css';

// 패널 화면들: 상태를 받아 HTML 문자열을 돌려준다. 클릭은 data-act로 hud.ts가 처리한다.

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export function sizeRankBadge(id: SpeciesId, cm: number) {
  const name = rankOf(SPECIES[id], cm) ?? '일반';
  const tone = name === '전설급' ? 'legend' : name === '초대물' ? 'trophy' : name === '대물' ? 'large' : name === '준대물' ? 'promising' : 'normal';
  return `<span class="size-rank ${tone}">${name}</span>`;
}
export const kgText = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)}g` : `${kg.toFixed(2)}kg`);
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

export type ShopTab = 'bait' | 'rod' | 'line' | 'float' | 'hook' | 'net' | 'repair';
/** 가방 분류 탭 */
export type InvTab = 'all' | 'rod' | 'tackle' | 'bait' | 'gear' | 'craft';
export type RigStep = 'rod' | 'line' | 'float' | 'depth' | 'hook' | 'bait';
export interface PlatformStatus { id: number; name: string; rods: number; bites: number }
export interface RodStatus { slotId: string; number: number; rodId: string; name: string; platform: number; state: string; active: boolean; biting: boolean }
export interface UiState {
  inventoryTab: InvTab; invSelected: string | null;
  shopTab: ShopTab; shopQuality: number; shopAffordable: boolean; rigStep: RigStep;
  /** 채비 창에서 고른 대: 자리 id 또는 'default'(새로 꺼낼 대). null이면 손에 든 대 */
  rigTarget: string | null;
  recordSpecies: SpeciesId; weekly: boolean;
  questTab: 'personal' | 'daily' | 'achieve';
  goalGroup: 'start' | 'species' | 'fishery' | 'record' | 'challenge';
  resetArmed: boolean;
  onlineSpecies: SpeciesId; onlineScope: 'all' | FisheryId; nicknameDraft: string; chatDraft: string;
}
export interface PanelCtx {
  player: PlayerProgress; game: Fishing; env: Environment; tournament: Tournament | null;
  rodSlots: RodStatus[]; platforms: PlatformStatus[]; currentPlatform: number | null; activeRod: string | null;
  /** 채비 창이 보여 주는 대와 그 대의 채비 */
  rigTarget: string; rigGame: Fishing;
  ui: UiState; settings: Settings;
  online: OnlineState;
}

const rarityName = (r: Rarity | undefined, name: string) => `<b class="r-${r ?? 'common'}">${esc(name)}</b>`;
const qualityBadge = (kind: string, id: string) => {
  const q = itemQuality(kind === 'ing' ? 'ingredient' : kind, id);
  return `<span class="item-quality quality-${q.tier}">${esc(q.label)}</span>`;
};
/** 마인크래프트식 아이템 칸 */
export const slot = (icon: string, count: string | number = '', attrs = '', extra = '') =>
  `<button class="slot ${extra}" ${attrs}><span class="slot-art">${icon}</span>${count !== '' ? `<span class="count">${count}</span>` : ''}</button>`;
const bar = (ratio: number, tone = '') => `<span class="bar ${tone}"><i style="width:${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%"></i></span>`;
const wearBar = (wear: number) => `<span class="wear">내구도 ${bar(1 - wear, wear > 0.7 ? 'bad' : wear > 0.4 ? 'warn' : 'good')} ${Math.round((1 - wear) * 100)}%</span>`;
const close = (key: string) => `<button class="btn primary" data-act="resume">닫기 <kbd>${key}</kbd></button>`;
const productNote = (kind: string, id: string) => {
  const info = catalogInfo(kind, id);
  return info ? `<span class="product-note"><b>${BRANDS[info.brand]}</b> · ${esc(info.facts)} · <a href="${esc(info.source)}" target="_blank" rel="noopener noreferrer">${info.sourceKind === 'official' ? '제조사 자료' : '판매처 자료'}</a></span>` : '';
};
const tabs = (act: string, current: string, list: [string, string][]) =>
  `<div class="record-tabs">${list.map(([id, name]) => `<button class="btn small ${id === current ? 'on' : ''}" data-act="${act}" data-id="${id}">${name}</button>`).join('')}</div>`;

export const fisheryOccupancy = (state: OnlineState | undefined, id: FisheryId) => `${state?.fisheryCounts[id] ?? '—'} / ${FISHERY_CAPACITY}명`;
export function fisheryCards(online?: OnlineState) {
  return `<div class="fishery-grid">${FISHERIES.map(f => `<button class="fishery-card ${f.id === ACTIVE_FISHERY.id ? 'selected' : ''}" data-act="fishery" data-id="${f.id}" ${canEnterFishery(f.id) ? '' : 'disabled'} style="--map-water:${f.palette.shallow};--map-leaf:${f.palette.leaf};--map-sand:${f.palette.sand};--map-accent:${f.palette.accent}">
    <span class="fishery-preview ${f.id}"><i class="preview-hill"></i><i class="preview-shore"></i><i class="preview-deck"></i><i class="preview-roof"></i></span>
    <span class="fishery-heading"><b>${f.name}</b><em>${!canEnterFishery(f.id) ? '준비 중' : f.id === ACTIVE_FISHERY.id ? '현재 낚시터' : f.difficulty}</em></span>
    <small>${f.theme}</small><span class="fishery-desc">${f.desc}</span>
    <small>좌대 수심 ${f.platforms.depths[0]}~${f.platforms.depths[3]}m · 8좌대 · 좌대당 3대</small>
    <span class="fishery-occupancy" data-fishery-count="${f.id}">${fisheryOccupancy(online, f.id)}</span>
  </button>`).join('')}</div>`;
}

function onlinePanel(c: PanelCtx, tab: Exclude<OnlineTab, 'chat'>) {
  const s = c.online, ui = c.ui;
  const login = `<button class="btn primary" data-act="online-login" ${s.busy || !s.ready ? 'disabled' : ''}>${s.busy ? '로그인 중…' : 'Google 로그인'}</button>`;
  let body = '';
  if (tab === 'account') {
    body = !s.ready ? '<p class="empty">계정을 연결하고 있어요…</p>' : s.uid ? `<p class="online-name">${s.nickname ? esc(s.nickname) : '닉네임을 정해 주세요'}</p>
      <label class="online-field">닉네임<input id="nickname-input" data-act="nickname-draft" aria-label="닉네임" value="${esc(ui.nicknameDraft || s.nickname)}" maxlength="12" autocomplete="off" placeholder="한글·영문·숫자·밑줄 2~12자"></label>
      <div class="row"><button class="btn primary" data-act="online-nickname" ${s.busy ? 'disabled' : ''}>${s.busy ? '저장 중…' : '닉네임 저장'}</button><button class="btn" data-act="online-logout" ${s.busy ? 'disabled' : ''}>로그아웃</button></div>`
      : `<p class="empty">구글 계정으로 로그인하고 나만의 닉네임을 정하세요.</p>${login}`;
  }
  if (tab === 'ranking') {
    body = `${tabs('online-scope', ui.onlineScope, [['all', '전체 낚시터'], [ACTIVE_FISHERY.id, ACTIVE_FISHERY.name]])}
      ${tabs('online-species', ui.onlineSpecies, SPECIES_LIST.map(sp => [sp.id, sp.name]))}
      <p class="depth-note">${SPECIES[ui.onlineSpecies].name} 최대 길이 · 상위 20명 · 로그인 후 잡은 고기가 반영됩니다.</p>
      ${s.loadingRanking ? '<p class="empty">랭킹을 불러오는 중…</p>' : s.rankings.length ? `<ol class="online-ranking">${s.rankings.map((r, i) => `<li class="${r.uid === s.uid ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.nickname)}</b><strong>${r.cm.toFixed(1)}cm</strong><small>${sizeRankBadge(ui.onlineSpecies, r.cm)} ${kgText(r.kg)} · ${(findFishery(r.fisheryId) ?? FISHERIES[0]).name}</small></li>`).join('')}</ol>` : '<p class="empty">아직 등록된 기록이 없어요.</p>'}`;
  }
  return `<div class="panel ${tab === 'ranking' ? 'wide' : ''} online-panel"><h2>${tab === 'account' ? '계정' : '온라인 최대어 랭킹'}</h2>
    ${s.error ? `<p class="warn" role="alert">${esc(s.error)}</p>` : ''}${body}${close(tab === 'ranking' ? 'L' : 'Esc')}</div>`;
}
export const accountPanel = (c: PanelCtx) => onlinePanel(c, 'account');
export const onlineRankingPanel = (c: PanelCtx) => onlinePanel(c, 'ranking');
export function dockMessages(state: OnlineState) {
  return state.loadingChat ? '<p class="chat-hint">채팅을 불러오는 중…</p>' : state.messages.length
    ? state.messages.map(m => `<div class="dock-message ${m.uid === state.uid ? 'mine' : ''}"><b>${esc(m.nickname)}</b><span>${esc(m.text)}</span></div>`).join('')
    : '<p class="chat-hint">Enter로 첫 인사를 남겨 보세요</p>';
}

// ── 채비 조립 (러시안피싱4의 채비 화면처럼 대→원줄→찌→바늘→미끼 순서) ──

export function setupPanel(c: PanelCtx) {
  const { rigGame: g, player: p, ui } = c;
  const d = p.data;
  const lockAttr = g.canRig ? '' : 'disabled';
  // 위: 편성한 대(최대 3대) 중 어느 대의 채비를 볼지. 3대가 안 되면 새로 꺼낼 대의 기본 채비도
  const slots = [...c.rodSlots].sort((a, b) => a.number - b.number);
  const target = (id: string, icon: string, sub: string, name: string) =>
    `<button class="rig-target ${c.rigTarget === id ? 'on' : ''}" data-act="rig-target" data-id="${id}"><span class="slot-art">${icon}</span><span><small>${sub}</small><b>${esc(name)}</b></span></button>`;
  const targets = slots.map(r => target(r.slotId, itemIcon('rod', r.rodId), `${r.number}번 대 · ${esc(r.state)}`, r.name));
  if (slots.length < MAX_DEPLOYED_RODS) targets.push(target('default', itemIcon('rig'), '새로 꺼낼 대', '기본 채비'));
  const steps: [RigStep, string, string, string][] = [
    ['rod', '낚싯대', itemIcon('rod', g.rodId), `${g.rod.name}`],
    ['line', '원줄', itemIcon('line'), g.line.name],
    ['float', '찌', itemIcon('float', g.floatId), g.floatSpec.name],
    ['depth', '찌 수심', itemIcon('sinker'), `${g.depthSet.toFixed(1)}m`],
    ['hook', '바늘', itemIcon('hook'), g.hook.name],
    ['bait', '미끼', itemIcon(g.bait), `${g.baitName} · ${g.baitProduct ? d.baitProducts[g.baitProduct.id] ?? 0 : p.genericBaitCount(g.bait)}${BAITS[g.bait].unit ?? '회분'}`],
  ];
  const choice = (on: boolean, act: string, kind: string, id: string, enabled: boolean, icon: string, title: string, body: string) =>
    `<button class="choice ${on ? 'on' : ''}" data-act="${act}" data-kind="${kind}" data-id="${id}" ${g.canRig && enabled ? '' : 'disabled'}><span class="item-icon">${icon}</span>${title}<small>${body}</small></button>`;
  // 보유한 장비만 보인다
  const opts: string[] = [];
  if (ui.rigStep === 'rod') for (const r of RODS) {
    const owned = d.rods[r.id] ?? 0;
    if (!owned) continue;
    // 다른 대에 이미 쓰고 있는 수량은 뺀다
    const free = owned - c.rodSlots.filter(s => s.rodId === r.id && s.slotId !== c.rigTarget).length;
    opts.push(choice(r.id === g.rodId, 'rig', 'rod', r.id, free > 0 || r.id === g.rodId, itemIcon('rod', r.id), rarityName(r.rarity, r.name),
      `길이 ${r.length}m · 원줄 ${r.line}m · 힘 ${r.power}kg<br>${r.id === g.rodId ? '사용 중' : free > 0 ? `남은 ${free}대` : '모두 편성됨'} ${wearBar(p.wearOf(`rod:${r.id}`))}`));
  }
  if (ui.rigStep === 'line') LINES.forEach((l, i) => {
    if (d.lines.includes(l.id)) opts.push(choice(i === g.lineIdx, 'line', 'line', String(i), true, itemIcon('line'), rarityName(l.rarity, l.name),
      `게임 굵기 ${lineDiameter(l).toFixed(3)}mm · ${l.strength.toFixed(1)}kg에 끊어짐<br>${wearBar(p.wearOf(`line:${l.id}`))}`));
  });
  if (ui.rigStep === 'float') for (const f of FLOATS) if (d.floats.includes(f.id)) opts.push(choice(f.id === g.floatId, 'rig', 'float', f.id, true, itemIcon('float', f.id), rarityName(f.rarity, f.name),
    `${floatTraits(f)}${f.glow ? '' : ' · 밤엔 안 보임'}`));
  if (ui.rigStep === 'hook') for (const h of HOOKS) if (d.hooks.includes(h.id)) opts.push(choice(h.id === g.hookId, 'rig', 'hook', h.id, true, itemIcon('hook'), rarityName(h.rarity, h.name),
    `${hookSizeLabel(h)} · 유지력 ${h.hold}`));
  if (ui.rigStep === 'bait') {
    for (const b of Object.values(BAITS)) {
      const on = g.bait === b.id && !g.baitProductId;
      const count = p.genericBaitCount(b.id);
      if (count > 0 || on) opts.push(choice(on, 'bait', 'bait', b.id, count > 0, itemIcon(b.id), `<b>${b.name} · ${count}${b.unit ?? '회분'}</b>`, esc(b.desc)));
    }
    const chumCount = p.genericBaitCount('chum');
    if (chumCount > 0 || !g.chumProductId) opts.push(choice(!g.chumProductId, 'rig', 'chum', 'chum', chumCount > 0, itemIcon('chum'), `<b>기본 집어 떡밥 · ${chumCount}회분</b>`, '4 / G로 뿌리기'));
    for (const b of BAIT_PRODUCTS) {
      const on = (b.baseBait === 'chum' ? g.chumProductId : g.baitProductId) === b.id, n = d.baitProducts[b.id] ?? 0;
      if (n > 0 || on) opts.push(choice(on, 'rig', 'baitProduct', b.id, n > 0, itemIcon(b.baseBait), `<b>${esc(b.name)} · ${n}회분</b>`,
        b.baseBait === 'chum' ? '집어용 · 4 / G' : '바늘에 부착'));
    }
  }
  const names: Record<RigStep, string> = { rod: '낚싯대', line: '원줄', float: '찌', depth: '', hook: '바늘', bait: '미끼' };
  const options = opts.length ? `<div class="choices">${opts.join('')}</div>` : `<p class="empty">보유한 ${names[ui.rigStep]}가 없어요</p>`;
  const depth = `<div class="depth-box"><p class="depth-note">찌에서 바늘까지 · 원줄 ${g.rod.line}m${g.measuredDepth !== null ? ` · 최근 측정 수심 <b>${g.measuredDepth.toFixed(1)}m</b>` : ''}</p>
    <div class="field"><input aria-label="찌에서 바늘까지 수심" type="range" min="0.3" max="${g.rod.line}" step="0.1" value="${g.depthSet}" data-act="depth" ${lockAttr}><output>${g.depthSet.toFixed(1)}m</output></div></div>`;
  const maxLoad = Math.min(g.line.strength, g.rod.power * 1.6);
  const held = c.rodSlots.find(r => r.slotId === c.rigTarget)?.active;
  return `<div class="panel wide">
  <p class="kicker">보유 장비만 표시 · 성능은 게임 수치</p><h2>채비</h2>
  <div class="rig-targets">${targets.join('')}</div>
  ${g.canRig ? '' : `<p class="warn">${held ? '채비를 걷은 뒤(R) 바꿀 수 있어요' : '이 대는 찌가 물에 있어요 · 대를 들고(E) 채비를 걷은 뒤(R) 바꿀 수 있어요'}</p>`}
  <div class="rig-layout">
    <ol class="rig-chain">${steps.map(([id, label, icon, value]) => `<li><button class="rig-step ${ui.rigStep === id ? 'on' : ''}" data-act="rig-step" data-id="${id}"><span class="slot-art">${icon}</span><span><small>${label}</small><b>${esc(value)}</b></span></button></li>`).join('')}</ol>
    <div class="rig-options">${ui.rigStep === 'depth' ? depth : options}<p class="depth-note rig-more">더 많은 장비는 관리동 낚시점에서 살 수 있어요</p></div>
  </div>
  <div class="rig-stats">
    <span>줄 굵기 <b>${lineDiameter(g.line).toFixed(3)}mm</b></span>
    <span>채비 예민함 <b>${g.rigSensitivity.toFixed(2)}</b></span>
    <span>최대 하중 <b>${maxLoad.toFixed(1)}kg</b></span>
    <span>원줄 ${wearBar(p.wearOf(`line:${g.line.id}`))}</span>
    <span>낚싯대 ${wearBar(p.wearOf(`rod:${g.rodId}`))}</span>
    <span>뜰채 한계 <b>${p.netSpec.maxKg}kg</b></span>
  </div>
  ${close('C')}
</div>`;
}

// ── 살림망 ──

export function keepnetPanel(c: PanelCtx) {
  const p = c.player;
  const cap = p.keepnetSpec.capacity, total = p.keepnetKg;
  const value = (id: string | undefined) => p.data.catches.find(r => r.id === id)?.value ?? 0;
  const rows = p.keepnet.map(f => `<li><span class="net-icon">${fishIcon(f.species.look)}</span><b>${f.species.name} ${sizeRankBadge(f.species.id, f.cm)}</b><span>${f.cm.toFixed(1)}cm</span><span>${kgText(f.kg)}</span><span>${won(value(f.id))}</span>
    <button class="btn small" data-act="release" data-id="${f.id}">${SPECIES_RULES[f.species.id].bounty ? '수매' : '방생'}</button></li>`).join('');
  return `<div class="panel">
  <p class="kicker">${esc(p.keepnetSpec.name)}</p><h2>살림망 <small>${p.keepnet.length} / ${cap}마리 · ${kgText(total)}</small></h2>
  ${bar(p.keepnet.length / cap, p.keepnet.length / cap > 0.85 ? 'bad' : 'good')}
  ${rows ? `<ul class="net">${rows}</ul>` : '<p class="empty">아직 잡은 고기가 없어요</p>'}
  <p class="depth-note">잡은 고기는 관리동 어시장에서 팔 수 있어요 (M 지도 → 관리동)</p>
  ${close('Tab')}
</div>`;
}

// ── 어시장 (관리동): 살림망의 고기를 오늘 시세로 판다 ──

export function marketPanel(c: PanelCtx) {
  const p = c.player;
  const value = (id: string | undefined) => p.data.catches.find(r => r.id === id)?.value ?? 0;
  const rows = p.keepnet.map(f => `<li><span class="net-icon">${fishIcon(f.species.look)}</span><b>${f.species.name}</b><span>${f.cm.toFixed(1)}cm</span><span>${kgText(f.kg)}</span><span>${won(value(f.id))}</span>
    <button class="btn small" data-act="sell-one" data-id="${f.id}">판매</button></li>`).join('');
  const market = SPECIES_LIST.map(sp => {
    const m = marketMul(sp.id);
    return `<li><b>${sp.name}</b><span>${won(SPECIES_RULES[sp.id].perKg * m)}/kg</span><em class="${m >= 1 ? 'up' : 'down'}">${m >= 1 ? '▲' : '▼'} ${Math.round((m - 1) * 100)}%</em></li>`;
  }).join('');
  const sum = p.data.catches.filter(r => r.kept && !r.sold).reduce((n, r) => n + r.value, 0);
  return `<div class="panel">
  <p class="kicker">관리동 · ${won(p.data.coins)} 보유</p><h2>어시장 <small>살림망 ${p.keepnet.length}마리</small></h2>
  ${rows ? `<ul class="net">${rows}</ul>` : '<p class="empty">팔 고기가 없어요. 살림망에 고기를 담아 오세요</p>'}
  <button class="btn primary" data-act="sell" ${p.keepnet.length ? '' : 'disabled'}>모두 판매 · ${won(sum)}</button>
  <h3>오늘의 시세 <small>매일 바뀝니다. 높은 크기 등급일수록 더 비싸게 팔려요</small></h3>
  <ul class="market">${market}</ul>
  ${close('N')}
</div>`;
}

// ── 가방 (마인크래프트 인벤토리) ──

interface InvItem { key: string; name: string; rarity?: Rarity; icon: string; count: string | number; desc: string; lines: string[]; actions: string[] }

function inventoryItems(c: PanelCtx): InvItem[] {
  const p = c.player, d = p.data;
  const items: InvItem[] = [];
  for (const r of RODS) if (d.rods[r.id]) {
    const wear = p.wearOf(`rod:${r.id}`);
    const deployed = c.rodSlots.filter(s => s.rodId === r.id);
    items.push({ key: `rod:${r.id}`, name: r.name, rarity: r.rarity, icon: itemIcon('rod', r.id), count: d.rods[r.id], desc: r.desc,
      lines: [`길이 ${r.length}m · 원줄 ${r.line}m · 힘 ${r.power}kg`, `보유 ${d.rods[r.id]}대 · 가방에 ${d.rods[r.id] - deployed.length}대 · 펼침 ${deployed.length}대`, wearBar(wear)],
      actions: [
        d.rods[r.id] > deployed.length ? `<button class="btn small primary" data-act="deploy" data-id="${r.id}">꺼내기</button>` : '',
        // 펼쳐 둔 대마다 회수 버튼: 채비를 걷고 가방에 넣는다
        ...deployed.map(s => `<button class="btn small" data-act="recall" data-id="${s.slotId}" ${s.state === '물고기 걸림' ? 'disabled' : ''}>회수 · ${s.platform}번 좌대 ${s.number}번</button>`),
        wear > 0.01 ? `<button class="btn small" data-act="repair" data-id="rod:${r.id}">수리 · ${won(p.repairCost(`rod:${r.id}`))}</button>` : ''] });
  }
  for (const l of LINES) if (d.lines.includes(l.id)) {
    const wear = p.wearOf(`line:${l.id}`);
    items.push({ key: `line:${l.id}`, name: l.name, rarity: l.rarity, icon: itemIcon('line'), count: '', desc: l.desc,
      lines: [lineSpecText(l), wearBar(wear)], actions: [wear > 0.01 ? `<button class="btn small" data-act="repair" data-id="line:${l.id}">새 줄 감기 · ${won(p.repairCost(`line:${l.id}`))}</button>` : ''] });
  }
  for (const f of FLOATS) if (d.floats.includes(f.id)) items.push({ key: `float:${f.id}`, name: f.name, rarity: f.rarity, icon: itemIcon('float', f.id), count: '', desc: f.desc, lines: [floatTraits(f)], actions: [] });
  for (const h of HOOKS) if (d.hooks.includes(h.id)) items.push({ key: `hook:${h.id}`, name: h.name, rarity: h.rarity, icon: itemIcon('hook'), count: '', desc: h.desc, lines: [hookSpecText(h)], actions: [] });
  for (const n of NETS) if (d.nets.includes(n.id)) items.push({ key: `net:${n.id}`, name: n.name, rarity: n.rarity, icon: itemIcon('net'), count: d.net === n.id ? 'E' : '', desc: n.desc,
    lines: [`${n.maxKg}kg까지 안전하게 떠냄`], actions: [d.net === n.id ? '<span class="tag">장착 중</span>' : `<button class="btn small" data-act="equip" data-kind="net" data-id="${n.id}">장착</button>`] });
  for (const k of KEEPNETS) if (d.keepnets.includes(k.id)) items.push({ key: `keepnet:${k.id}`, name: k.name, rarity: k.rarity, icon: itemIcon('keepnet'), count: d.keepnetId === k.id ? 'E' : '', desc: k.desc,
    lines: [`${k.capacity}마리까지 보관`], actions: [d.keepnetId === k.id ? '<span class="tag">장착 중</span>' : `<button class="btn small" data-act="equip" data-kind="keepnet" data-id="${k.id}">장착</button>`] });
  for (const b of Object.values(BAITS)) if (p.genericBaitCount(b.id)) items.push({ key: `bait:${b.id}`, name: b.name, icon: itemIcon(b.id), count: p.genericBaitCount(b.id), desc: b.desc, lines: [], actions: [] });
  if (p.genericBaitCount('chum')) items.push({ key: 'bait:chum', name: '집어 떡밥', icon: itemIcon('chum'), count: p.genericBaitCount('chum'), desc: '찌 주변에 뿌려 물고기를 모읍니다 (G / 4)', lines: [], actions: [] });
  for (const b of BAIT_PRODUCTS) if (d.baitProducts[b.id]) {
    const selected = (b.baseBait === 'chum' ? c.game.chumProductId : c.game.baitProductId) === b.id;
    items.push({ key: `bait:${b.id}`, name: b.name, icon: itemIcon(b.baseBait), count: d.baitProducts[b.id], desc: b.desc,
      lines: [`재고 ${d.baitProducts[b.id]}회분`],
      actions: [selected ? '<span class="tag">선택 중</span>' : `<button class="btn small primary" data-act="rig" data-kind="baitProduct" data-id="${b.id}" ${c.game.canRig ? '' : 'disabled'}>${b.baseBait === 'chum' ? '집어제로 선택' : '미끼로 선택'}</button>`] });
  }
  for (const i of INGREDIENTS) if (d.ingredients[i.id]) items.push({ key: `ing:${i.id}`, name: i.name, icon: itemIcon(i.id), count: d.ingredients[i.id], desc: i.desc, lines: ['배합대에서 떡밥 재료로 사용'], actions: [] });
  for (const item of items) {
    const [kind, id] = item.key.split(':');
    const q = itemQuality(kind === 'ing' ? 'ingredient' : kind, id);
    item.lines.unshift(`<span class="quality-purpose">${esc(q.purpose)}</span>`);
    const note = productNote(kind === 'ing' ? 'ingredient' : kind, id);
    if (note) item.lines.push(note);
  }
  return items;
}

/** 아이템 키 → 가방 분류 */
const invTabOf = (key: string): InvTab => {
  const kind = key.split(':')[0];
  return kind === 'rod' ? 'rod' : kind === 'line' || kind === 'float' || kind === 'hook' ? 'tackle' : kind === 'net' || kind === 'keepnet' ? 'gear' : 'bait';
};

export function inventoryPanel(c: PanelCtx) {
  const p = c.player, d = p.data, tab = c.ui.inventoryTab;
  let content: string;
  if (tab !== 'craft') {
    const items = inventoryItems(c).filter(i => tab === 'all' || invTabOf(i.key) === tab);
    const selectedKey = selected?.key.split(':');
    const selected = items.find(i => i.key === c.ui.invSelected) ?? items[0];
    const grid = items.map(i => slot(i.icon, i.count, `data-act="inv-select" data-id="${i.key}" title="${esc(i.name)}"`, `${selected?.key === i.key ? 'on' : ''} r-${i.rarity ?? 'common'}`)).join('');
    const detail = selected ? `<aside class="item-detail"><div class="slot-art big">${selected.icon}</div>
      <div class="item-name">${rarityName(selected.rarity, selected.name)} ${qualityBadge(selectedKey![0], selectedKey![1])}</div><p>${esc(selected.desc)}</p>
      ${selected.lines.filter(Boolean).map(l => `<p class="stat">${l}</p>`).join('')}
      ${selected.actions.some(Boolean) ? `<div class="row">${selected.actions.join('')}</div>` : ''}</aside>` : '';
    content = items.length ? `<div class="inv-layout"><div class="slot-grid">${grid}</div>${detail}</div>` : '<p class="empty">이 분류에 가진 아이템이 없어요</p>';
  } else {
    content = `<h3>떡밥 재료</h3><div class="slot-row">${INGREDIENTS.map(i => `<div class="equip-slot">${slot(itemIcon(i.id), d.ingredients[i.id], `title="${i.name}"`)}<small>${i.name}</small></div>`).join('')}</div>
      <h3>배합대 <small>재료를 섞어 바늘 떡밥과 집어 떡밥을 만듭니다</small></h3>
      <div class="recipes">${FEED_RECIPES.map(r => {
        const materials = Object.entries(r.materials) as [IngredientId, number][];
        const available = materials.every(([id, n]) => d.ingredients[id] >= n);
        return `<div class="recipe ${available ? '' : 'off'}"><div class="recipe-in">${materials.map(([id, n]) => slot(itemIcon(id), n, `title="${INGREDIENTS.find(i => i.id === id)!.name}"`)).join('<i>+</i>')}</div><i class="arrow">→</i>${slot(itemIcon(r.bait), r.yield, `title="${r.name}"`)}
          <button class="btn small ${available ? 'primary' : ''}" data-act="craft" data-id="${r.id}" ${available ? '' : 'disabled'}>${r.name}</button></div>`;
      }).join('')}</div>`;
  }
  return `<div class="panel wide inventory-panel"><p class="kicker">${won(d.coins)} · Lv.${p.level}</p><h2>가방</h2>
    ${tabs('inventory-tab', tab, [['all', '전체'], ['rod', '낚싯대'], ['tackle', '원줄·찌·바늘'], ['bait', '미끼·떡밥'], ['gear', '뜰채·살림망'], ['craft', '배합대']])}${content}${close('I')}</div>`;
}
/** 원줄 규격 한 줄 */
const lineSpecText = (l: (typeof LINES)[number]) => `${lineGo(l)}호 · 굵기 ${lineDiameter(l).toFixed(3)}mm · 강도 ${l.strength.toFixed(1)}kg`;
/** 바늘 규격 한 줄 */
const hookSpecText = (h: (typeof HOOKS)[number]) => `${hookSizeLabel(h)} · 하중 ${hookLoad(h).toFixed(1)}kg · 날카로움 ×${hookSharpness(h).toFixed(2)}`;


// ── 상점 ──

export function shopPanel(c: PanelCtx) {
  const p = c.player, d = p.data;
  type ShopItem = { id: string; name: string; price: number; level?: number; rarity?: Rarity; desc?: string };
  const goal = p.shopGoal;
  let visibleCount = 0;
  const matches = (kind: ShopKind, item: ShopItem) => (!c.ui.shopQuality || itemQuality(kind, item.id).tier === c.ui.shopQuality)
    && (!c.ui.shopAffordable || (!p.owns(kind, item.id) && (item.level ?? 1) <= p.level && item.price <= d.coins));
  const goalButton = (kind: ShopKind, item: ShopItem) => {
    if (p.owns(kind, item.id)) return '';
    const selected = goal?.kind === kind && goal.id === item.id;
    return `<button class="btn small shop-goal-button ${selected ? 'on' : ''}" data-act="${selected ? 'clear-shop-goal' : 'shop-goal'}" data-kind="${kind}" data-id="${item.id}">${selected ? '목표 해제' : '구매목표'}</button>`;
  };
  const unitPrice = (price: number, count: number) => `${(price / count).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}원`;
  const ordered = <T extends ShopItem>(kind: ShopKind, list: readonly T[]) => list.slice().sort((a, b) => itemQuality(kind, a.id).tier - itemQuality(kind, b.id).tier || a.price - b.price);
  const card = (kind: ShopKind, item: ShopItem, icon: string, info: string) => {
    if (!matches(kind, item)) return '';
    visibleCount++;
    const owned = p.owns(kind, item.id);
    const locked = (item.level ?? 1) > p.level;
    const q = itemQuality(kind, item.id);
    const label = owned ? '보유 중' : locked ? `Lv.${item.level} 필요` : d.coins < item.price ? '금액 부족' : '구매';
    return `<div class="shop-card ${locked ? 'locked' : ''}"><span class="shop-art">${slot(icon, '', '', `r-${item.rarity ?? 'common'}`)}${locked ? `<i class="lock">${itemIcon('lock')}</i>` : ''}</span><div>${rarityName(item.rarity, item.name)} ${qualityBadge(kind, item.id)}<small class="quality-purpose">${esc(q.purpose)}</small><small>${esc(item.desc ?? '')}${info ? `<br><span class="shop-spec">${info}</span>` : ''}${productNote(kind, item.id)}</small><span class="shop-price">${won(item.price)}</span></div>
      <div class="shop-actions">${goalButton(kind, item)}<button class="btn small ${owned || locked ? '' : 'primary'}" data-act="buy" data-kind="${kind}" data-id="${item.id}" ${owned || locked || d.coins < item.price ? 'disabled' : ''}>${label}</button></div></div>`;
  // 같은 제품(브랜드·모델)의 호수별 규격표: 이름에서 호수를 떼어 묶는다
  const specGroups = <T extends { id: string; name: string; price: number; level?: number; rarity?: Rarity; desc?: string }>(kind: ShopKind, list: T[], size: (t: T) => number, cols: (t: T) => string[], head: string[]) => {
    const groups = new Map<string, T[]>();
    for (const t of list) {
      if (!matches(kind, t)) continue;
      visibleCount++;
      const model = t.name.replace(/\s*[\d.]+호/, '').trim();
      groups.set(model, [...(groups.get(model) ?? []), t]);
    }
    return [...groups].sort(([, a], [, b]) => Math.min(...a.map(t => itemQuality(kind, t.id).tier)) - Math.min(...b.map(t => itemQuality(kind, t.id).tier)) || Math.min(...a.map(t => t.price)) - Math.min(...b.map(t => t.price))).map(([model, items]) => `<section class="spec-group"><h3>${esc(model)}</h3><p class="spec-purpose">${esc(itemQuality(kind, items[0].id).purpose)}</p>
      <div class="spec-table"><div class="spec-row head">${head.map(h => `<span>${h}</span>`).join('')}<span>품질 · 가격</span><span></span></div>
      ${items.sort((x, y) => size(x) - size(y)).map(t => {
        const owned = p.owns(kind, t.id), locked = (t.level ?? 1) > p.level;
        return `<div class="spec-row ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">${cols(t).map(v => `<span>${v}</span>`).join('')}<span class="spec-quality-price" title="${esc(itemQuality(kind, t.id).purpose)}">${qualityBadge(kind, t.id)}<strong>${won(t.price)}</strong></span>
          <div class="shop-actions">${goalButton(kind, t)}<button class="btn small ${owned || locked ? '' : 'primary'}" data-act="buy" data-kind="${kind}" data-id="${t.id}" ${owned || locked || d.coins < t.price ? 'disabled' : ''}>${owned ? '보유 중' : locked ? `Lv.${t.level} 필요` : d.coins < t.price ? '금액 부족' : '구매'}</button></div></div>`;
      }).join('')}</div></section>`).join('');
  };
  };
  let body = '';
  switch (c.ui.shopTab) {
    case 'bait':
      body = '<h3 class="shop-section">미끼·집어제</h3>' + [
        ...BAIT_PRODUCTS.map(b => ({ item: b, icon: itemIcon(b.baseBait), info: `${b.count}회분 · 회당 ${unitPrice(b.price, b.count)} · 재고 ${d.baitProducts[b.id] ?? 0}` })),
        ...BAIT_PACKS.map(b => ({ item: { ...b, desc: b.id === 'chum' ? '찌 주변에 뿌리는 기본 집어제' : BAITS[b.id as BaitId].desc }, icon: itemIcon(b.id), info: `${b.count}회분 · 회당 ${unitPrice(b.price, b.count)} · 일반 재고 ${p.genericBaitCount(b.id as BaitId | 'chum')}` }))
      ].sort((a, b) => itemQuality('bait', a.item.id).tier - itemQuality('bait', b.item.id).tier || a.item.price - b.item.price).map(b => card('bait', b.item, b.icon, b.info)).join('')
        + '<h3 class="shop-section">떡밥 재료</h3>' + ordered('ingredient', INGREDIENTS).map(i => card('ingredient', { ...i, name: `${i.name} ${i.count}개` }, itemIcon(i.id), `개당 ${unitPrice(i.price, i.count)} · 재고 ${d.ingredients[i.id]}`)).join('');
      break;
    case 'rod': body = ordered('rod', RODS).map(r => card('rod', r, itemIcon('rod', r.id), `길이 ${r.length}m · 힘 ${r.power}kg · 보유 ${d.rods[r.id] ?? 0}대`)).join(''); break;
    // 원줄·바늘은 브랜드 제품별로 묶고, 호수마다 규격을 한 줄씩
    case 'line': body = specGroups('line', LINES, l => +lineGo(l), l => [`<b>${lineGo(l)}호</b>`, `굵기 ${lineDiameter(l).toFixed(3)}mm`, `강도 ${l.strength.toFixed(1)}kg`, `눈에 띔 ${Math.round(l.visibility * 100)}%`], ['호수', '굵기', '강도', '눈에 띔']); break;
    case 'float': body = ordered('float', FLOATS).map(f => card('float', f, itemIcon('float', f.id), floatTraits(f))).join(''); break;
    case 'hook': body = specGroups('hook', HOOKS, h => +(h.name.match(/(\d+)호/)?.[1] ?? 0), h => [`<b>${h.name.match(/(\d+)호/)?.[1] ?? '?'}호</b>`, `폭 ${hookGap(h).toFixed(1)}mm`, `하중 ${hookLoad(h).toFixed(1)}kg`, `날카로움 ×${hookSharpness(h).toFixed(2)}`], ['호수', '바늘 폭', '하중', '날카로움']); break;
    case 'net': body = '<h3 class="shop-section">뜰채</h3>' + ordered('net', NETS).map(n => card('net', n, itemIcon('net'), `${n.maxKg}kg까지`)).join('') + '<h3 class="shop-section">살림망</h3>' + ordered('keepnet', KEEPNETS).map(k => card('keepnet', k, itemIcon('keepnet'), `${k.capacity}마리 보관`)).join(''); break;
    case 'repair': {
      const worn = [...RODS.filter(r => d.rods[r.id]).map(r => [`rod:${r.id}`, r.name, itemIcon('rod', r.id)]), ...LINES.filter(l => d.lines.includes(l.id)).map(l => [`line:${l.id}`, l.name, itemIcon('line')])]
        .filter(([key]) => p.wearOf(key) > 0.01);
      body = worn.length ? worn.map(([key, name, icon]) => `<div class="shop-card"><span class="shop-art">${slot(icon)}</span><div><b>${esc(name)}</b><small>${wearBar(p.wearOf(key))}</small></div>
        <button class="btn small primary" data-act="repair" data-id="${key}" ${d.coins < p.repairCost(key) ? 'disabled' : ''}>${key.startsWith('line') ? '새 줄' : '수리'} · ${won(p.repairCost(key))}</button></div>`).join('')
        : '<p class="empty">손볼 장비가 없어요. 파이팅할수록 원줄과 낚싯대가 닳습니다.</p>';
    }
  }
  if (c.ui.shopTab !== 'repair' && !visibleCount) body = '<p class="empty">이 조건에 맞는 상품이 없어요. 품질이나 구매 가능 조건을 바꿔 보세요.</p>';
  const saving = goal ? `<section class="shop-saving"><div class="shop-saving-heading"><span>구매목표</span>${qualityBadge(goal.kind, goal.id)}<b>${esc(goal.name)}</b></div>
    ${bar(goal.price > 0 ? d.coins / goal.price : 1, d.coins >= goal.price ? 'good' : '')}
    <div class="shop-saving-numbers"><strong>${won(d.coins)} / ${won(goal.price)}</strong><span>${d.coins >= goal.price ? '구매 금액 달성' : `${won(goal.price - d.coins)} 더 모으기`} · Lv.${goal.level ?? 1}${(goal.level ?? 1) > p.level ? ' 필요' : ' 충족'}</span></div>
    <div class="shop-actions"><button class="btn small" data-act="clear-shop-goal">목표 해제</button><button class="btn small primary" data-act="buy" data-kind="${goal.kind}" data-id="${goal.id}" ${d.coins < goal.price || (goal.level ?? 1) > p.level || p.owns(goal.kind, goal.id) ? 'disabled' : ''}>바로 구매</button></div></section>` : '';
  return `<div class="panel wide quality-shop"><p class="kicker">${ACTIVE_FISHERY.name} 상점 · ${won(d.coins)} · Lv.${p.level}</p><h2>상점</h2><p class="quality-guide">기본 → 실용 → 고급 → 전문 → 명품 · 품질·가격·성능은 게임 기준</p>
    ${saving}
    ${tabs('shop-tab', c.ui.shopTab, [['bait', '미끼·재료'], ['rod', '낚싯대'], ['line', '원줄'], ['float', '찌'], ['hook', '바늘'], ['net', '뜰채·살림망'], ['repair', '수리']])}
    ${c.ui.shopTab !== 'repair' ? `<div class="shop-filters">${tabs('shop-quality', String(c.ui.shopQuality), [['0', '전체 품질'], ...QUALITY_LABELS.map((label, i): [string, string] => [String(i + 1), label])])}<button class="btn small ${c.ui.shopAffordable ? 'on' : ''}" data-act="shop-affordable" aria-pressed="${c.ui.shopAffordable}">구매 가능한 상품만</button><small>${visibleCount}개 상품</small></div>` : ''}
    <div class="shop-list">${body}</div>
    ${p.canGatherWorms ? '<button class="btn" data-act="gather">지렁이 채집 +5개</button>' : ''}
    </div>`;
}

// ── 도감 ──

export function collectionPanel(c: PanelCtx) {
  const p = c.player;
  const found = SPECIES_LIST.filter(sp => p.data.catches.some(r => r.species === sp.id)).length;
  return `<div class="panel wide"><p class="kicker">물고기 도감</p><h2>${found} / ${SPECIES_LIST.length}종 발견</h2><div class="fish-collection">${SPECIES_LIST.map(sp => {
    const catches = p.data.catches.filter(r => r.species === sp.id);
    const rule = SPECIES_RULES[sp.id];
    if (!catches.length) return `<article class="species-card"><span class="species-status">미발견</span><div class="fish-icon">${fishIcon(sp.look)}</div><h3>???</h3><p>아직 낚아 본 적 없는 고기</p></article>`;
    const tags = [rule.bounty ? '<span class="tag bad">생태계교란종 · 방생 금지</span>' : '', rule.minKeepCm ? `<span class="tag">금지 체장 ${rule.minKeepCm}cm</span>` : ''].join('');
    const night = catches.filter(r => { const h = new Date(r.at).getHours(); return h < 6 || h >= 19; }).length;
    return `<article class="species-card discovered"><span class="species-status">${catches.length}마리 기록</span><div class="fish-icon">${fishIcon(sp.look)}</div><h3>${sp.name}</h3>${tags}
      <p>최대어 ${p.best[sp.id] ? `${p.best[sp.id].toFixed(1)}cm` : '—'} · 평균 ${(catches.reduce((n, r) => n + r.cm, 0) / catches.length).toFixed(1)}cm<br>등급 ${sp.ranks.slice().reverse().map(([n, cm]) => `${n} ${cm}cm↑`).join(' → ')}<br>시세 ${won(rule.perKg * marketMul(sp.id))}/kg${night ? ` · 밤에 ${night}마리` : ''}</p></article>`;
  }).join('')}</div>${close('V')}</div>`;
}

// ── 개인 기록 ──

export function recordsPanel(c: PanelCtx) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const records = c.player.data.catches.filter(r => r.species === c.ui.recordSpecies && (!c.ui.weekly || r.at >= monday.getTime())).sort((a, b) => b.cm - a.cm || a.at - b.at).slice(0, 10);
  return `<div class="panel"><p class="kicker">싱글 플레이 · 개인 기록</p><h2>나의 최대어 순위</h2>
    ${tabs('record-species', c.ui.recordSpecies, SPECIES_LIST.map(sp => [sp.id, sp.name]))}
    ${tabs('record-period', c.ui.weekly ? 'week' : 'all', [['all', '전체 기록'], ['week', '이번 주']])}
    ${records.length ? `<ol class="record-list">${records.map((r, i) => `<li><span>${i + 1}</span><b>${r.cm.toFixed(1)}cm</b><small>${sizeRankBadge(r.species, r.cm)} ${kgText(r.kg)} · ${(findFishery(r.fisheryId) ?? FISHERIES[0]).name} ${r.platform}번 좌대</small><small>${new Date(r.at).toLocaleDateString('ko-KR')} · ${r.kept ? '보관' : r.released ? '방생' : '수매'}</small></li>`).join('')}</ol>` : '<p class="empty">이 어종을 잡으면 기록이 남아요.</p>'}
    ${close('J')}</div>`;
}

// ── 좌대 이동 ──

export function platformsPanel(c: PanelCtx) {
  return `<div class="panel wide platform-panel"><p class="kicker">${ACTIVE_FISHERY.name}</p><h2>낚시터 선택</h2>${fisheryCards(c.online)}<h3>현재 낚시터의 좌대</h3>
    <div class="platform-list"><button class="platform-choice ${c.currentPlatform === null ? 'current' : ''}" data-act="travel" data-id="0">
      <span class="platform-number">관</span><b>관리동</b><small>낚시점 · 어시장</small><span class="platform-arrow">이동 →</span></button>${c.platforms.map(pl => `<button class="platform-choice ${c.currentPlatform === pl.id ? 'current' : ''}" data-act="travel" data-id="${pl.id}">
      <span class="platform-number">${String(pl.id).padStart(2, '0')}</span><b>${esc(pl.name)}</b><small>${['얕은 턱', '중간 수심', '깊은 턱', '깊은 수심'][Math.floor((pl.id - 1) / 2)]}<br>낚싯대 ${pl.rods} / ${MAX_DEPLOYED_RODS}${pl.bites ? ` · 걸림 ${pl.bites}` : ''}</small><span class="platform-arrow">${c.currentPlatform === pl.id ? '현재 위치' : '이동 →'}</span>
    </button>`).join('')}</div><button class="btn" data-act="resume">돌아가기 <kbd>M</kbd></button></div>`;
}

// ── 의뢰·업적 ──

export function questsPanel(c: PanelCtx) {
  const p = c.player;
  let body: string;
  if (c.ui.questTab === 'personal') {
    const goals = p.personalGoals;
    const selected = goals.filter(g => g.group === c.ui.goalGroup && (g.group !== 'species' || g.speciesId === c.ui.recordSpecies));
    const completed = selected.filter(g => g.claimed).length;
    body = `${tabs('goal-group', c.ui.goalGroup, [['start', '첫걸음'], ['species', '어종별 성장'], ['fishery', '낚시터 도감'], ['record', '내 기록'], ['challenge', '채비 도전']])}
      ${c.ui.goalGroup === 'species' ? tabs('record-species', c.ui.recordSpecies, SPECIES_LIST.map(sp => [sp.id, sp.name])) : ''}
      <p class="depth-note">달성 ${completed} / ${selected.length} · 목표 보상은 한 번만 받을 수 있어요</p>
      <div class="quest-list">${selected.map(goal => {
        const done = goal.have >= goal.need && !goal.locked;
        return `<div class="quest ${goal.claimed ? 'claimed' : done ? 'done' : ''}">${slot(itemIcon(goal.group === 'start' ? 'scroll' : 'trophy'))}<div><b>${esc(goal.name)}</b><small>${esc(goal.desc)}</small>${bar(goal.have / goal.need, done ? 'good' : '')}<small>${Math.min(goal.have, goal.need)} / ${goal.need} · ${won(goal.coins)} · ${goal.xp} 경험치</small></div>
          <button class="btn small ${done && !goal.claimed ? 'primary' : ''}" data-act="claim" data-kind="goal" data-id="${esc(goal.id)}" ${done && !goal.claimed ? '' : 'disabled'}>${goal.claimed ? '획득' : goal.locked ? '잠김' : done ? '보상' : '진행 중'}</button></div>`;
      }).join('')}</div>`;
  } else if (c.ui.questTab === 'daily') {
    p.ensureQuests();
    const defs = dailyQuests(p.data.quests.day);
    body = `<p class="depth-note">매일 자정에 새 의뢰 3개가 올라옵니다. 오늘 ${p.data.quests.day}</p><div class="quest-list">${defs.map(def => {
      const st = p.data.quests.list.find(q => q.id === def.id) ?? { progress: 0, claimed: false };
      const done = st.progress >= def.target;
      return `<div class="quest ${st.claimed ? 'claimed' : done ? 'done' : ''}">${slot(itemIcon('scroll'))}<div><b>${esc(def.text)}</b>${bar(st.progress / def.target, done ? 'good' : '')}<small>${def.kind === 'sell' ? won(st.progress) : st.progress} / ${def.kind === 'sell' ? won(def.target) : def.target} · 보상 ${won(def.coins)} · ${def.xp} 경험치</small></div>
        <button class="btn small ${done && !st.claimed ? 'primary' : ''}" data-act="claim" data-kind="quest" data-id="${def.id}" ${done && !st.claimed ? '' : 'disabled'}>${st.claimed ? '완료' : '보상'}</button></div>`;
    }).join('')}</div>`;
  } else {
    const stats = p.achievementStats;
    body = `<div class="quest-list">${ACHIEVEMENTS.map(a => {
      const [have, need] = a.check(stats);
      const claimed = p.data.achievements.includes(a.id), done = have >= need;
      return `<div class="quest ${claimed ? 'claimed' : done ? 'done' : ''}">${slot(itemIcon('trophy'))}<div><b>${a.name}</b><small>${a.desc}</small>${bar(have / need, done ? 'good' : '')}<small>${Math.min(have, need).toLocaleString()} / ${need.toLocaleString()} · 보상 ${won(a.coins)}</small></div>
        <button class="btn small ${done && !claimed ? 'primary' : ''}" data-act="claim" data-kind="achievement" data-id="${a.id}" ${done && !claimed ? '' : 'disabled'}>${claimed ? '획득' : '보상'}</button></div>`;
    }).join('')}</div>`;
  }
  return `<div class="panel"><p class="kicker">${ACTIVE_FISHERY.name} 관리소</p><h2>목표와 의뢰</h2>${tabs('quest-tab', c.ui.questTab, [['personal', '개인 목표'], ['daily', '일일 의뢰'], ['achieve', '업적']])}${body}</div>`;
}

// ── 기술 ──

export function skillsPanel(c: PanelCtx) {
  const p = c.player;
  return `<div class="panel"><p class="kicker">Lv.${p.level} · 남은 기술 포인트 ${p.skillPoints}</p><h2>낚시 기술</h2>
    <p class="depth-note">레벨이 오를 때마다 기술 포인트 1개를 얻습니다.</p>
    <div class="quest-list">${SKILLS.map(s => {
      const lv = p.data.skills[s.id];
      return `<div class="quest">${slot(itemIcon('skill'), lv)}<div><b>${s.name}</b><span class="pips">${Array.from({ length: SKILL_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span><small>지금 ${lv ? s.desc(lv) : '효과 없음'}${lv < SKILL_MAX ? ` → 다음 ${s.desc(lv + 1)}` : ''}</small></div>
        <button class="btn small ${p.skillPoints > 0 && lv < SKILL_MAX ? 'primary' : ''}" data-act="learn" data-id="${s.id}" ${p.skillPoints > 0 && lv < SKILL_MAX ? '' : 'disabled'}>배우기</button></div>`;
    }).join('')}</div>${close('K')}</div>`;
}

// ── 대회 ──

export function tournamentPanel(c: PanelCtx) {
  const p = c.player, t = c.tournament;
  let body: string;
  if (t) {
    const m = Math.floor(t.remaining / 60), s = Math.floor(t.remaining % 60);
    body = `<div class="tour-live"><b>${t.def.name}</b><small>${t.def.desc} · 남은 시간 ${m}:${String(s).padStart(2, '0')}</small>
      <ol class="standings">${t.standings.map((e, i) => `<li class="${e.player ? 'me' : ''}"><span>${i + 1}</span><b>${esc(e.name)}</b><em>${t.scoreText(e.score)}</em>${i < t.def.prizes.length ? `<small>${won(t.def.prizes[i])}</small>` : '<small></small>'}</li>`).join('')}</ol>
      <button class="btn" data-act="quit">대회 포기</button></div>`;
  } else {
    body = `<div class="shop-list">${TOURNAMENTS.filter(tournamentAvailable).map(def => {
      const locked = def.level > p.level;
      const target = def.target === 'any' ? '모든 어종' : def.target.map(id => SPECIES[id].name).join('·');
      return `<div class="shop-card ${locked ? 'locked' : ''}">${slot(itemIcon(locked ? 'lock' : 'trophy'))}<div><b>${def.name}</b><small>${def.desc}<br>대상 ${target} · ${def.minutes}분 · 상금 ${def.prizes.map(won).join(' / ')}</small></div>
        <button class="btn small ${locked ? '' : 'primary'}" data-act="join" data-id="${def.id}" ${locked || p.data.coins < def.entry ? 'disabled' : ''}>${locked ? `Lv.${def.level} 필요` : def.entry ? `참가 · ${won(def.entry)}` : '무료 참가'}</button></div>`;
    }).join('')}</div>`;
  }
  const history = p.data.tournaments.slice().reverse().slice(0, 6);
  return `<div class="panel"><p class="kicker">${ACTIVE_FISHERY.name} 낚시 대회 · 우승 ${p.data.stats.wins}회</p><h2>대회</h2>
    ${body}
    ${history.length ? `<h3>지난 대회</h3><ul class="net">${history.map(h => `<li><b>${esc(h.name)}</b><span>${h.rank} / ${h.of}위</span><span>${esc(h.score)}</span><span>${h.prize ? won(h.prize) : '-'}</span></li>`).join('')}</ul>` : ''}
    ${close('T')}</div>`;
}

// ── 설정·일시정지 ──

export function settingsPanel(c: PanelCtx) {
  const s = c.settings;
  const opt = (key: string, value: string, label: string, on: boolean) => `<button class="btn small ${on ? 'on' : ''}" data-act="setting" data-kind="${key}" data-id="${value}">${label}</button>`;
  return `<div class="panel"><p class="kicker">설정</p><h2>환경 설정</h2>
    <h3>시점 감도</h3><div class="field"><input type="range" min="0.2" max="3" step="0.1" value="${s.sensitivity}" data-act="setting-range" data-kind="sensitivity" aria-label="시점 감도"><output>${s.sensitivity.toFixed(1)}</output></div>
    <h3>소리 크기</h3><div class="field"><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-act="setting-range" data-kind="volume" aria-label="소리 크기"><output>${Math.round(s.volume * 100)}</output></div>
    <h3>터치 조작 <small>휴대폰·태블릿용 가상 조이스틱과 버튼</small></h3>
    <div class="record-tabs">${opt('touch', 'auto', '자동', s.touch === 'auto')}${opt('touch', 'on', '켜기', s.touch === 'on')}${opt('touch', 'off', '끄기', s.touch === 'off')}</div>
    <h3>진동 <small>고기가 걸리고 바늘털이할 때 · 지원하는 기기에서만</small></h3>
    <div class="record-tabs">${opt('vibrate', '1', '켜기', s.vibrate)}${opt('vibrate', '0', '끄기', !s.vibrate)}</div>
    <h3>그래픽</h3>
    <div class="record-tabs">${[['voxel', '복셀 (기본)'], ['cozy', '3D 도트'], ['smooth', '사실적']].map(([id, name]) => `<button class="btn small" data-act="look" data-id="${id}">${name}</button>`).join('')}</div>
    <h3>저장 데이터</h3>
    <button class="btn small ${c.ui.resetArmed ? 'danger' : ''}" data-act="reset">${c.ui.resetArmed ? '한 번 더 누르면 모든 진행이 지워져요' : '진행 초기화'}</button>
    ${close('O')}</div>`;
}

// ── 메뉴 (Esc / 오른쪽 위 버튼): 화면에서 뺀 정보와 기능을 분류해 모은다 ──

export function pausePanel(c: PanelCtx) {
  const p = c.player, d = p.data, env = c.env, w = env.weather, trend = env.pressureTrend;
  const tile = (id: string, name: string, key: string, icon: string, sub = '', badge = 0) =>
    `<button class="hub-tile" data-act="menu" data-id="${id}"><span class="slot-art">${itemIcon(icon)}</span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}<kbd>${key}</kbd>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
  const t = c.tournament;
  return `<div class="panel hub">
  <header class="hub-head">
    <div class="hub-lv"><b>Lv ${p.level}</b>${bar(p.levelProgress, 'good')}</div>
    <span class="hub-coins">${itemIcon('coin')}${won(d.coins)}</span>
  </header>
  <p class="hub-env"><span class="env-icon">${itemIcon(env.night && w === 'clear' ? 'moon' : w)}</span>${env.day}일차 ${env.clock} · ${env.period} · ${WEATHER[w].name}
    · 기온 ${env.airTemp.toFixed(0)}° · 수온 ${env.waterTemp.toFixed(1)}° · ${env.pressure.toFixed(0)}hPa ${trend > 0.6 ? '↑' : trend < -0.6 ? '↓' : '→'}</p>
  <section><h3>장비</h3><div class="hub-grid">
    ${tile('inventory', '가방', 'I', 'bag')}${tile('setup', '채비', 'C', 'rig', esc(c.game.rod.name))}
    ${tile('keepnet', '살림망', 'Tab', 'keepnet', `${p.keepnet.length} / ${p.keepnetSpec.capacity}마리`)}
  </div></section>
  <section><h3>활동</h3><div class="hub-grid">
    ${tile('quests', '목표·의뢰', 'Q', 'scroll', '', p.claimable)}${TOURNAMENTS_OPEN ? tile('tournament', '대회', 'T', 'trophy', t ? `${t.rank}위 진행 중` : '') : ''}
    ${tile('skills', '기술', 'K', 'skill', '', p.skillPoints)}${tile('platforms', '낚시터 선택', 'M', 'map', `${ACTIVE_FISHERY.name}${c.currentPlatform ? ` · ${c.currentPlatform}번` : ''}`)}
  </div></section>
  <section><h3>기록</h3><div class="hub-grid">${tile('collection', '도감', 'V', 'book')}${tile('records', '개인 기록', 'J', 'ruler')}${tile('onlineRanking', '온라인 랭킹', 'L', 'trophy')}</div></section>
  <section><h3>커뮤니티</h3><div class="hub-grid">${tile('chat', '낚시터 채팅', 'Enter', 'scroll', fisheryOccupancy(c.online, ACTIVE_FISHERY.id))}${tile('account', '계정', '', 'book', c.online.nickname ? esc(c.online.nickname) : 'Google 로그인')}</div></section>
  <details class="hub-help"><summary>조작법</summary><ul class="help-touch">
    <li>왼쪽 아래 엄지로 걷기 · 오른쪽 화면을 끌어 둘러보기</li>
    <li>큰 버튼 <b>던지기</b>: 눌렀다 놓으면 앞치기 · 찌가 서면 <b>챔질</b>로 바뀌어요</li>
    <li>걸면 큰 버튼 <b>세우기</b>를 누른 채 버티고, 줄이 위험하면 <b>숙이기</b></li>
    <li>아래 칸: 낚싯대 1~3 바꾸기 · 4 집어 떡밥 · 왼쪽 위 고리: 살림망</li>
  </ul><ul class="help-desk">
    <li><kbd>WASD</kbd> 걷기 · <kbd>E</kbd> 대 들기 / 거치 · <kbd>1</kbd>~<kbd>3</kbd> 낚싯대 · <kbd>F</kbd> 회수</li>
    <li><kbd>M</kbd> 지도 · 관리동에서 <kbd>B</kbd> 낚시점 · <kbd>N</kbd> 어시장</li>
    <li><kbd>좌클릭 길게 → 놓기</kbd> 앞치기 · <kbd>좌·우클릭</kbd> 대 들기(챔질) · <kbd>R</kbd> 채비 걷기</li>
    <li>걸면 <kbd>좌클릭</kbd> 대 세우기 · <kbd>우클릭</kbd> 대 숙이기 · <kbd>G</kbd> 집어 · <kbd>Z</kbd> 망원</li>
  </ul></details>
  <div class="row"><button class="btn primary" data-act="resume">계속하기</button><button class="btn" data-act="menu" data-id="settings">설정 <kbd>O</kbd></button></div>
</div>`;
}

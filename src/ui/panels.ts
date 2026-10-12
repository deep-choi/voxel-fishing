import { BAITS, BAIT_PACKS, FEED_RECIPES, FLOATS, HOOKS, INGREDIENTS, LINES, MAX_DEPLOYED_RODS, RODS, SPECIES, SPECIES_LIST, type BaitId, type BiteStyle, type IngredientId, type Rarity, type SpeciesId } from '../game/data';
import { ACHIEVEMENTS, dailyQuests, marketMul } from '../game/economy';
import { WEATHER, type Environment } from '../game/environment';
import type { Fishing } from '../game/fishing';
import { ACTIVE_FISHERY, FISHERIES, FISHERY_CAPACITY, canEnterFishery, findFishery } from '../game/fisheries';
import { preferredBaits, affinityLabel } from '../game/ecology';
import { KEEPNETS, NETS, RARITY, SPECIES_RULES } from '../game/items';
import type { PlayerProgress, ShopKind } from '../game/profile';
import { BAIT_PRODUCTS, BRANDS, catalogInfo } from '../game/realCatalog';
import { SKILLS, SKILL_MAX } from '../game/skills';
import { TOURNAMENTS, tournamentAvailable, type Tournament } from '../game/tournament';
import { fishIcon, itemIcon } from './pixelIcons';
import type { Settings } from './settings';
import type { OnlineState, OnlineTab } from '../game/onlineState';
import type { FisheryId } from '../game/fisheries';

// 패널 화면들: 상태를 받아 HTML 문자열을 돌려준다. 클릭은 data-act로 hud.ts가 처리한다.

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const kgText = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)}g` : `${kg.toFixed(2)}kg`);
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const BITE_DESCRIPTIONS: Record<BiteStyle, string> = { rise: '찌를 천천히 올립니다', sink: '찌를 물속으로 끌고 갑니다',
  jitter: '찌를 짧고 빠르게 건드립니다', drag: '찌를 누른 뒤 옆으로 무겁게 끌고 갑니다', dart: '짧게 건드린 뒤 빠르게 가져갑니다' };
const ACTIVE_TEXT = { day: '낮', night: '밤', twilight: '새벽·해질녘', any: '하루 종일' };

export type ShopTab = 'bait' | 'rod' | 'line' | 'terminal' | 'net' | 'repair';
export type RigStep = 'rod' | 'line' | 'float' | 'depth' | 'hook' | 'bait';
export interface PlatformStatus { id: number; name: string; rods: number; bites: number }
export interface RodStatus { slotId: string; number: number; rodId: string; name: string; platform: number; state: string; active: boolean; biting: boolean }
export interface UiState {
  inventoryTab: 'bag' | 'craft'; invSelected: string | null;
  shopTab: ShopTab; rigStep: RigStep;
  recordSpecies: SpeciesId; weekly: boolean;
  questTab: 'daily' | 'achieve';
  resetArmed: boolean;
  onlineSpecies: SpeciesId; onlineScope: 'all' | FisheryId; nicknameDraft: string; chatDraft: string;
}
export interface PanelCtx {
  player: PlayerProgress; game: Fishing; env: Environment; tournament: Tournament | null;
  rodSlots: RodStatus[]; platforms: PlatformStatus[]; currentPlatform: number | null; activeRod: string | null;
  ui: UiState; settings: Settings;
  online: OnlineState;
}

const rarityName = (r: Rarity | undefined, name: string) => `<b class="r-${r ?? 'common'}">${esc(name)}</b>`;
const rarityTag = (r: Rarity | undefined) => r ? `<span class="rarity r-${r}">${RARITY[r].name}</span>` : '';
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
    <small>${f.theme}</small><span class="fishery-desc">${f.desc}</span><span class="fishery-targets">${f.targets.map(id => SPECIES[id].name).join(' · ')}</span>
    <small>미끼 ${f.recommendedBaits.map(id => BAITS[id].name).join(' · ')}<br>좌대 수심 ${f.platforms.depths[0]}~${f.platforms.depths[3]}m · 8좌대 · 좌대당 3대</small>
    <span class="fishery-occupancy" data-fishery-count="${f.id}">${fisheryOccupancy(online, f.id)}</span>
  </button>`).join('')}</div>`;
}
export function encounterForecast(g: Fishing) {
  const f = g.encounterForecast;
  const rows = f.rates.filter(r => r.share > 0);
  return `<div class="encounter-forecast"><h3>예상 입질 어종 <small>${f.actual ? '던진 찌 자리' : '정면 포인트 예상'} · 수심 ${f.depth.toFixed(1)}m</small></h3>
    <p class="forecast-note">${esc(g.baitName)} · ${g.fastTest ? '빠른 확인 모드: 어종 비율은 동일' : `대기 중 1분 내 입질 약 ${Math.round(f.chancePerMinute * 100)}%`}<br>입질이 왔을 때의 어종 비율이며, 포획 성공률은 아닙니다.</p>
    <div class="encounter-rows">${rows.length ? rows.map(r => `<div><b>${r.sp.name}</b>${bar(r.share)}<span>${(r.share * 100).toFixed(1)}%</span><small>${affinityLabel(r.factors.bait)}${r.factors.baitDepth < 0.6 ? ' · 미끼가 바닥에서 뜸' : ''}${r.factors.habitat < 0.1 ? ' · 서식 수심과 다름' : ''}</small></div>`).join('') : '<p class="empty">물속 포인트에 채비를 던져 주세요.</p>'}</div>
  </div>`;
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
      ${s.loadingRanking ? '<p class="empty">랭킹을 불러오는 중…</p>' : s.rankings.length ? `<ol class="online-ranking">${s.rankings.map((r, i) => `<li class="${r.uid === s.uid ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.nickname)}</b><strong>${r.cm.toFixed(1)}cm</strong><small>${kgText(r.kg)} · ${(findFishery(r.fisheryId) ?? FISHERIES[0]).name}</small></li>`).join('')}</ol>` : '<p class="empty">아직 등록된 기록이 없어요.</p>'}`;
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
  const { game: g, player: p, ui } = c;
  const d = p.data;
  const lockAttr = g.canRig ? '' : 'disabled';
  const steps: [RigStep, string, string, string][] = [
    ['rod', '낚싯대', itemIcon('rod', g.rodId), `${g.rod.name}`],
    ['line', '원줄', itemIcon('line'), g.line.name],
    ['float', '찌', itemIcon('float'), g.floatSpec.name],
    ['depth', '찌 수심', itemIcon('sinker'), `${g.depthSet.toFixed(1)}m`],
    ['hook', '바늘', itemIcon('hook'), g.hook.name],
    ['bait', '미끼', itemIcon(g.bait), `${g.baitName} · ${g.baitProduct ? d.baitProducts[g.baitProduct.id] ?? 0 : d.baits[g.bait]}${BAITS[g.bait].unit ?? '회분'}`],
  ];
  const choice = (on: boolean, act: string, kind: string, id: string, enabled: boolean, icon: string, title: string, body: string) =>
    `<button class="choice ${on ? 'on' : ''}" data-act="${act}" data-kind="${kind}" data-id="${id}" ${g.canRig && enabled ? '' : 'disabled'}><span class="item-icon">${icon}</span>${title}<small>${body}</small></button>`;
  let options = '';
  if (ui.rigStep === 'rod') options = RODS.map(r => choice(r.id === g.rodId, 'rig', 'rod', r.id, (d.rods[r.id] ?? 0) > 0, itemIcon('rod', r.id), rarityName(r.rarity, r.name),
    `${r.desc}<br>길이 ${r.length}m · 원줄 ${r.line}m · 힘 ${r.power}kg<br>보유 ${d.rods[r.id] ?? 0}대 ${wearBar(p.wearOf(`rod:${r.id}`))}`)).join('');
  if (ui.rigStep === 'line') options = LINES.map((l, i) => choice(i === g.lineIdx, 'line', 'line', String(i), d.lines.includes(l.id), itemIcon('line'), rarityName(l.rarity, l.name),
    `${l.desc}<br>${l.strength.toFixed(1)}kg에 끊어짐 · 눈에 띔 ${Math.round(l.visibility * 100)}%<br>${d.lines.includes(l.id) ? wearBar(p.wearOf(`line:${l.id}`)) : '미보유'}`)).join('');
  if (ui.rigStep === 'float') options = FLOATS.map(f => choice(f.id === g.floatId, 'rig', 'float', f.id, d.floats.includes(f.id), itemIcon('float'), rarityName(f.rarity, f.name),
    `${f.desc}<br>예민함 ${f.sensitivity} · ${f.glow ? '야간 발광' : '야간 안 보임'}${d.floats.includes(f.id) ? '' : '<br>미보유'}`)).join('');
  if (ui.rigStep === 'hook') options = HOOKS.map(h => choice(h.id === g.hookId, 'rig', 'hook', h.id, d.hooks.includes(h.id), itemIcon('hook'), rarityName(h.rarity, h.name),
    `${h.desc}<br>걸림 ${h.hold} · 유인 ${h.attraction}${d.hooks.includes(h.id) ? '' : '<br>미보유'}`)).join('');
  if (ui.rigStep === 'bait') {
    options = Object.values(BAITS).map(b => choice(g.bait === b.id && !g.baitProductId, 'bait', 'bait', b.id, d.baits[b.id] > 0, itemIcon(b.id), `<b>${b.name} 공용 · ${d.baits[b.id]}${b.unit ?? '회분'}</b>`, esc(b.desc))).join('')
      + choice(!g.chumProductId, 'rig', 'chum', 'chum', d.baits.chum > 0, itemIcon('chum'), '<b>공용 집어 떡밥</b>', '4 / G로 뿌리기')
      + BAIT_PRODUCTS.map(b => choice((b.baseBait === 'chum' ? g.chumProductId : g.baitProductId) === b.id, 'rig', 'baitProduct', b.id, (d.baitProducts[b.id] ?? 0) > 0, itemIcon(b.baseBait),
        `<b>${esc(b.name)} · ${d.baitProducts[b.id] ?? 0}회분</b>`, `${esc(b.desc)}<br>${b.baseBait === 'chum' ? '집어용 · 4 / G' : '바늘에 부착'} · 게임 입질 ×${b.biteScale} / 집어 ×${b.chumScale}`)).join('');
  }
  const depth = `<div class="depth-box"><p class="depth-note">찌에서 바늘까지 길이. 실제 수심보다 길면 찌가 눕고, 짧으면 미끼가 바닥에서 뜹니다.<br>${g.measuredDepth !== null ? `최근 측정 수심 <b>${g.measuredDepth.toFixed(1)}m</b>` : '캐스팅하면 찌 자리의 실제 수심이 표시됩니다'} · 원줄 ${g.rod.line}m</p>
    <div class="field"><input aria-label="찌에서 바늘까지 수심" type="range" min="0.3" max="${g.rod.line}" step="0.1" value="${g.depthSet}" data-act="depth" ${lockAttr}><output>${g.depthSet.toFixed(1)}m</output></div></div>`;
  const lineWear = p.wearOf(`line:${g.line.id}`), rodWear = p.wearOf(`rod:${g.rodId}`);
  const maxLoad = Math.min(g.line.strength, g.rod.power * 1.6);
  return `<div class="panel wide">
  <p class="kicker">${esc(c.activeRod ?? '새 낚싯대 기본 설정')} · 표시 성능은 게임 수치</p><h2>채비 조립</h2>
  ${g.canRig ? '' : '<p class="warn">채비를 걷어 들인 뒤(R)에 바꿀 수 있어요</p>'}
  <div class="rig-layout">
    <ol class="rig-chain">${steps.map(([id, label, icon, value]) => `<li><button class="rig-step ${ui.rigStep === id ? 'on' : ''}" data-act="rig-step" data-id="${id}"><span class="slot-art">${icon}</span><span><small>${label}</small><b>${esc(value)}</b></span></button></li>`).join('')}</ol>
    <div class="rig-options">${ui.rigStep === 'depth' ? depth : `<div class="choices">${options}</div>`}</div>
  </div>
  <div class="rig-stats">
    <span>최대 하중 <b>${maxLoad.toFixed(1)}kg</b></span>
    <span>원줄 ${wearBar(lineWear)}</span>
    <span>낚싯대 ${wearBar(rodWear)}</span>
    <span>뜰채 한계 <b>${p.netSpec.maxKg}kg</b></span>
  </div>
  ${encounterForecast(g)}
  ${close('C')}
</div>`;
}

// ── 살림망 ──

export function keepnetPanel(c: PanelCtx) {
  const p = c.player;
  const cap = p.keepnetSpec.capacity, total = p.keepnetKg;
  const value = (id: string | undefined) => p.data.catches.find(r => r.id === id)?.value ?? 0;
  const rows = p.keepnet.map(f => `<li><span class="net-icon">${fishIcon(f.species.look)}</span><b>${f.species.name}</b><span>${f.cm.toFixed(1)}cm</span><span>${kgText(f.kg)}</span><span>${won(value(f.id))}</span>
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
  <h3>오늘의 시세 <small>매일 바뀝니다. 기록 등급(월척·대물)은 더 비싸게 팔려요</small></h3>
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
      lines: [`${l.strength}kg에 끊어짐`, wearBar(wear)], actions: [wear > 0.01 ? `<button class="btn small" data-act="repair" data-id="line:${l.id}">새 줄 감기 · ${won(p.repairCost(`line:${l.id}`))}</button>` : ''] });
  }
  for (const f of FLOATS) if (d.floats.includes(f.id)) items.push({ key: `float:${f.id}`, name: f.name, rarity: f.rarity, icon: itemIcon('float'), count: '', desc: f.desc, lines: [`예민함 ${f.sensitivity}${f.glow ? ' · 야간 발광' : ''}`], actions: [] });
  for (const h of HOOKS) if (d.hooks.includes(h.id)) items.push({ key: `hook:${h.id}`, name: h.name, rarity: h.rarity, icon: itemIcon('hook'), count: '', desc: h.desc, lines: [`걸림 ${h.hold} · 유인 ${h.attraction}`], actions: [] });
  for (const n of NETS) if (d.nets.includes(n.id)) items.push({ key: `net:${n.id}`, name: n.name, rarity: n.rarity, icon: itemIcon('net'), count: d.net === n.id ? 'E' : '', desc: n.desc,
    lines: [`${n.maxKg}kg까지 안전하게 떠냄`], actions: [d.net === n.id ? '<span class="tag">장착 중</span>' : `<button class="btn small" data-act="equip" data-kind="net" data-id="${n.id}">장착</button>`] });
  for (const k of KEEPNETS) if (d.keepnets.includes(k.id)) items.push({ key: `keepnet:${k.id}`, name: k.name, rarity: k.rarity, icon: itemIcon('keepnet'), count: d.keepnetId === k.id ? 'E' : '', desc: k.desc,
    lines: [`${k.capacity}마리까지 보관`], actions: [d.keepnetId === k.id ? '<span class="tag">장착 중</span>' : `<button class="btn small" data-act="equip" data-kind="keepnet" data-id="${k.id}">장착</button>`] });
  for (const b of Object.values(BAITS)) if (p.genericBaitCount(b.id)) items.push({ key: `bait:${b.id}`, name: b.name, icon: itemIcon(b.id), count: p.genericBaitCount(b.id), desc: b.desc, lines: [], actions: [] });
  if (p.genericBaitCount('chum')) items.push({ key: 'bait:chum', name: '집어 떡밥', icon: itemIcon('chum'), count: p.genericBaitCount('chum'), desc: '찌 주변에 뿌려 물고기를 모읍니다 (G / 4)', lines: [], actions: [] });
  for (const b of BAIT_PRODUCTS) if (d.baitProducts[b.id]) {
    const selected = (b.baseBait === 'chum' ? c.game.chumProductId : c.game.baitProductId) === b.id;
    items.push({ key: `bait:${b.id}`, name: b.name, icon: itemIcon(b.baseBait), count: d.baitProducts[b.id], desc: b.desc,
      lines: [`게임 재고 ${d.baitProducts[b.id]}회분 · 입질 ×${b.biteScale} / 집어 ×${b.chumScale}`],
      actions: [selected ? '<span class="tag">선택 중</span>' : `<button class="btn small primary" data-act="rig" data-kind="baitProduct" data-id="${b.id}" ${c.game.canRig ? '' : 'disabled'}>${b.baseBait === 'chum' ? '집어제로 선택' : '미끼로 선택'}</button>`] });
  }
  for (const i of INGREDIENTS) if (d.ingredients[i.id]) items.push({ key: `ing:${i.id}`, name: i.name, icon: itemIcon(i.id), count: d.ingredients[i.id], desc: i.desc, lines: ['배합대에서 떡밥 재료로 사용'], actions: [] });
  for (const item of items) {
    const [kind, id] = item.key.split(':');
    const note = productNote(kind === 'ing' ? 'ingredient' : kind, id);
    if (note) item.lines.push(note, '표시 가격·하중·길이·효과는 게임 규격');
  }
  return items;
}

export function inventoryPanel(c: PanelCtx) {
  const p = c.player, d = p.data, g = c.game;
  let content: string;
  if (c.ui.inventoryTab === 'bag') {
    const items = inventoryItems(c);
    const selected = items.find(i => i.key === c.ui.invSelected) ?? items[0];
    const grid = items.map(i => slot(i.icon, i.count, `data-act="inv-select" data-id="${i.key}" title="${esc(i.name)}"`, `${selected?.key === i.key ? 'on' : ''} r-${i.rarity ?? 'common'}`)).join('')
      + Array.from({ length: Math.max(0, 36 - items.length) }, () => '<span class="slot empty"></span>').join('');
    const equip = [
      ['낚싯대', itemIcon('rod', g.rodId)], ['원줄', itemIcon('line')], ['찌', itemIcon('float')], ['바늘', itemIcon('hook')],
      ['미끼', itemIcon(g.bait)], ['뜰채', itemIcon('net')], ['살림망', itemIcon('keepnet')],
    ].map(([label, icon]) => `<div class="equip-slot">${slot(icon, '', `data-act="menu" data-id="setup" title="${label}"`)}<small>${label}</small></div>`).join('');
    content = `<div class="inv-layout">
      <div class="equip-col">${equip}</div>
      <div><div class="slot-grid">${grid}</div>
      ${selected ? `<div class="item-detail"><div class="slot-art big">${selected.icon}</div><div>${rarityName(selected.rarity, selected.name)} ${rarityTag(selected.rarity)}<p>${esc(selected.desc)}</p>${selected.lines.map(l => `<p class="stat">${l}</p>`).join('')}<div class="row">${selected.actions.join('')}</div></div></div>` : ''}
      </div></div>`;
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
  return `<div class="panel wide"><p class="kicker">내 가방 · ${won(d.coins)} · Lv.${p.level}</p><h2>가방</h2>
    ${tabs('inventory-tab', c.ui.inventoryTab, [['bag', '아이템'], ['craft', '배합대']])}${content}${close('I')}</div>`;
}

// ── 상점 ──

export function shopPanel(c: PanelCtx) {
  const p = c.player, d = p.data;
  const card = (kind: ShopKind, item: { id: string; name: string; price: number; level?: number; rarity?: Rarity; desc?: string }, icon: string, info: string) => {
    const owned = p.owns(kind, item.id);
    const locked = (item.level ?? 1) > p.level;
    const label = owned ? '보유 중' : locked ? `Lv.${item.level} 필요` : won(item.price);
    return `<div class="shop-card ${locked ? 'locked' : ''}">${slot(locked ? itemIcon('lock') : icon, '', '', `r-${item.rarity ?? 'common'}`)}<div>${rarityName(item.rarity, item.name)} ${rarityTag(item.rarity)}<small>${esc(item.desc ?? '')}${info ? `<br>${info}` : ''}${productNote(kind, item.id)}</small></div>
      <button class="btn small ${owned || locked ? '' : 'primary'}" data-act="buy" data-kind="${kind}" data-id="${item.id}" ${owned || locked || d.coins < item.price ? 'disabled' : ''}>${label}</button></div>`;
  };
  let body = '';
  switch (c.ui.shopTab) {
    case 'bait':
      body = BAIT_PRODUCTS.map(b => card('bait', b, itemIcon(b.baseBait), `${b.count}회분 · 재고 ${d.baitProducts[b.id] ?? 0} · 게임 입질 ×${b.biteScale} / 집어 ×${b.chumScale}`)).join('')
        + BAIT_PACKS.map(b => card('bait', { ...b, desc: b.id === 'chum' ? '찌 주변에 뿌리는 기본 집어제' : BAITS[b.id as BaitId].desc }, itemIcon(b.id), `일반 재고 ${p.genericBaitCount(b.id as BaitId | 'chum')}`)).join('')
        + INGREDIENTS.map(i => card('ingredient', { ...i, name: `${i.name} ${i.count}개` }, itemIcon(i.id), `재고 ${d.ingredients[i.id]}`)).join('');
      break;
    case 'rod': body = RODS.map(r => card('rod', r, itemIcon('rod', r.id), `길이 ${r.length}m · 힘 ${r.power}kg · 보유 ${d.rods[r.id] ?? 0}대`)).join(''); break;
    case 'line': body = LINES.map(l => card('line', l, itemIcon('line'), `${l.strength}kg에 끊어짐`)).join(''); break;
    case 'terminal': body = FLOATS.map(f => card('float', f, itemIcon('float'), `예민함 ${f.sensitivity}`)).join('') + HOOKS.map(h => card('hook', h, itemIcon('hook'), `걸림 ${h.hold}`)).join(''); break;
    case 'net': body = NETS.map(n => card('net', n, itemIcon('net'), `${n.maxKg}kg까지`)).join('') + KEEPNETS.map(k => card('keepnet', k, itemIcon('keepnet'), `${k.capacity}마리 보관`)).join(''); break;
    case 'repair': {
      const worn = [...RODS.filter(r => d.rods[r.id]).map(r => [`rod:${r.id}`, r.name, itemIcon('rod', r.id)]), ...LINES.filter(l => d.lines.includes(l.id)).map(l => [`line:${l.id}`, l.name, itemIcon('line')])]
        .filter(([key]) => p.wearOf(key) > 0.01);
      body = worn.length ? worn.map(([key, name, icon]) => `<div class="shop-card">${slot(icon)}<div><b>${esc(name)}</b><small>${wearBar(p.wearOf(key))}</small></div>
        <button class="btn small primary" data-act="repair" data-id="${key}" ${d.coins < p.repairCost(key) ? 'disabled' : ''}>${key.startsWith('line') ? '새 줄' : '수리'} · ${won(p.repairCost(key))}</button></div>`).join('')
        : '<p class="empty">손볼 장비가 없어요. 파이팅할수록 원줄과 낚싯대가 닳습니다.</p>';
    }
  }
  return `<div class="panel wide"><p class="kicker">${ACTIVE_FISHERY.name} 상점 · ${won(d.coins)} · Lv.${p.level} · 가격·성능은 게임 수치</p><h2>상점</h2>
    ${tabs('shop-tab', c.ui.shopTab, [['bait', '미끼·재료'], ['rod', '낚싯대'], ['line', '원줄'], ['terminal', '찌·바늘'], ['net', '뜰채·살림망'], ['repair', '수리']])}
    <div class="shop-list">${body}</div>
    ${d.baits.worm === 0 && d.coins < 30 ? '<button class="btn" data-act="gather">지렁이 채집 +5개</button>' : ''}
    ${close('B')}</div>`;
}

// ── 도감 ──

export function collectionPanel(c: PanelCtx) {
  const p = c.player;
  const found = SPECIES_LIST.filter(sp => p.data.catches.some(r => r.species === sp.id)).length;
  return `<div class="panel wide"><p class="kicker">물고기 도감</p><h2>${found} / ${SPECIES_LIST.length}종 발견</h2><div class="fish-collection">${SPECIES_LIST.map(sp => {
    const catches = p.data.catches.filter(r => r.species === sp.id);
    const rule = SPECIES_RULES[sp.id];
    const baits = preferredBaits(sp).map(b => `<span class="bait-affinity">${b.name} <b>${affinityLabel(sp.baits[b.id])}</b></span>`).join('');
    const habitats = FISHERIES.filter(f => f.population[sp.id] >= 1).map(f => f.name).join(' · ');
    const density = ACTIVE_FISHERY.population[sp.id];
    const tags = [rule.bounty ? '<span class="tag bad">생태계교란종 · 방생 금지</span>' : '', rule.minKeepCm ? `<span class="tag">금지 체장 ${rule.minKeepCm}cm</span>` : ''].join('');
    return `<article class="species-card ${catches.length ? 'discovered' : ''}"><span class="species-status">${catches.length ? `${catches.length}마리 기록` : '미발견'}</span><div class="fish-icon">${fishIcon(sp.look)}</div><h3>${sp.name}</h3>${tags}
      <p>선호 수심 ${sp.depth[0]}~${sp.depth[2]}m · 활동 ${ACTIVE_TEXT[rule.active]}<br>현재 낚시터: ${density === 0 ? '출현 없음' : density >= 1.5 ? '많음' : density >= 0.7 ? '보통' : '드묾'}<br>주요 서식지 ${habitats || '전 낚시터에서 드물게 출현'}<br>${BITE_DESCRIPTIONS[sp.bite]}</p><div class="bait-affinities">${baits}</div><p>시세 ${won(rule.perKg * marketMul(sp.id))}/kg · 등급 ${sp.ranks.map(([n, cm]) => `${n} ${cm}cm`).join(' · ')}</p>
      <b>최대어 ${p.best[sp.id] ? `${p.best[sp.id].toFixed(1)}cm` : '—'}</b></article>`;
  }).join('')}</div>${close('V')}</div>`;
}

// ── 개인 기록 ──

export function recordsPanel(c: PanelCtx) {
  const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const records = c.player.data.catches.filter(r => r.species === c.ui.recordSpecies && (!c.ui.weekly || r.at >= monday.getTime())).sort((a, b) => b.cm - a.cm || a.at - b.at).slice(0, 10);
  return `<div class="panel"><p class="kicker">싱글 플레이 · 개인 기록</p><h2>나의 최대어 순위</h2>
    ${tabs('record-species', c.ui.recordSpecies, SPECIES_LIST.map(sp => [sp.id, sp.name]))}
    ${tabs('record-period', c.ui.weekly ? 'week' : 'all', [['all', '전체 기록'], ['week', '이번 주']])}
    ${records.length ? `<ol class="record-list">${records.map((r, i) => `<li><span>${i + 1}</span><b>${r.cm.toFixed(1)}cm</b><small>${kgText(r.kg)} · ${(findFishery(r.fisheryId) ?? FISHERIES[0]).name} ${r.platform}번 좌대</small><small>${new Date(r.at).toLocaleDateString('ko-KR')} · ${r.kept ? '보관' : r.released ? '방생' : '수매'}</small></li>`).join('')}</ol>` : '<p class="empty">이 어종을 잡으면 기록이 남아요.</p>'}
    ${close('J')}</div>`;
}

// ── 좌대 이동 ──

export function platformsPanel(c: PanelCtx) {
  return `<div class="panel wide platform-panel"><p class="kicker">${ACTIVE_FISHERY.name}</p><h2>낚시터 선택</h2>${fisheryCards(c.online)}<h3>현재 낚시터의 좌대</h3>
    <div class="platform-list"><button class="platform-choice ${c.currentPlatform === null ? 'current' : ''}" data-act="travel" data-id="0">
      <span class="platform-number">관</span><b>관리동</b><small>낚시점 · 어시장</small><span class="platform-arrow">이동 →</span></button>${c.platforms.map(pl => `<button class="platform-choice ${c.currentPlatform === pl.id ? 'current' : ''}" data-act="travel" data-id="${pl.id}">
      <span class="platform-number">${String(pl.id).padStart(2, '0')}</span><b>${esc(pl.name)}</b><small>${['붕어 · 얕은 턱', '잉어 · 중간 수심', '향어 · 깊은 턱', '대물 · 깊은 수심'][Math.floor((pl.id - 1) / 2)]}<br>낚싯대 ${pl.rods} / ${MAX_DEPLOYED_RODS}${pl.bites ? ` · 입질 ${pl.bites}` : ''}</small><span class="platform-arrow">${c.currentPlatform === pl.id ? '현재 위치' : '이동 →'}</span>
    </button>`).join('')}</div><button class="btn" data-act="resume">돌아가기 <kbd>M</kbd></button></div>`;
}

// ── 의뢰·업적 ──

export function questsPanel(c: PanelCtx) {
  const p = c.player;
  let body: string;
  if (c.ui.questTab === 'daily') {
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
  return `<div class="panel"><p class="kicker">${ACTIVE_FISHERY.name} 관리소</p><h2>의뢰와 업적</h2>${tabs('quest-tab', c.ui.questTab, [['daily', '일일 의뢰'], ['achieve', '업적']])}${body}${close('Q')}</div>`;
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
    <p class="depth-note">지금은 다른 참가자를 봇이 대신합니다. 멀티플레이가 붙으면 같은 순위표에 실제 조사들이 올라옵니다.</p>
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
    <h3>입질 진동 <small>지원하는 기기에서만</small></h3>
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
  <section><h3>관리동</h3><div class="hub-grid">
    ${tile('shop', '낚시점', 'B', 'shop', '장비·미끼 구매')}${tile('market', '어시장', 'N', 'coin', p.keepnet.length ? `${p.keepnet.length}마리 판매` : '물고기 판매')}
  </div></section>
  <section><h3>활동</h3><div class="hub-grid">
    ${tile('quests', '의뢰·업적', 'Q', 'scroll', '', p.claimable)}${tile('tournament', '대회', 'T', 'trophy', t ? `${t.rank}위 진행 중` : '')}
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

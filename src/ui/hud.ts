import { MAX_DEPLOYED_RODS, type SpeciesId } from '../game/data';
import { WEATHER, type Environment } from '../game/environment';
import { ACTIVE_FISHERY } from '../game/fisheries';
import { emptyOnlineState, type OnlineState, type OnlineTab } from '../game/onlineState';
import type { FisheryId } from '../game/fisheries';
import type { Catch, Fishing } from '../game/fishing';
import { SPECIES_RULES } from '../game/items';
import type { PlayerProgress, ShopKind } from '../game/profile';
import type { SkillId } from '../game/skills';
import type { Tournament } from '../game/tournament';
import * as P from './panels';
import { fishIcon, itemIcon } from './pixelIcons';
import type { Settings } from './settings';
import './systems.css';
import './clean.css';
import './fisheries.css';
import './online.css';

// 화면 위 정보. 몰입을 위해 항상 보이는 것은 조준점·핫바·경험치 줄·시계·메뉴 버튼·살림망 게이지뿐이고,
// 나머지(키 안내, 캐스팅 힘, 장력계, 찌 확대, 대회)는 필요할 때만 나타난다.
// 기능은 메뉴(Esc / 오른쪽 위 버튼) 안에 분류해 둔다.

export interface HudHandlers {
  start(): void;
  sessionEnded(): void;
  /** 패널을 닫고 게임으로 돌아갈 때 */
  resume(): void;
  keep(keep: boolean): void;
  travel(id: number): void;
  fishery(id: string): void;
  online(action: string, value?: string): void;
  rig(kind: string, id: string): void;
  buy(kind: ShopKind, id: string): void;
  sell(): void;
  /** 어시장에서 한 마리 판매 */
  sellOne(id: string): void;
  gather(): void;
  craft(id: string): void;
  take(number: number): void;
  /** 가방에서 낚싯대를 꺼내 지금 좌대의 빈 자리에 든다 */
  deploy(rodId: string): void;
  /** 펼친 낚싯대를 거둬 가방에 넣는다 */
  recall(slotId: string): void;
  feed(): void;
  equip(kind: 'net' | 'keepnet', id: string): void;
  repair(key: string): void;
  learn(id: SkillId): void;
  claim(kind: 'quest' | 'achievement', id: string): void;
  join(id: string): void;
  quit(): void;
  release(id: string): void;
  setting(key: keyof Settings, value: string): void;
  reset(): void;
  menu(modal: MenuModal): void;
}

/** 살림망 게이지 가운데 물고기 모양 */
const FISH_GLYPH = '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M2 7c4-6 12-6 16 0-4 6-12 6-16 0z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M18 7l5-4v8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.5" cy="6" r="1.1" fill="currentColor"/></svg>';

export type Modal = 'none' | 'online' | 'setup' | 'keepnet' | 'pause' | 'platforms' | 'shop' | 'market' | 'collection' | 'records' | 'inventory' | 'quests' | 'skills' | 'tournament' | 'settings';
export type MenuModal = Exclude<Modal, 'none' | 'pause'>;

export class Hud {
  modal: Modal = 'none';
  started = false;
  private readonly el: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};
  private platforms: P.PlatformStatus[] = [];
  private currentPlatform: number | null = null;
  private activeRod: string | null = null;
  private rodSlots: P.RodStatus[] = [];
  private tournament: Tournament | null = null;
  private forecastAt = 0;
  private online = emptyOnlineState();
  private readonly ui: P.UiState = { inventoryTab: 'bag', invSelected: null, shopTab: 'bait', rigStep: 'rod', recordSpecies: 'crucian', weekly: false, questTab: 'daily', resetArmed: false, onlineTab: 'account', onlineSpecies: 'crucian', onlineScope: 'all', nicknameDraft: '', chatDraft: '' };

  constructor(
    root: HTMLElement,
    private game: Fishing,
    private readonly player: PlayerProgress,
    private readonly env: Environment,
    private readonly settings: Settings,
    private readonly h: HudHandlers,
  ) {
    root.innerHTML = `
<div class="night-tint" data-ref="night"></div>
<div class="start" data-ref="start">
  <div class="start-card">
    <p class="kicker">${ACTIVE_FISHERY.name} · 민물 찌낚시</p>
    <h1>좌대 낚시</h1>
    <button class="btn small" data-act="menu" data-id="online" data-ref="onlineEntry">Google 로그인 · 닉네임</button>
    <p class="lead">Google 로그인 후 버들못에서 낚시를 시작하세요.</p>
    ${P.fisheryCards()}
    <ul class="keys">
      <li><kbd>마우스</kbd> 둘러보기 · <kbd>WASD</kbd> 걷기 · <kbd>M</kbd> 좌대 이동</li>
      <li><kbd>E</kbd> 대 꺼내 들기 / 거치 / 다시 들기 · <kbd>F</kbd> 회수해 가방에 넣기</li>
      <li><kbd>좌클릭 길게 → 놓기</kbd> 앞치기 · <kbd>R</kbd> 채비 걷기</li>
      <li><kbd>좌클릭 / 우클릭</kbd> 또는 <kbd>Space</kbd> 챔질</li>
      <li>걸면: <kbd>좌클릭 누르기</kbd> 대 세우기 · <kbd>우클릭 누르기</kbd> 대 숙이기</li>
      <li><kbd>1</kbd>~<kbd>3</kbd> 낚싯대 · <kbd>4</kbd> 집어</li>
      <li><kbd>I</kbd> 가방 <kbd>C</kbd> 채비 <kbd>B</kbd> 상점 <kbd>Q</kbd> 의뢰 <kbd>T</kbd> 대회 <kbd>K</kbd> 기술 <kbd>O</kbd> 설정</li>
    </ul>
    <button class="btn primary" data-act="start" data-ref="entry" disabled>계정 확인 중…</button>
    <p class="tip">시간·날씨에 따라 어종별 입질이 달라져요</p>
  </div>
</div>
<div class="rotate-note"><b>화면을 가로로 돌려 주세요</b><small>낚시는 가로 화면에서 즐길 수 있어요</small></div>
<div class="place" data-ref="place"></div>
<button class="net-gauge" data-ref="netg" data-act="menu" data-id="keepnet" title="살림망 (Tab)" aria-label="살림망 열기" hidden></button>
<div class="corner" data-ref="corner" hidden>
  <div class="clock" data-ref="env"></div>
  <button class="hud-menu" data-act="hub" title="메뉴 (Esc)" aria-label="메뉴 열기"><i></i><i></i><i></i><b class="badge" data-ref="badge" hidden></b></button>
</div>
<div class="tour-pill" data-ref="trackers" hidden></div>
<div class="pip" data-ref="pip"></div>
<div class="crosshair"></div>
<div class="toasts" data-ref="toasts"></div>
<div class="power" data-ref="power"><i></i></div>
<div class="fight" data-ref="fight">
  <div class="meter" title="원줄 장력"><i data-ref="tfill"></i></div>
  <div class="meter rod" title="낚싯대 부하"><i data-ref="rfill"></i></div>
  <div class="fight-feel" data-ref="feel"></div>
</div>
<div class="prompt" data-ref="interaction" hidden></div>
<div class="mc-hud" data-ref="mc" hidden>
  <div class="mc-xp" data-ref="xp"><i></i><b></b></div>
  <div class="hotbar" data-ref="hotbar"></div>
</div>
<div class="modal" data-ref="modal"></div>
<div class="catch" data-ref="catch"></div>`;
    root.querySelectorAll<HTMLElement>('[data-ref]').forEach((e) => (this.el[e.dataset.ref!] = e));
    root.addEventListener('click', (ev) => this.onClick(ev));
    root.addEventListener('input', (ev) => this.onInput(ev));
    root.addEventListener('keydown', ev => {
      if ((ev.target as HTMLElement).id === 'chat-input' && ev.key === 'Enter' && !ev.isComposing) {
        ev.preventDefault(); ev.stopPropagation(); this.h.online('send', this.ui.chatDraft);
      }
    });
  }

  private onClick(ev: Event) {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t || t.matches(':disabled')) return;
    ev.stopPropagation();
    const id = t.dataset.id!;
    const kind = t.dataset.kind!;
    const rerender = () => this.renderModal();
    switch (t.dataset.act) {
      case 'start':
        if (this.enterGame()) break;
        if (this.online.uid) { this.ui.onlineTab = 'account'; this.open('online'); }
        else this.h.online('login');
        break;
      case 'look': { const url = new URL(location.href); url.searchParams.set('style', id); location.assign(url.href); break; }
      case 'resume': this.close(); break;
      case 'hub': this.open('pause'); break;
      case 'travel': this.h.travel(Number(id)); break;
      case 'fishery': this.h.fishery(id); break;
      case 'online-login': this.h.online('login'); break;
      case 'online-logout': this.h.online('logout'); break;
      case 'online-nickname': this.h.online('nickname', this.ui.nicknameDraft || this.online.nickname); break;
      case 'online-send': this.h.online('send', this.ui.chatDraft); break;
      case 'online-tab': this.ui.onlineTab = id as OnlineTab; this.syncOnlineView(); rerender(); break;
      case 'online-scope': this.ui.onlineScope = id as 'all' | FisheryId; this.syncOnlineView(); rerender(); break;
      case 'online-species': this.ui.onlineSpecies = id as SpeciesId; this.syncOnlineView(); rerender(); break;
      case 'map':
        if (this.started) this.h.menu('platforms');
        break;
      case 'bait': this.h.rig('bait', id); rerender(); break;
      case 'line': this.h.rig('line', id); rerender(); break;
      case 'rig': this.h.rig(kind, id); rerender(); break;
      case 'rig-step': this.ui.rigStep = id as P.RigStep; rerender(); break;
      case 'buy': this.h.buy(kind as ShopKind, id); rerender(); break;
      case 'shop-tab': this.ui.shopTab = id as P.ShopTab; rerender(); break;
      case 'sell': this.h.sell(); rerender(); break;
      case 'sell-one': this.h.sellOne(id); rerender(); break;
      case 'release': this.h.release(id); rerender(); break;
      case 'gather': this.h.gather(); rerender(); break;
      case 'craft': this.h.craft(id); rerender(); break;
      case 'take': this.h.take(Number(id)); break;
      case 'feed': this.h.feed(); break;
      case 'equip': this.h.equip(kind as 'net' | 'keepnet', id); rerender(); break;
      case 'repair': this.h.repair(id); rerender(); break;
      case 'deploy': this.h.deploy(id); break;
      case 'recall': this.h.recall(id); rerender(); break;
      case 'learn': this.h.learn(id as SkillId); rerender(); break;
      case 'claim': this.h.claim(kind as 'quest' | 'achievement', id); rerender(); break;
      case 'quest-tab': this.ui.questTab = id as 'daily' | 'achieve'; rerender(); break;
      case 'join': this.h.join(id); rerender(); break;
      case 'quit': this.h.quit(); rerender(); break;
      case 'inventory-tab': this.ui.inventoryTab = id as 'bag' | 'craft'; rerender(); break;
      case 'inv-select': this.ui.invSelected = id; rerender(); break;
      case 'menu': this.h.menu(id as MenuModal); break;
      case 'record-species': this.ui.recordSpecies = id as SpeciesId; rerender(); break;
      case 'record-period': this.ui.weekly = id === 'week'; rerender(); break;
      case 'keep': this.h.keep(id === '1'); break;
      case 'setting': this.h.setting(kind as keyof Settings, id); rerender(); break;
      case 'reset':
        if (this.ui.resetArmed) this.h.reset();
        this.ui.resetArmed = !this.ui.resetArmed; rerender(); break;
    }
  }

  private onInput(ev: Event) {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.act === 'nickname-draft') this.ui.nicknameDraft = t.value;
    if (t.dataset.act === 'chat-draft') this.ui.chatDraft = t.value;
    const out = t.closest('.field')?.querySelector('output');
    if (t.dataset.act === 'depth') {
      this.h.rig('depth', t.value);
      this.updateForecast();
      if (out) out.textContent = `${Number(t.value).toFixed(1)}m`;
    }
    if (t.dataset.act === 'setting-range') {
      this.h.setting(t.dataset.kind as keyof Settings, t.value);
      if (out) out.textContent = t.dataset.kind === 'volume' ? String(Math.round(Number(t.value) * 100)) : Number(t.value).toFixed(1);
    }
  }

  open(m: Modal) {
    if (!this.started && m !== 'online') return;
    const onlineWasOpen = this.modal === 'online';
    this.modal = m;
    if (!this.started) this.el.start.hidden = true;
    if (m === 'online' || onlineWasOpen) this.syncOnlineView();
    this.ui.resetArmed = false;
    this.renderModal();
  }

  close() {
    const onlineWasOpen = this.modal === 'online';
    this.modal = 'none';
    if (!this.started) this.el.start.hidden = false;
    if (onlineWasOpen) this.syncOnlineView();
    this.renderModal();
    this.h.resume();
  }

  setGame(game: Fishing) {
    this.game = game;
    this.last = {};
  }
  setTournament(t: Tournament | null) { this.tournament = t; }
  private syncOnlineView() {
    this.h.online('view', JSON.stringify({ tab: this.modal === 'online' ? this.ui.onlineTab : null, species: this.ui.onlineSpecies, scope: this.ui.onlineScope }));
  }
  /** 버튼·인증 복원·디버그 입장에 같은 인증 조건을 적용한다. */
  enterGame() {
    if (!this.online.ready || !this.online.uid || !this.online.nickname || this.online.busy) return false;
    if (this.started) return true;
    this.started = true;
    this.el.start.hidden = true;
    this.modal = 'none';
    this.renderModal();
    this.syncOnlineView();
    this.h.start();
    return true;
  }
  setOnline(state: OnlineState) {
    if (this.online.uid !== state.uid) { this.ui.nicknameDraft = ''; this.ui.chatDraft = ''; }
    this.online = { ...state };
    this.el.onlineEntry.textContent = state.nickname ? `${state.nickname} · 온라인` : 'Google 로그인 · 닉네임';
    (this.el.entry as HTMLButtonElement).disabled = !state.ready || state.busy;
    this.el.entry.textContent = !state.ready ? '계정 확인 중…' : state.busy ? '연결 중…' : state.uid ? '닉네임 설정 후 입장' : 'Google 로그인하고 입장 →';
    if (this.started && (!state.uid || !state.ready || !state.nickname)) {
      this.started = false;
      this.modal = 'none';
      this.el.start.hidden = false;
      this.renderModal();
      this.h.sessionEnded();
      this.syncOnlineView();
    }
    if (!this.started && state.ready && state.uid) {
      if (this.enterGame()) return;
      if (!state.nickname && this.modal !== 'online') { this.ui.onlineTab = 'account'; this.open('online'); }
    }
    if (this.modal !== 'online') return;
    const input = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
    const id = input?.id, start = input?.selectionStart ?? null, end = input?.selectionEnd ?? null;
    const log = this.el.modal.querySelector('.chat-messages');
    const top = log?.scrollTop ?? 0, atEnd = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 50;
    this.renderModal();
    const nextLog = this.el.modal.querySelector('.chat-messages');
    if (nextLog) nextLog.scrollTop = atEnd ? nextLog.scrollHeight : top;
    const next = id ? document.getElementById(id) as HTMLInputElement | null : null;
    if (next) { next.focus(); if (start !== null && end !== null) next.setSelectionRange(start, end); }
  }
  clearChatDraft() { this.ui.chatDraft = ''; this.setOnline(this.online); }

  setPlatforms(platforms: P.PlatformStatus[], current: number | null) {
    const changed = JSON.stringify(this.platforms) !== JSON.stringify(platforms) || this.currentPlatform !== current;
    this.platforms = platforms;
    this.currentPlatform = current;
    if (changed && this.modal === 'platforms') this.renderModal();
  }

  /** 지금 할 수 있는 동작 한 줄 (없으면 숨긴다) */
  setInteraction(action: string, active: string | null) {
    this.activeRod = active;
    this.el.interaction.hidden = !this.started || this.modal !== 'none' || !action;
    this.set('interaction', this.el.interaction, action);
    for (const key of ['corner', 'mc', 'netg']) this.el[key].hidden = !this.started;
  }

  setRodSlots(slots: P.RodStatus[]) {
    const changed = JSON.stringify(slots) !== JSON.stringify(this.rodSlots);
    this.rodSlots = slots;
    if (changed && this.modal === 'inventory') this.renderModal();
  }

  private ctx(): P.PanelCtx {
    return { player: this.player, game: this.game, env: this.env, tournament: this.tournament, rodSlots: this.rodSlots, platforms: this.platforms,
      currentPlatform: this.currentPlatform, activeRod: this.activeRod, ui: this.ui, settings: this.settings, online: this.online };
  }

  renderModal() {
    const box = this.el.modal;
    box.classList.toggle('on', this.modal !== 'none');
    const c = this.ctx();
    const panels: Record<Exclude<Modal, 'none'>, (c: P.PanelCtx) => string> = {
      setup: P.setupPanel, keepnet: P.keepnetPanel, market: P.marketPanel, inventory: P.inventoryPanel, shop: P.shopPanel, collection: P.collectionPanel,
      records: P.recordsPanel, platforms: P.platformsPanel, quests: P.questsPanel, skills: P.skillsPanel, tournament: P.tournamentPanel,
      settings: P.settingsPanel, pause: P.pausePanel, online: P.onlinePanel,
    };
    box.innerHTML = this.modal === 'none' ? '' : panels[this.modal](c);
  }
  private updateForecast() {
    if (this.modal !== 'setup') return;
    const node = this.el.modal.querySelector('.encounter-forecast');
    if (node) node.outerHTML = P.encounterForecast(this.game);
  }

  showCatch(c: Catch | null) {
    const box = this.el.catch;
    box.classList.toggle('on', !!c);
    if (!c) return;
    const p = this.player;
    const bounty = p.bounty(c);
    const small = p.tooSmall(c);
    const full = p.keepnet.length >= p.keepnetSpec.capacity;
    const keepNote = small ? `금지 체장(${SPECIES_RULES[c.species.id].minKeepCm}cm) 미만이라 보관할 수 없어요` : full ? `살림망이 가득 찼어요 (${p.keepnetSpec.capacity}마리). 판매하거나 더 큰 살림망을 쓰세요` : '';
    box.innerHTML = `<div class="catch-card">
  ${c.rank ? `<p class="rank">${c.rank}!</p>` : ''}
  <div class="fish-icon">${fishIcon(c.species.look)}</div><h2>${c.species.name}</h2>
  ${bounty ? '<p class="tag bad">생태계교란종 · 방생 금지</p>' : ''}
  <div class="nums"><div><b>${c.cm.toFixed(1)}</b><span>cm</span></div><div><b>${c.kg < 1 ? Math.round(c.kg * 1000) : c.kg.toFixed(2)}</b><span>${c.kg < 1 ? 'g' : 'kg'}</span></div></div>
  ${c.best ? '<p class="best">개인 최대어 갱신</p>' : ''}
  ${this.tournament?.counts(c.species.id) ? '<p class="best">대회 집계 대상!</p>' : ''}
  <p class="catch-value">살림망 판매가 ${p.catchValue(c).toLocaleString()}원${bounty ? ` · 바로 수매 ${bounty}원` : ' · 방생하면 경험치 +20%'}</p>
  ${keepNote ? `<p class="warn">${keepNote}</p>` : ''}
  <div class="row"><button class="btn primary" data-act="keep" data-id="1" ${small || full ? 'disabled' : ''}>살림망에 넣기 <kbd>E</kbd></button><button class="btn" data-act="keep" data-id="0">${bounty ? '수매하기' : '놓아주기'} <kbd>R</kbd></button></div>
</div>`;
  }

  toast(text: string, tone: 'good' | 'bad' | 'info' = 'info') {
    if (!text) return;
    const t = document.createElement('div');
    t.className = `toast ${tone}`;
    t.textContent = text;
    this.el.toasts.prepend(t);
    setTimeout(() => t.classList.add('out'), 2000);
    setTimeout(() => t.remove(), 2500);
    while (this.el.toasts.children.length > 2) this.el.toasts.lastElementChild!.remove();
  }

  private set(key: string, el: HTMLElement, html: string) {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }

  /** PIP 사각형 (CSS 픽셀) */
  get pipRect() {
    const r = this.el.pip.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  /** 하단: 경험치 줄 · 핫바 (1~3 낚싯대, 4 집어) */
  private updateBottom() {
    const p = this.player, d = p.data;
    (this.el.xp.firstElementChild as HTMLElement).style.width = `${p.levelProgress * 100}%`;
    this.set('lv', this.el.xp.lastElementChild as HTMLElement, String(p.level));
    const rods = Array.from({ length: MAX_DEPLOYED_RODS }, (_, i) => {
      const rod = this.rodSlots.find(r => r.number === i + 1 && (this.currentPlatform === null || r.platform === this.currentPlatform));
      const canPrepare = this.currentPlatform !== null && this.rodSlots.length < MAX_DEPLOYED_RODS;
      return P.slot(itemIcon('rod', rod?.rodId), '', `data-act="take" data-id="${i + 1}" ${rod || canPrepare ? '' : 'disabled'} title="${rod ? P.esc(`${rod.name} · ${rod.platform}번 좌대 · ${rod.state}`) : `${['왼쪽', '가운데', '오른쪽'][i]} 빈 자리 · 낚싯대 꺼내기`}"`,
        `${rod?.active ? 'on' : ''} ${rod?.biting ? 'biting' : ''} ${rod && !rod.active ? 'parked' : ''} ${rod ? '' : 'ghost'}`);
    });
    const chum = P.slot(itemIcon('chum'), this.game.chumProduct ? d.baitProducts[this.game.chumProduct.id] ?? 0 : d.baits.chum, `data-act="feed" title="${P.esc(this.game.chumProduct?.name ?? '집어 떡밥')} 뿌리기 (4 / G)"`);
    this.set('hotbar', this.el.hotbar, [...rods, chum].map((s, i) => `<div class="hot"><kbd>${i + 1}</kbd>${s}</div>`).join(''));
  }

  /** 대회 중일 때만 위쪽에 한 줄. 받을 보상·기술 포인트는 메뉴 버튼 배지로 */
  private updateTrackers() {
    const t = this.tournament, p = this.player;
    this.el.trackers.hidden = !t;
    if (t) {
      const m = Math.floor(t.remaining / 60), s = Math.floor(t.remaining % 60);
      this.set('trackers', this.el.trackers, `${itemIcon('trophy')}<b>${t.rank}위</b><small>${t.scoreText(t.player.score)} · ${m}:${String(s).padStart(2, '0')}</small>`);
    }
    const alerts = p.claimable + p.skillPoints;
    this.el.badge.hidden = !alerts;
    this.el.badge.textContent = String(alerts);
  }

  update(pipOn: boolean) {
    const g = this.game, env = this.env;
    const now = performance.now();
    if (this.modal === 'setup' && now - this.forecastAt >= 1000) { this.forecastAt = now; this.updateForecast(); }
    this.set('place', this.el.place, this.player.saveFailed ? '<span class="save-error">저장 공간 부족 · 이번 진행은 저장되지 않았어요</span>' : '');
    // 살림망 게이지: 마릿수 / 한도, 고리는 찬 만큼
    const p = this.player, cap = p.keepnetSpec.capacity, n = p.keepnet.length, fill = Math.min(1, n / cap);
    this.el.netg.style.setProperty('--p', `${fill * 360}deg`);
    this.el.netg.classList.toggle('full', fill > 0.85);
    this.set('netg', this.el.netg, `<span class="ng-in">${FISH_GLYPH}<b>${n}/${cap}</b></span>`);
    const w = env.weather;
    this.set('env', this.el.env, `<span class="env-icon" title="${WEATHER[w].name}">${itemIcon(env.night && w === 'clear' ? 'moon' : w)}</span><b>${env.clock}</b>`);
    this.el.night.style.opacity = String((1 - env.daylight) * 0.42);
    this.el.pip.classList.toggle('on', pipOn && this.started);
    if (this.started) { this.updateBottom(); this.updateTrackers(); }

    const power = this.el.power;
    power.classList.toggle('on', g.phase === 'charging');
    (power.firstElementChild as HTMLElement).style.width = `${g.castPower * 100}%`;

    const fighting = g.phase === 'fighting';
    this.el.fight.classList.toggle('on', fighting);
    if (fighting) {
      const ls = g.line.strength;
      const ratio = Math.min(1, g.tension / ls);
      const rod = Math.min(1, g.tension / g.rod.power);
      const color = (r: number) => r < 0.5 ? '#7fd17a' : r < 0.8 ? '#f2c14e' : '#ef5b4b';
      this.el.tfill.style.width = `${ratio * 100}%`;
      this.el.tfill.style.background = color(ratio);
      this.el.rfill.style.width = `${rod * 100}%`;
      this.el.rfill.style.background = color(rod);
      // 위험할 때만 한 줄로 알려 준다
      const f = g.fish;
      this.el.feel.textContent = !f ? '' : g.liftProgress > 0 ? `버티며 들어 올리는 중 ${Math.round(g.liftProgress * 100)}%` : ratio > 0.8 ? '줄이 끊어질 것 같아요 · 우클릭으로 대 숙이기' : f.kg > this.player.netSpec.maxKg ? '뜰채보다 무거워요' : f.stamina < 0.3 ? '힘이 빠졌어요 · 끌어오세요' : '';
    }
  }
}

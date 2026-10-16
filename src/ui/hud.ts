import { MAX_DEPLOYED_RODS, type SpeciesId } from '../game/data';
import { WEATHER, type Environment } from '../game/environment';
import { ACTIVE_FISHERY } from '../game/fisheries';
import { emptyOnlineState, type OnlineState } from '../game/onlineState';
import type { FisheryId } from '../game/fisheries';
import type { Catch, Fishing } from '../game/fishing';
import { SPECIES_RULES } from '../game/items';
import type { PlayerProgress, ShopKind } from '../game/profile';
import type { SkillId } from '../game/skills';
import type { Tournament } from '../game/tournament';
import type { FeedDraft } from '../game/feedMixing';
import * as P from './panels';
import { fishIcon, itemIcon } from './pixelIcons';
import type { Settings } from './settings';
import './systems.css';
import './clean.css';
import './fisheries.css';
import './online.css';
import './mobile.css';

// 화면 위 정보. 몰입을 위해 항상 보이는 것은 조준점·핫바·경험치 줄·시계·메뉴 버튼·살림망 게이지뿐이고,
// 나머지(키 안내, 캐스팅 힘, 장력계, 찌 확대, 대회)는 필요할 때만 나타난다.
// 기능은 메뉴(Esc / 오른쪽 위 버튼) 안에 분류해 둔다.

export interface HudHandlers {
  start(): void;
  sessionEnded(): void;
  chatFocus(): void;
  /** 패널을 닫고 게임으로 돌아갈 때 */
  resume(): void;
  keep(keep: boolean): void;
  travel(id: number): void;
  fishery(id: string): void;
  online(action: string, value?: string): void;
  /** 채비 바꾸기. target: 자리 id 또는 'empty:N'(N번 빈 자리에 꺼낼 대) */
  rig(kind: string, id: string, target: string): void;
  /** 채비 창에서 고른 대의 낚시 상태 */
  rigGame(target: string): Fishing;
  buy(kind: ShopKind, id: string): void;
  shopGoal(kind: ShopKind, id: string): void;
  clearShopGoal(): void;
  sell(): void;
  /** 어시장에서 한 마리 판매 */
  sellOne(id: string): void;
  gather(): void;
  craft(draft: FeedDraft): boolean;
  take(number: number): void;
  /** 가방에서 낚싯대를 꺼내 지금 좌대의 빈 자리에 든다 */
  deploy(rodId: string): void;
  /** 펼친 낚싯대를 거둬 가방에 넣는다 */
  recall(slotId: string): void;
  equip(kind: 'net' | 'keepnet', id: string): void;
  repair(key: string): void;
  learn(id: SkillId): void;
  claim(kind: 'quest' | 'achievement' | 'goal', id: string): void;
  join(id: string): void;
  quit(): void;
  release(id: string): void;
  setting(key: keyof Settings, value: string): void;
  reset(): void;
  menu(modal: MenuModal): void;
}

/** 살림망 게이지 가운데 물고기 모양 */
const FISH_GLYPH = '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M2 7c4-6 12-6 16 0-4 6-12 6-16 0z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M18 7l5-4v8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.5" cy="6" r="1.1" fill="currentColor"/></svg>';

export type Modal = 'none' | 'account' | 'onlineRanking' | 'setup' | 'keepnet' | 'pause' | 'shop' | 'market' | 'collection' | 'records' | 'inventory' | 'crafting' | 'quests' | 'skills' | 'tournament' | 'settings';
export type MenuModal = Exclude<Modal, 'none' | 'pause'>;

export class Hud {
  modal: Modal = 'none';
  started = false;
  chatting = false;
  private chatFolded = false;
  private touchHints: boolean | null = null;
  private readonly el: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};
  private platforms: P.PlatformStatus[] = [];
  private currentPlatform: number | null = null;
  private activeRod: string | null = null;
  private rodSlots: P.RodStatus[] = [];
  private tournament: Tournament | null = null;
  private online = emptyOnlineState();
  private readonly ui: P.UiState = { inventoryTab: 'all', invSelected: null, feedDraft: { name: '', parts: [] }, feedFilter: 'all', feedView: 'list', shopTab: 'bait', shopModel: null, shopBrand: null, rigStep: 'rod', rigTarget: null, recordSpecies: 'crucian', weekly: false, questTab: 'personal', goalGroup: 'start', resetArmed: false, onlineSpecies: 'crucian', onlineScope: 'all', nicknameDraft: '', chatDraft: '' };

  constructor(
    private readonly root: HTMLElement,
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
    <p class="kicker">민물 찌낚시</p>
    <h1>네모낚시</h1>
    <p class="lead">${ACTIVE_FISHERY.name}에서 바로 시작해요</p>
    <button class="btn primary" data-act="start" data-ref="entry" disabled>계정 확인 중…</button>
    <p class="admission-note" data-ref="admission" role="alert" hidden></p>
    <p class="admission-note" data-ref="loginError" role="alert" hidden></p>
    <div class="start-links">
      <button class="start-link" data-act="menu" data-id="account" data-ref="onlineEntry" hidden>계정 · 닉네임</button>
      <button class="start-link" data-act="menu" data-id="account" data-ref="reviewEntry">심사용 로그인</button>
    </div>
    <p class="tip">조작법은 게임 안 메뉴(☰)에서 볼 수 있어요</p>
  </div>
</div>
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
  <div class="meter" title="원줄 장력 · 100%면 끊어진다"><i data-ref="tfill"></i></div>
  <div class="fight-feel" data-ref="feel"></div>
</div>
<div class="prompt" data-ref="interaction" hidden></div>
<div class="mc-hud" data-ref="mc" hidden>
  <div class="mc-xp" data-ref="xp"><i></i><b></b></div>
  <div class="hotbar" data-ref="hotbar"></div>
</div>
<section class="lakeside-chat" data-ref="chat" aria-label="낚시터 채팅" hidden>
  <header><button class="chat-title" data-act="chat-focus">${ACTIVE_FISHERY.name} <span data-fishery-count="${ACTIVE_FISHERY.id}">— / 24명</span></button><button class="chat-fold" data-act="chat-fold" data-ref="chatFold" aria-label="채팅 접기" aria-expanded="true">−</button></header>
  <div class="dock-messages" data-ref="chatLog" role="log" aria-live="polite" aria-relevant="additions text"></div>
  <p class="dock-error" data-ref="chatError" role="alert" hidden></p>
  <div class="dock-compose" data-ref="chatCompose" hidden><input id="chat-input" data-act="chat-draft" maxlength="200" aria-label="채팅 메시지" placeholder="메시지 입력" autocomplete="off"><button data-act="online-send" data-ref="chatSend">전송</button></div>
  <button class="chat-open" data-act="chat-focus" data-ref="chatHint"><span class="key-hint">Enter · </span>채팅 입력</button>
</section>
<div class="modal" data-ref="modal"></div>
<div class="catch" data-ref="catch"></div>`;
    root.querySelectorAll<HTMLElement>('[data-ref]').forEach((e) => (this.el[e.dataset.ref!] = e));
    root.addEventListener('click', (ev) => this.onClick(ev));
    root.addEventListener('input', (ev) => this.onInput(ev));
    root.addEventListener('focusin', ev => { if ((ev.target as HTMLElement).id === 'chat-input' && !this.chatting) this.focusChat(); });
    root.addEventListener('keydown', ev => {
      if ((ev.target as HTMLElement).id === 'chat-input' && !ev.isComposing && ['Enter', 'Escape'].includes(ev.key)) {
        ev.preventDefault(); ev.stopPropagation();
        if (ev.key === 'Escape' || !this.ui.chatDraft.trim()) this.closeChat();
        else this.h.online('send', this.ui.chatDraft);
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
        if (this.online.uid && this.online.saveError) { this.h.online('retry-save'); break; }
        if (this.enterGame()) break;
        if (this.online.uid && this.online.nickname) this.h.online('enter');
        else if (this.online.uid) this.open('account');
        else this.h.online('login');
        break;
      case 'look': { const url = new URL(location.href); url.searchParams.set('style', id); location.assign(url.href); break; }
      case 'resume': this.close(); break;
      case 'hub': this.open('pause'); break;
      case 'travel': this.h.travel(Number(id)); break;
      case 'fishery': this.h.fishery(id); break;
      case 'online-login': this.h.online('login'); break;
      case 'online-review-login': {
        const email = this.root.querySelector<HTMLInputElement>('#review-email');
        const password = this.root.querySelector<HTMLInputElement>('#review-password');
        if (email && password) {
          const credentials = JSON.stringify({ email: email.value, password: password.value });
          password.value = '';
          this.h.online('review-login', credentials);
        }
        break;
      }
      case 'online-logout': this.h.online('logout'); break;
      case 'online-nickname': this.h.online('nickname', this.ui.nicknameDraft || this.online.nickname); break;
      case 'online-accept-terms': this.h.online('accept-terms'); break;
      case 'online-unblock': this.h.online('unblock', id); break;
      case 'online-block': this.h.online('block', JSON.stringify({ uid: id, nickname: t.dataset.nickname ?? '' })); break;
      case 'online-report': {
        const reason = window.prompt('신고 사유를 입력해 주세요. 선택한 내용과 이용자를 운영자에게 신고합니다.');
        if (reason?.trim()) this.h.online('report', JSON.stringify({ uid: id, nickname: t.dataset.nickname ?? '', messageId: t.dataset.message ?? '', reason }));
        break;
      }
      case 'online-send': this.h.online('send', this.ui.chatDraft); break;
      case 'chat-focus': this.focusChat(); break;
      case 'chat-fold':
        this.chatFolded = !this.chatFolded;
        if (this.chatFolded && this.chatting) this.closeChat();
        this.updateChat(); break;
      case 'online-scope': this.ui.onlineScope = id as 'all' | FisheryId; this.syncOnlineView(); rerender(); break;
      case 'online-species': this.ui.onlineSpecies = id as SpeciesId; this.syncOnlineView(); rerender(); break;
      case 'bait': this.h.rig('bait', id, this.rigTarget()); rerender(); break;
      case 'line': this.h.rig('line', id, this.rigTarget()); rerender(); break;
      case 'rig': this.h.rig(kind, id, this.rigTarget()); rerender(); break;
      case 'rig-target': this.ui.rigTarget = id; rerender(); break;
      case 'rig-step': this.ui.rigStep = id as P.RigStep; rerender(); break;
      case 'buy': this.h.buy(kind as ShopKind, id); rerender(); break;
      case 'shop-tab': this.ui.shopTab = id as P.ShopTab; this.ui.shopModel = null; this.ui.shopBrand = null; rerender(); break;
      case 'shop-brand': this.ui.shopBrand = id === 'all' ? null : id; this.ui.shopModel = null; this.el.modal.querySelector('.panel')?.scrollTo?.(0, 0); rerender(); break;
      case 'shop-model': this.ui.shopModel = id || null; this.el.modal.querySelector('.panel')?.scrollTo?.(0, 0); rerender(); break;
      case 'shop-goal': this.h.shopGoal(kind as ShopKind, id); rerender(); break;
      case 'clear-shop-goal': this.h.clearShopGoal(); rerender(); break;
      case 'sell': this.h.sell(); rerender(); break;
      case 'sell-one': this.h.sellOne(id); rerender(); break;
      case 'release': this.h.release(id); rerender(); break;
      case 'gather': this.h.gather(); rerender(); break;
      case 'feed-filter': this.ui.feedFilter = id as P.UiState['feedFilter']; rerender(); break;
      case 'feed-new': this.ui.feedView = 'mix'; this.ui.feedFilter = 'all'; rerender(); break;
      case 'feed-view': this.ui.feedView = id as P.UiState['feedView']; rerender(); break;
      case 'feed-adjust': this.setFeedCount(id, (this.ui.feedDraft.parts.find(p => p.key === id)?.count ?? 0) + Number(kind)); rerender(); break;
      case 'feed-clear': this.ui.feedDraft.parts = []; rerender(); break;
      case 'craft':
        if (this.h.craft(this.ui.feedDraft)) { this.ui.feedDraft.parts = []; this.ui.feedDraft.name = ''; this.ui.feedView = 'list'; }
        rerender(); break;
      case 'take': this.h.take(Number(id)); break;
      case 'equip': this.h.equip(kind as 'net' | 'keepnet', id); rerender(); break;
      case 'repair': this.h.repair(id); rerender(); break;
      case 'deploy': this.h.deploy(id); break;
      case 'recall': this.h.recall(id); rerender(); break;
      case 'learn': this.h.learn(id as SkillId); rerender(); break;
      case 'claim': this.h.claim(kind as 'quest' | 'achievement' | 'goal', id); rerender(); break;
      case 'quest-tab': this.ui.questTab = id as P.UiState['questTab']; rerender(); break;
      case 'goal-group': this.ui.goalGroup = id as P.UiState['goalGroup']; rerender(); break;
      case 'join': this.h.join(id); rerender(); break;
      case 'quit': this.h.quit(); rerender(); break;
      case 'inventory-tab': this.ui.inventoryTab = id as P.InvTab; rerender(); break;
      case 'inv-select': this.ui.invSelected = id; rerender(); break;
      case 'menu': if (id === 'chat') this.focusChat(); else this.h.menu(id as MenuModal); break;
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
    if (t.dataset.act === 'feed-name') this.ui.feedDraft.name = t.value;
    if (t.dataset.act === 'feed-count') {
      const count = this.setFeedCount(t.dataset.id!, Number(t.value));
      if (t.value !== '') t.value = String(count);
      const row = t.closest('.feed-material');
      row?.classList.toggle('selected', count > 0);
      const minus = row?.querySelector<HTMLButtonElement>('[data-kind="-1"]');
      const plus = row?.querySelector<HTMLButtonElement>('[data-kind="1"]');
      if (minus) minus.disabled = count === 0;
      if (plus) plus.disabled = count >= Math.min(this.player.feedMaterialCount(t.dataset.id!), 1000);
      const summary = this.el.modal.querySelector('[data-feed-summary]');
      if (summary) summary.innerHTML = P.feedSummary(this.ctx());
    }
    if (t.dataset.act === 'nickname-draft') this.ui.nicknameDraft = t.value;
    if (t.dataset.act === 'chat-draft') this.ui.chatDraft = t.value;
    const out = t.closest('.field')?.querySelector('output');
    if (t.dataset.act === 'depth') {
      this.h.rig('depth', t.value, this.rigTarget());
      if (out) out.textContent = `${Number(t.value).toFixed(1)}m`;
    }
    if (t.dataset.act === 'setting-range') {
      this.h.setting(t.dataset.kind as keyof Settings, t.value);
      if (out) out.textContent = t.dataset.kind === 'volume' ? String(Math.round(Number(t.value) * 100)) : Number(t.value).toFixed(1);
    }
  }

  private setFeedCount(key: string, value: number) {
    const count = Number.isFinite(value) ? Math.max(0, Math.min(1000, this.player.feedMaterialCount(key), Math.floor(value))) : 0;
    this.ui.feedDraft.parts = this.ui.feedDraft.parts.filter(p => p.key !== key);
    if (count) this.ui.feedDraft.parts.push({ key, count });
    return count;
  }

  open(m: Modal) {
    if (!this.started && m !== 'account') return;
    this.chatting = false;
    (this.el.chatCompose.querySelector('input') as HTMLInputElement).blur();
    this.modal = m;
    if (!this.started) this.el.start.hidden = true;
    this.syncOnlineView();
    this.ui.resetArmed = false;
    if (m === 'setup') this.ui.rigTarget = null;
    this.renderModal();
  }

  close() {
    this.modal = 'none';
    if (!this.started) this.el.start.hidden = false;
    this.syncOnlineView();
    this.renderModal();
    this.h.resume();
  }

  setGame(game: Fishing) {
    this.game = game;
    this.last = {};
  }
  setTournament(t: Tournament | null) { this.tournament = t; }
  private syncOnlineView() {
    this.h.online('view', JSON.stringify({ tab: this.modal === 'onlineRanking' ? 'ranking' : this.modal === 'account' ? 'account' : null, species: this.ui.onlineSpecies, scope: this.ui.onlineScope }));
  }
  /** 버튼·인증 복원·디버그 입장에 같은 인증 조건을 적용한다. */
  enterGame() {
    if (!this.online.ready || !this.online.uid || !this.online.saveReady || !this.online.nickname || !this.online.admitted || this.online.busy) return false;
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
    this.el.onlineEntry.textContent = state.nickname ? `${state.nickname} · 계정` : '계정 · 닉네임';
    // 로그인한 뒤에만 계정 버튼을 보이고, 로그인 실패 이유는 시작 화면에 바로 띄운다
    this.el.onlineEntry.hidden = !state.uid;
    // 심사용 로그인은 로그인 전에만 (스토어 심사 계정 진입로)
    this.el.reviewEntry.hidden = !!state.uid;
    this.el.loginError.textContent = state.error || state.saveError;
    this.el.loginError.hidden = !(state.error || state.saveError);
    // 진행 저장을 불러오는 중에는 기다리고, 실패하면 같은 버튼으로 다시 시도한다
    const loadingSave = !!state.uid && !state.saveReady && !state.saveError;
    (this.el.entry as HTMLButtonElement).disabled = !state.ready || state.busy || state.entering || loadingSave;
    this.el.entry.textContent = !state.ready ? '계정 확인 중…' : state.entering ? '입장 확인 중…' : state.busy ? '연결 중…'
      : state.uid ? !state.saveReady ? state.saveError ? '진행 다시 불러오기' : '진행 불러오는 중…' : state.nickname ? '버들못 입장 →' : '닉네임 설정 후 입장'
      : 'Google 로그인하고 입장 →';
    this.el.admission.textContent = state.admissionError;
    this.el.admission.hidden = !state.admissionError;
    this.updateCounts(); this.updateChat();
    if (this.started && (!state.uid || !state.ready || !state.nickname || !state.admitted)) {
      this.started = false;
      this.chatting = false;
      this.modal = 'none';
      this.el.start.hidden = false;
      this.renderModal();
      this.h.sessionEnded();
      this.syncOnlineView();
      this.updateChat();
    }
    if (!this.started && state.ready && state.uid) {
      if (this.enterGame()) return;
      if (state.nickname && state.admissionError && this.modal !== 'none') {
        this.modal = 'none'; this.el.start.hidden = false;
        this.renderModal(); this.syncOnlineView();
      }
      if ((!state.nickname || !state.termsAccepted) && this.modal !== 'account') this.open('account');
    }
    if (!['account', 'onlineRanking'].includes(this.modal)) return;
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
  clearChatDraft() { this.ui.chatDraft = ''; (this.el.chatCompose.querySelector('input') as HTMLInputElement).value = ''; }
  focusChat() {
    if (!this.started) return;
    this.chatting = true; this.chatFolded = false;
    this.modal = 'none'; this.renderModal(); this.syncOnlineView();
    this.h.chatFocus();
    (this.el.chatCompose.querySelector('input') as HTMLInputElement).focus();
  }
  closeChat() {
    this.chatting = false;
    (this.el.chatCompose.querySelector('input') as HTMLInputElement).blur();
    this.updateChat();
    if (this.modal === 'none') this.h.resume();
  }
  private updateCounts() {
    this.root.querySelectorAll<HTMLElement>('[data-fishery-count]').forEach(el => {
      el.textContent = P.fisheryOccupancy(this.online, el.dataset.fisheryCount as FisheryId);
    });
  }
  private updateChat() {
    const log = this.el.chatLog;
    const wasAtEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 50;
    const html = P.dockMessages(this.online);
    if (this.last.chatLog !== html) {
      this.set('chatLog', log, html);
      if (wasAtEnd) log.scrollTop = log.scrollHeight;
    }
    this.el.chat.hidden = !this.started || this.modal !== 'none';
    this.el.chat.classList.toggle('editing', this.chatting);
    this.el.chat.classList.toggle('folded', this.chatFolded);
    this.el.chatFold.textContent = this.chatFolded ? '+' : '−';
    this.el.chatFold.setAttribute('aria-expanded', String(!this.chatFolded));
    this.el.chatCompose.hidden = !this.chatting;
    this.el.chatHint.hidden = this.chatting;
    (this.el.chatSend as HTMLButtonElement).disabled = this.online.busy || !this.online.admitted;
    this.el.chatError.textContent = this.online.error;
    this.el.chatError.hidden = !this.online.error;
  }

  setPlatforms(platforms: P.PlatformStatus[], current: number | null) {
    this.platforms = platforms;
    this.currentPlatform = current;
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
    if (changed && (this.modal === 'inventory' || this.modal === 'setup')) this.renderModal();
  }

  /** 채비 창의 대: 고른 대가 없거나 사라졌으면 손에 든 대 → 첫 빈 자리 → 첫 대 */
  private rigTarget() {
    const t = this.ui.rigTarget;
    const empty = (n: number) => `empty:${n}`;
    const firstEmpty = [1, 2, 3].find(n => !this.rodSlots.some(r => r.number === n));
    const em = /^empty:([1-3])$/.exec(t ?? '');
    if (t && (em ? !this.rodSlots.some(r => r.number === Number(em[1])) : this.rodSlots.some(r => r.slotId === t))) return t;
    return this.rodSlots.find(r => r.active)?.slotId ?? (firstEmpty ? empty(firstEmpty) : this.rodSlots[0]?.slotId ?? empty(1));
  }

  private ctx(): P.PanelCtx {
    const rigTarget = this.rigTarget();
    return { player: this.player, game: this.game, rigTarget, rigGame: this.h.rigGame(rigTarget), env: this.env, tournament: this.tournament, rodSlots: this.rodSlots, platforms: this.platforms,
      currentPlatform: this.currentPlatform, activeRod: this.activeRod, ui: this.ui, settings: this.settings, online: this.online };
  }

  renderModal() {
    const box = this.el.modal;
    const craftScroll = this.modal === 'crafting' ? {
      panel: box.querySelector('.crafting-panel')?.scrollTop ?? 0,
      materials: box.querySelector('.feed-materials')?.scrollTop ?? 0,
    } : null;
    box.classList.toggle('on', this.modal !== 'none');
    const c = this.ctx();
    const panels: Record<Exclude<Modal, 'none'>, (c: P.PanelCtx) => string> = {
      setup: P.setupPanel, keepnet: P.keepnetPanel, market: P.marketPanel, inventory: P.inventoryPanel, crafting: P.craftingPanel, shop: P.shopPanel, collection: P.collectionPanel, records: P.recordsPanel, quests: P.questsPanel, skills: P.skillsPanel, tournament: P.tournamentPanel,
      settings: P.settingsPanel, pause: P.pausePanel, account: P.accountPanel, onlineRanking: P.onlineRankingPanel,
    };
    box.innerHTML = this.modal === 'none' ? '' : panels[this.modal](c);
    // 모든 창은 맨 오른쪽 위에 닫기(✕). 스크롤해도 따라 내려온다
    box.querySelector('.panel')?.insertAdjacentHTML('afterbegin', '<div class="panel-x"><button data-act="resume" title="닫기 (Esc)" aria-label="닫기"><i></i><i></i></button></div>');
    if (craftScroll) {
      const panel = box.querySelector('.crafting-panel'), materials = box.querySelector('.feed-materials');
      if (panel) panel.scrollTop = craftScroll.panel;
      if (materials) materials.scrollTop = craftScroll.materials;
    }
    this.updateCounts(); this.updateChat();
  }

  showCatch(c: Catch | null) {
    const box = this.el.catch;
    box.classList.toggle('on', !!c);
    if (!c) return;
    const p = this.player;
    const bounty = p.bounty(c);
    const small = p.tooSmall(c);
    const full = p.keepnet.length >= p.keepnetSpec.capacity;
    const keepNote = small ? `금지 체장(${SPECIES_RULES[c.species.id].minKeepCm}cm) 미만이라 보관할 수 없어요` : full ? `살림망이 가득 찼어요 (${p.keepnetSpec.capacity}마리) · 어시장에서 팔거나 놓아주세요` : '';
    box.innerHTML = `<div class="catch-card">
  <p class="rank">${P.sizeRankBadge(c.species.id, c.cm)}</p>
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

  /** 하단: 경험치 줄 · 핫바 (1~3 낚싯대) */
  private updateBottom() {
    const p = this.player;
    (this.el.xp.firstElementChild as HTMLElement).style.width = `${p.levelProgress * 100}%`;
    this.set('lv', this.el.xp.lastElementChild as HTMLElement, String(p.level));
    const rods = Array.from({ length: MAX_DEPLOYED_RODS }, (_, i) => {
      const rod = this.rodSlots.find(r => r.number === i + 1 && (this.currentPlatform === null || r.platform === this.currentPlatform));
      const canPrepare = this.currentPlatform !== null && this.rodSlots.length < MAX_DEPLOYED_RODS;
      return P.slot(itemIcon('rod', rod?.rodId), '', `data-act="take" data-id="${i + 1}" ${rod || canPrepare ? '' : 'disabled'} title="${rod ? P.esc(`${rod.name} · ${rod.platform}번 좌대 · ${rod.state}`) : `${['왼쪽', '가운데', '오른쪽'][i]} 빈 자리 · 낚싯대 꺼내기`}"`,
        `${rod?.active ? 'on' : ''} ${rod && !rod.active ? 'parked' : ''} ${rod ? '' : 'ghost'}`);
    });
    this.set('hotbar', this.el.hotbar, rods.map((s, i) => `<div class="hot"><kbd>${i + 1}</kbd>${s}</div>`).join(''));
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
    // 키보드에서만 입력칸에 키 안내를 붙인다 (터치 조작이 켜지거나 꺼지면 바꾼다)
    const touch = document.body.classList.contains('touch');
    if (touch !== this.touchHints) {
      this.touchHints = touch;
      (this.el.chatCompose.querySelector('input') as HTMLInputElement).placeholder = touch ? '메시지 입력' : '메시지 입력 · Enter 전송 · Esc 닫기';
    }
    const g = this.game, env = this.env;
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
      // 100% = 줄이 끊기거나 대가 부러진다
      const ratio = Math.min(1, g.tension / g.breakLimit);
      const color = (r: number) => r < 0.5 ? '#7fd17a' : r < 0.8 ? '#f2c14e' : '#ef5b4b';
      this.el.tfill.style.width = `${ratio * 100}%`;
      this.el.tfill.style.background = color(ratio);
      // 줄이 위험하면 막대가 떨리며 붉게 빛난다
      this.el.fight.classList.toggle('danger', ratio > 0.8);
      // 위험할 때만 한 줄로 알려 준다
      const f = g.fish;
      this.el.feel.textContent = !f ? '' : g.liftProgress > 0 ? `들어 올리는 중 ${Math.round(g.liftProgress * 100)}%` : '';
    }
  }
}

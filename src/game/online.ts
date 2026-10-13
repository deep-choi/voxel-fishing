import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, setDoc, writeBatch, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ACTIVE_FISHERY, FISHERIES, type FisheryId } from './fisheries';
import type { Catch } from './fishing';
import { SPECIES_LIST, type SpeciesId } from './data';
import { emptyOnlineState, type LocalPlayerPose, type OnlineState, type OnlineTab, type ChatMessage, type RankingEntry } from './onlineState';
import { FisheryPresence } from './presence';
import { COMMUNITY_TERMS_VERSION, readBlockedUsers, saveBlockedUsers } from './community';

const atMillis = (value: unknown) => (value as Timestamp | undefined)?.toMillis?.() ?? 0;
function message(error: unknown) {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '로그인이 취소됐어요';
  if (code === 'auth/popup-blocked') return '팝업을 허용한 뒤 구글 로그인을 다시 눌러 주세요';
  if (code === 'auth/unauthorized-domain') return '이 주소에서는 구글 로그인이 허용되지 않아요';
  if (code === 'permission-denied') return '저장 권한을 확인할 수 없어요. 다시 로그인해 주세요';
  if (code === 'resource-exhausted') return '온라인 이용량이 많아요. 잠시 후 다시 시도해 주세요';
  return error instanceof Error && !code ? error.message : '연결에 실패했어요. 잠시 후 다시 시도해 주세요';
}

/** 싱글 시뮬레이션과 분리된 인증·프로필·채팅·임시 공개 기록 서비스. */
export class OnlineService {
  readonly state = emptyOnlineState();
  private user: User | null = null;
  private epoch = 0;
  private profileStop?: Unsubscribe;
  private roomStop?: Unsubscribe;
  private rankingStop?: Unsubscribe;
  private viewed: OnlineTab | null = null;
  private species: SpeciesId = 'crucian';
  private scope: 'all' | FisheryId = 'all';
  private sentAt = 0;
  private listeners = new Set<(state: OnlineState) => void>();
  private readonly presence: FisheryPresence;
  private rawMessages: ChatMessage[] = [];
  private rawRankings: RankingEntry[] = [];
  private rawPlayers: OnlineState['players'] = [];
  constructor() {
    this.presence = new FisheryPresence(state => {
      const changed = this.state.admitted !== state.admitted;
      Object.assign(this.state, state);
      this.rawPlayers = state.players;
      this.filterBlocked();
      if (changed) this.listen();
      this.emit();
    });
    onAuthStateChanged(auth, user => { void this.changedUser(user); });
  }
  subscribe(fn: (state: OnlineState) => void) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach(fn => fn(this.state)); }
  private filterBlocked() {
    const visible = (entry: { uid: string }) => !Object.hasOwn(this.state.blockedUsers, entry.uid);
    this.state.messages = this.state.admitted ? this.rawMessages.filter(visible) : [];
    this.state.rankings = this.rawRankings.filter(visible);
    this.state.players = this.rawPlayers.filter(visible);
  }
  private async changedUser(user: User | null) {
    const epoch = ++this.epoch;
    this.profileStop?.(); this.roomStop?.(); this.rankingStop?.();
    if (user?.providerData.some(provider => provider.providerId === 'password')) {
      try {
        const token = await user.getIdTokenResult();
        if (epoch !== this.epoch) return;
        if (token.claims.playReview !== true) {
          await signOut(auth);
          this.state.error = '심사용으로 등록된 계정만 사용할 수 있어요'; this.emit(); return;
        }
      } catch {
        if (epoch === this.epoch) { await signOut(auth); this.state.error = '계정 권한을 확인하지 못했어요'; this.emit(); }
        return;
      }
    }
    this.user = user;
    this.rawMessages = []; this.rawRankings = []; this.rawPlayers = [];
    Object.assign(this.state, emptyOnlineState(), { uid: user?.uid ?? null, ready: !user });
    if (user) this.state.blockedUsers = readBlockedUsers(user.uid);
    this.presence.setUser(user?.uid ?? null);
    this.emit();
    if (!user) { this.listen(); return; }
    this.profileStop = onSnapshot(doc(db, 'players', user.uid), snapshot => {
      if (epoch !== this.epoch) return;
      const before = this.state.nickname;
      this.state.nickname = typeof snapshot.data()?.nickname === 'string' ? snapshot.data()!.nickname : '';
      this.state.termsAccepted = snapshot.data()?.termsVersion === COMMUNITY_TERMS_VERSION;
      this.state.ready = true; this.state.error = '';
      this.presence.setNickname(this.state.nickname);
      if (before !== this.state.nickname || !this.roomStop) this.listen();
      this.emit();
      if (this.state.nickname && this.state.termsAccepted && !this.state.admitted && !this.state.admissionError) void this.enterFishery();
    }, error => { if (epoch === this.epoch) { this.state.ready = true; this.state.error = message(error); this.emit(); } });
  }
  async login() {
    if (this.state.busy) return;
    this.state.busy = true; this.state.error = ''; this.emit();
    try {
      const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) { this.state.error = message(error); }
    finally { this.state.busy = false; this.emit(); }
  }
  async logout() { await this.presence.leave(); await signOut(auth); }
  async loginReview(email: string, password: string) {
    if (this.state.busy) return;
    this.state.busy = true; this.state.error = ''; this.emit();
    try {
      if (!email.trim() || !password || email.length > 254 || password.length > 256) throw new Error('이메일과 비밀번호를 입력해 주세요');
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if ((await result.user.getIdTokenResult()).claims.playReview !== true) {
        await signOut(auth); throw new Error('심사용으로 등록된 계정만 사용할 수 있어요');
      }
    } catch (error) { this.state.error = message(error); }
    finally { this.state.busy = false; this.emit(); }
  }
  async enterFishery() {
    if (!this.state.termsAccepted) { this.state.error = '공개 닉네임과 채팅을 사용하려면 이용 규칙에 동의해 주세요'; this.emit(); return; }
    await this.presence.enter(this.state.nickname);
  }
  async acceptTerms() {
    if (!this.user || this.state.busy || !this.state.ready) return;
    this.state.busy = true; this.state.error = ''; this.emit();
    try {
      if (this.state.nickname) await updateDoc(doc(db, 'players', this.user.uid), { termsVersion: COMMUNITY_TERMS_VERSION, termsAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      this.state.termsAccepted = true;
    } catch (error) { this.state.error = message(error); }
    finally { this.state.busy = false; this.emit(); }
    if (this.state.termsAccepted && this.state.nickname) await this.enterFishery();
  }
  blockUser(uid: string, nickname: string) {
    if (!this.user || uid === this.user.uid || !uid) return;
    const next = { ...this.state.blockedUsers, [uid]: nickname };
    try { saveBlockedUsers(this.user.uid, next); }
    catch { this.state.error = '차단 목록을 저장하지 못했습니다. 기기 저장 공간을 확인해 주세요'; this.emit(); return; }
    this.state.blockedUsers = next; this.filterBlocked(); this.emit();
  }
  unblockUser(uid: string) {
    if (!this.user) return;
    const next = { ...this.state.blockedUsers }; delete next[uid];
    try { saveBlockedUsers(this.user.uid, next); }
    catch { this.state.error = '차단 목록을 저장하지 못했습니다'; this.emit(); return; }
    this.state.blockedUsers = next; this.filterBlocked(); this.emit();
  }
  async reportUser(uid: string, nickname: string, messageId: string, reason: string) {
    if (!this.user || this.state.busy || uid === this.user.uid || !reason.trim()) return false;
    this.state.busy = true; this.state.error = ''; this.emit();
    try {
      // 같은 이용자가 같은 게시물을 반복 신고해 문서를 늘릴 수 없도록 결정적인 ID를 사용한다.
      const id = `${this.user.uid}_${uid}_${messageId || 'profile'}`;
      await setDoc(doc(db, 'reports', id), { reporterUid: this.user.uid, targetUid: uid, targetNickname: nickname, map: ACTIVE_FISHERY.id, messageId, reason: reason.trim().slice(0, 500), createdAt: serverTimestamp() });
      return true;
    } catch (error) { this.state.error = message(error); return false; }
    finally { this.state.busy = false; this.emit(); }
  }
  updatePlayerPose(pose: LocalPlayerPose) { this.presence.updatePose(pose); }
  async setNickname(raw: string) {
    if (!this.user || this.state.busy) return;
    if (!this.state.termsAccepted) { this.state.error = '닉네임을 공개하기 전에 이용 규칙에 동의해 주세요'; this.emit(); return; }
    const nickname = raw.trim().normalize('NFC');
    if (!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nickname)) { this.state.error = '닉네임은 한글·영문·숫자·밑줄 2~12자로 입력하세요'; this.emit(); return; }
    const user = this.user, key = nickname.toLowerCase();
    this.state.busy = true; this.state.error = ''; this.emit();
    try {
      await runTransaction(db, async tx => {
        const playerRef = doc(db, 'players', user.uid), handleRef = doc(db, 'nicknames', key);
        const [player, handle] = await Promise.all([tx.get(playerRef), tx.get(handleRef)]);
        if (handle.exists() && handle.data().uid !== user.uid) throw new Error('이미 사용 중인 닉네임이에요');
        const oldKey = player.data()?.nicknameKey as string | undefined;
        if (oldKey && oldKey !== key) tx.delete(doc(db, 'nicknames', oldKey));
        tx.set(handleRef, { uid: user.uid, nickname });
        tx.set(playerRef, { uid: user.uid, nickname, nicknameKey: key, updatedAt: serverTimestamp(),
          termsVersion: COMMUNITY_TERMS_VERSION, ...(player.data()?.termsVersion === COMMUNITY_TERMS_VERSION ? {} : { termsAcceptedAt: serverTimestamp() }),
          ...(player.exists() ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
      });
      this.state.nickname = nickname;
      this.presence.setNickname(nickname);
      // 드물게 일어나는 이름 변경 때만 기존 최대어 문서의 표시 이름을 함께 갱신한다.
      const refs = ['all', ...FISHERIES.map(f => f.id)].flatMap(scope => SPECIES_LIST.map(sp => doc(db, 'leaderboards', scope, 'species', sp.id, 'entries', user.uid)));
      try {
        const records = await Promise.all(refs.map(ref => getDoc(ref)));
        const batch = writeBatch(db);
        let count = 0;
        records.forEach((record, i) => { if (record.exists()) { batch.update(refs[i], { nickname, updatedAt: serverTimestamp() }); count++; } });
        if (count) await batch.commit();
      } catch { this.state.error = '닉네임은 저장됐어요. 기존 랭킹 이름은 다음 조과 등록 때 다시 갱신됩니다'; }
    } catch (error) { this.state.error = message(error); }
    finally { this.state.busy = false; this.emit(); }
  }
  view(tab: OnlineTab | null, species = this.species, scope: 'all' | FisheryId = this.scope) {
    if (tab === this.viewed && species === this.species && scope === this.scope) return;
    this.viewed = tab; this.species = species; this.scope = scope; this.listen();
  }
  private listen() {
    this.rankingStop?.(); this.rankingStop = undefined;
    this.state.loadingRanking = false;
    if (!this.state.admitted) {
      this.roomStop?.(); this.roomStop = undefined;
      this.state.messages = []; this.state.loadingChat = false;
    }
    if (!this.roomStop && this.state.admitted && this.user && this.state.nickname) {
      this.state.loadingChat = true;
      this.roomStop = onSnapshot(query(collection(db, 'rooms', ACTIVE_FISHERY.id, 'messages'), orderBy('createdAt', 'desc'), limit(50)), snapshot => {
        this.rawMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data(), at: atMillis(d.data().createdAt) }) as ChatMessage).reverse();
        this.filterBlocked();
        this.state.loadingChat = false; this.emit();
      }, error => { this.state.loadingChat = false; this.state.error = message(error); this.emit(); });
    }
    if (this.viewed === 'ranking') {
      this.state.loadingRanking = true;
      this.rankingStop = onSnapshot(query(collection(db, 'leaderboards', this.scope, 'species', this.species, 'entries'), orderBy('cm', 'desc'), limit(20)), snapshot => {
        this.rawRankings = snapshot.docs.map(d => ({ uid: d.id, ...d.data(), at: atMillis(d.data().updatedAt) }) as RankingEntry);
        this.filterBlocked();
        this.state.loadingRanking = false; this.emit();
      }, error => { this.state.loadingRanking = false; this.state.error = message(error); this.emit(); });
    }
    this.emit();
  }
  async sendChat(raw: string) {
    const membership = this.presence.membership();
    if (!this.user || !this.state.nickname || this.state.busy || !membership) return false;
    if (!this.state.termsAccepted) return false;
    const text = raw.trim();
    if (!text || text.length > 200) { this.state.error = '채팅은 1~200자로 입력하세요'; this.emit(); return false; }
    if (!navigator.onLine) { this.state.error = '인터넷 연결을 확인해 주세요'; this.emit(); return false; }
    if (Date.now() - this.sentAt < 3000) { this.state.error = '3초 뒤에 다시 보낼 수 있어요'; this.emit(); return false; }
    this.state.busy = true; this.state.error = ''; this.emit();
    try {
      const batch = writeBatch(db);
      const entry = doc(collection(db, 'rooms', ACTIVE_FISHERY.id, 'messages'));
      batch.set(entry, { uid: this.user.uid, nickname: this.state.nickname, text, createdAt: serverTimestamp(), ...membership });
      batch.update(doc(db, 'players', this.user.uid), { lastChatAt: serverTimestamp(), lastMessageId: entry.id, updatedAt: serverTimestamp() });
      await batch.commit(); this.sentAt = Date.now(); return true;
    } catch (error) { this.state.error = message(error); return false; }
    finally { this.state.busy = false; this.emit(); }
  }
  /** 랜딩한 물고기 한 마리를 낚시터 채팅에 기록한다. 일반 채팅의 전송 간격과는 독립적이다. */
  async announceCatch(c: Catch) {
    const user = this.user, nickname = this.state.nickname, membership = this.presence.membership();
    if (!user || !nickname || !membership) return false;
    const catchId = c.id ??= crypto.randomUUID();
    const entry = doc(db, 'rooms', ACTIVE_FISHERY.id, 'messages', `catch_${user.uid}_${catchId}`);
    await runTransaction(db, async tx => {
      const existing = await tx.get(entry);
      if (existing.exists()) return;
      tx.set(entry, {
        kind: 'catch', catchId, uid: user.uid, nickname,
        speciesId: c.species.id, cm: c.cm, kg: c.kg,
        createdAt: serverTimestamp(), ...membership,
      });
    });
    return true;
  }
  async submitCatch(c: Catch) {
    if (!this.user || !this.state.nickname) return;
    const uid = this.user.uid, nickname = this.state.nickname;
    const references = ['all', ACTIVE_FISHERY.id].map(scope => doc(db, 'leaderboards', scope, 'species', c.species.id, 'entries', uid));
    await runTransaction(db, async tx => {
      const old = await Promise.all(references.map(ref => tx.get(ref)));
      references.forEach((ref, i) => {
        if (!old[i].exists() || c.cm > old[i].data()!.cm) tx.set(ref, { uid, nickname, cm: c.cm, kg: c.kg, fisheryId: ACTIVE_FISHERY.id, updatedAt: serverTimestamp() });
        else if (old[i].data()!.nickname !== nickname) tx.update(ref, { nickname, updatedAt: serverTimestamp() });
      });
    });
  }
}

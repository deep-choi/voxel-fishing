import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { PlayerSave, ProfileRepository } from './profile';
import { chooseSave, compactForServer, isSaveData, type StoredSave } from './saveChoice';

// 진행 저장: 기기에 먼저 쓰고(즉시), 서버(saves/{uid})에는 모아서 올린다.
//  · 기기 캐시는 계정별 키라 한 폰에서 계정을 바꿔도 진행이 섞이지 않는다.
//  · 서버를 읽지 못하면 새 진행으로 시작하지 않는다. 시작하면 나중에 서버의 진짜 저장을 덮어쓰게 된다.
//  · 서버 쓰기는 8초 모아서, 앱이 백그라운드로 가거나 닫힐 때는 바로 시도한다.

const LEGACY_KEY = 'fishing-player-v1';
const CLAIM_KEY = 'fishing-player-v1-claimed';
const cacheKey = (uid: string) => `fishing-player-v2:${uid}`;
const DEBOUNCE_MS = 8000;
const RETRY_MS = 30000;
/** Firestore 문서 한도(1MiB)보다 넉넉히 작게 */
const MAX_JSON = 900_000;

const readJson = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const asStored = (value: unknown): StoredSave | null => {
  const v = value as Partial<StoredSave> | null;
  return v && typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) && isSaveData(v.data) ? { savedAt: v.savedAt, data: v.data } : null;
};

export class ProfileSync implements ProfileRepository {
  /** 서버 저장까지 불러온 계정. 이 값이 있어야만 저장한다 */
  private uid: string | null = null;
  private dirty = false;
  private timer = 0;
  private writing: Promise<void> | null = null;

  constructor() {
    addEventListener('pagehide', () => void this.push());
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void this.push(); });
  }

  get opened() { return this.uid !== null; }

  /** 로그인 전에는 진행이 없다 (PlayerProgress는 새 진행으로 시작하고, 로그인 뒤 reload로 채운다) */
  load(): unknown { return null; }

  save(profile: PlayerSave) {
    if (!this.uid) return;
    // 기기 저장이 실패하면(용량 부족) 그대로 던져 PlayerProgress.saveFailed로 알린다
    localStorage.setItem(cacheKey(this.uid), JSON.stringify({ savedAt: Date.now(), data: profile } satisfies StoredSave));
    this.dirty = true;
    this.schedule(DEBOUNCE_MS);
  }

  /** 서버·기기 저장 중 쓸 것을 골라 돌려준다. 서버를 읽지 못했고 이 계정의 기기 캐시도 없으면 던진다 */
  async open(uid: string): Promise<unknown> {
    this.uid = null;
    clearTimeout(this.timer);
    const cache = asStored(readJson(cacheKey(uid)));
    let server: StoredSave | null = null;
    let serverError: unknown = null;
    try {
      const snap = await getDoc(doc(db, 'saves', uid));
      if (snap.exists()) {
        const d = snap.data() as { json?: unknown; savedAt?: unknown };
        if (typeof d.json === 'string' && typeof d.savedAt === 'number') server = asStored({ savedAt: d.savedAt, data: JSON.parse(d.json) });
      }
    } catch (error) { serverError = error; }
    if (serverError && !cache) throw serverError;

    const legacyOwner = localStorage.getItem(CLAIM_KEY);
    const legacy = legacyOwner ? null : readJson(LEGACY_KEY);
    const choice = chooseSave({ cache, server: serverError ? null : server, legacy, legacyClaimed: !!legacyOwner });
    // 계정 구분 없던 시절의 기기 저장은 이 계정이 가져갔다고 표시해 다른 계정이 물려받지 않게 한다
    if (isSaveData(legacy)) localStorage.setItem(CLAIM_KEY, uid);

    if (choice.pick) {
      try { localStorage.setItem(cacheKey(uid), JSON.stringify(choice.pick)); } catch { /* 기기 저장이 안 돼도 서버가 있으면 진행은 이어진다 */ }
    }
    this.uid = uid;
    // 서버를 못 읽고 기기 캐시로 시작한 경우도 올려 둔다 (서버가 비었거나 오래됐으면 이 저장이 최신)
    this.dirty = choice.pushToServer || (!!serverError && !!choice.pick);
    if (this.dirty) this.schedule(0);
    return choice.pick?.data ?? null;
  }

  /** 모아 둔 저장을 서버로 보낸다. 실패하면 다음에 다시 시도한다 */
  push(): Promise<void> {
    clearTimeout(this.timer);
    const uid = this.uid;
    if (!uid || !this.dirty) return this.writing ?? Promise.resolve();
    if (this.writing) return this.writing.then(() => this.push());
    const stored = asStored(readJson(cacheKey(uid)));
    if (!stored) return Promise.resolve();
    this.dirty = false;
    const json = JSON.stringify(compactForServer(stored.data as PlayerSave, MAX_JSON));
    this.writing = setDoc(doc(db, 'saves', uid), { json, savedAt: stored.savedAt, version: 1, updatedAt: serverTimestamp() })
      .catch(() => { this.dirty = true; this.schedule(RETRY_MS); })
      .finally(() => { this.writing = null; });
    return this.writing;
  }

  /** 닫기 전에 남은 저장을 모두 보낸다 */
  async flush() {
    await this.push();
    if (this.dirty) await this.push();
  }

  /** 진행 초기화: 기기 캐시·서버 저장·예전 기기 저장을 모두 지운다. 서버 삭제에 실패하면 던진다 */
  async wipe() {
    clearTimeout(this.timer);
    const uid = this.uid;
    this.dirty = false;
    if (uid) {
      if (this.writing) await this.writing;
      await deleteDoc(doc(db, 'saves', uid));
      try { localStorage.removeItem(cacheKey(uid)); } catch { /* 새로고침 뒤 서버에 없으니 새 진행 */ }
    }
    try { localStorage.removeItem(LEGACY_KEY); localStorage.removeItem('fishing-best'); } catch { /* 지울 수 없어도 새로고침 */ }
    this.uid = null;
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.push(), ms);
  }
}

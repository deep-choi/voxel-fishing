import { collection, doc, limit, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, type DocumentReference, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { ACTIVE_FISHERY, FISHERIES, FISHERY_CAPACITY, canEnterFishery, type FisheryId } from './fisheries';
import type { LocalPlayerPose, RemoteHeldRodState, RemotePlayerState, RemoteRodState } from './onlineState';

// Firestore에는 onDisconnect가 없어 서버 시각으로 찍은 자리 임대를 갱신한다.
// firestore.rules의 임대 만료 시간과 맞춘다. 비정상 종료도 최대 150초 뒤 자리가 열린다.
const LEASE_MS = 150_000;
const HEARTBEAT_MS = 40_000;
type Seat = {
  uid: string; nickname: string; sessionId: string; updatedAt: number;
  x?: number; z?: number; yaw?: number; rodSlots?: RemoteRodState[]; heldRod?: RemoteHeldRodState | null;
};
export interface PresenceState {
  admitted: boolean; entering: boolean; admissionError: string;
  fisheryCounts: Partial<Record<FisheryId, number>>;
  players: RemotePlayerState[];
}

export class FisheryPresence {
  readonly state: PresenceState = { admitted: false, entering: false, admissionError: '', fisheryCounts: {}, players: [] };
  private uid: string | null = null;
  private readonly sessionId = crypto.randomUUID();
  private epoch = 0;
  private operation = 0;
  private seat: DocumentReference | null = null;
  private nickname = '';
  private lastAck = 0;
  private snapshots = new Map<FisheryId, Map<string, Seat>>();
  private stops: Unsubscribe[] = [];
  private clock?: ReturnType<typeof setInterval>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private refreshing = false;
  private pendingPose: LocalPlayerPose | null = null;
  private poseTimer?: ReturnType<typeof setTimeout>;
  private poseWriting = false;
  private lastPoseSignature = '';
  private lastPoseSent = 0;

  constructor(private readonly changed: (state: PresenceState) => void) {
    addEventListener('pagehide', () => { void this.leave(); });
    addEventListener('online', () => { if (this.uid && this.nickname) void this.enter(this.nickname); });
    addEventListener('offline', () => this.revoke('인터넷 연결이 끊겼어요. 연결되면 다시 입장합니다'));
    addEventListener('pageshow', event => { if (event.persisted && this.uid && this.nickname) void this.enter(this.nickname); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void this.refresh(); });
  }

  setUser(uid: string | null) {
    ++this.epoch;
    ++this.operation;
    this.uid = uid; this.nickname = ''; this.seat = null;
    this.stops.forEach(stop => stop()); this.stops = [];
    clearInterval(this.clock); clearInterval(this.heartbeat);
    clearTimeout(this.poseTimer); this.poseTimer = undefined; this.pendingPose = null;
    this.lastPoseSignature = ''; this.lastPoseSent = 0;
    this.snapshots.clear();
    Object.assign(this.state, { admitted: false, entering: false, admissionError: '', fisheryCounts: {}, players: [] });
    this.emit();
    if (!uid) return;
    const epoch = this.epoch;
    for (const fishery of FISHERIES) {
      this.stops.push(onSnapshot(query(collection(db, 'presence', fishery.id, 'slots'), limit(FISHERY_CAPACITY)), snapshot => {
        if (epoch !== this.epoch) return;
        const seats = new Map<string, Seat>();
        for (const entry of snapshot.docs) {
          const data = entry.data({ serverTimestamps: 'estimate' });
          seats.set(entry.id, {
            uid: data.uid, nickname: data.nickname, sessionId: data.sessionId,
            updatedAt: (data.updatedAt as Timestamp | undefined)?.toMillis() ?? 0,
            ...(typeof data.x === 'number' ? { x: data.x } : {}),
            ...(typeof data.z === 'number' ? { z: data.z } : {}),
            ...(typeof data.yaw === 'number' ? { yaw: data.yaw } : {}),
            ...(Array.isArray(data.rodSlots) ? { rodSlots: data.rodSlots as RemoteRodState[] } : {}),
            ...(data.heldRod === null || data.heldRod === undefined || typeof data.heldRod === 'object'
              ? { heldRod: data.heldRod as RemoteHeldRodState | null | undefined } : {}),
          });
        }
        this.snapshots.set(fishery.id, seats);
        if (fishery.id === ACTIVE_FISHERY.id && this.state.admitted && this.seat) {
          const own = seats.get(this.seat.id);
          if (!own || own.uid !== this.uid || own.sessionId !== this.sessionId) this.revoke('다른 창에서 입장했어요. 이 창에서 다시 입장할 수 있습니다');
        }
        this.count();
      }, () => {
        if (epoch !== this.epoch) return;
        delete this.state.fisheryCounts[fishery.id]; this.emit();
      }));
    }
    this.clock = setInterval(() => {
      if (this.state.admitted && Date.now() - this.lastAck >= LEASE_MS) this.revoke('접속 확인 시간이 지났어요. 다시 입장해 주세요');
      this.count();
    }, 5000);
  }

  private emit() { this.changed({ ...this.state, fisheryCounts: { ...this.state.fisheryCounts } }); }
  private count() {
    for (const [map, seats] of this.snapshots) {
      this.state.fisheryCounts[map] = new Set([...seats.values()].filter(seat => seat.updatedAt > Date.now() - LEASE_MS).map(seat => seat.uid)).size;
    }
    const now = Date.now();
    this.state.players = [...(this.snapshots.get(ACTIVE_FISHERY.id)?.values() ?? [])]
      .filter(seat => seat.uid !== this.uid && seat.updatedAt > now - LEASE_MS
        && typeof seat.x === 'number' && typeof seat.z === 'number' && typeof seat.yaw === 'number')
      .map(seat => ({
        uid: seat.uid, nickname: seat.nickname, x: seat.x!, z: seat.z!, yaw: seat.yaw!,
        rodSlots: (seat.rodSlots ?? []).filter((rod): rod is RemoteRodState => !!rod && typeof rod.slotId === 'string' && typeof rod.rodId === 'string').slice(0, 3),
        heldRod: seat.heldRod && typeof seat.heldRod.rodId === 'string' ? seat.heldRod : null,
        updatedAt: seat.updatedAt,
      }));
    this.emit();
  }
  private revoke(reason: string) {
    clearInterval(this.heartbeat);
    clearTimeout(this.poseTimer); this.poseTimer = undefined; this.pendingPose = null; this.lastPoseSignature = '';
    this.state.admitted = false; this.state.admissionError = reason; this.emit();
  }

  async enter(nickname: string) {
    this.nickname = nickname;
    if (!this.uid || !nickname || this.state.admitted || this.state.entering) return;
    if (!canEnterFishery(ACTIVE_FISHERY.id)) { this.revoke('아직 개방하지 않은 낚시터예요'); return; }
    this.lastPoseSignature = ''; this.pendingPose = null;
    this.state.entering = true; this.state.admissionError = ''; this.emit();
    const uid = this.uid, epoch = this.epoch, operation = ++this.operation;
    try {
      if (!navigator.onLine) throw new Error('인터넷 연결을 확인하고 다시 입장해 주세요');
      const refs = Array.from({ length: FISHERY_CAPACITY }, (_, slot) => doc(db, 'presence', ACTIVE_FISHERY.id, 'slots', String(slot)));
      const seat = await runTransaction(db, async tx => {
        const slots = await Promise.all(refs.map(ref => tx.get(ref)));
        if (epoch !== this.epoch || operation !== this.operation) throw new Error('입장이 취소됐어요');
        const own = slots.findIndex(slot => slot.data()?.uid === uid);
        const vacant = slots.findIndex(slot => !slot.exists() || (slot.data()?.updatedAt as Timestamp).toMillis() <= Date.now() - LEASE_MS);
        const index = own >= 0 ? own : vacant;
        if (index < 0) throw new Error(`${ACTIVE_FISHERY.name} 정원이 찼어요 (${FISHERY_CAPACITY}/${FISHERY_CAPACITY}명). 잠시 후 다시 입장해 주세요`);
        tx.set(refs[index], { uid, nickname, sessionId: this.sessionId, updatedAt: serverTimestamp() });
        return refs[index];
      });
      if (epoch !== this.epoch || operation !== this.operation) return;
      this.seat = seat; this.lastAck = Date.now();
      this.state.admitted = true;
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => { void this.refresh(); }, HEARTBEAT_MS);
    } catch (error) {
      if (epoch !== this.epoch || operation !== this.operation) return;
      const code = (error as { code?: string }).code;
      this.state.admissionError = code ? '입장을 확인하지 못했어요. 잠시 후 다시 입장해 주세요' : (error as Error).message;
    } finally {
      if (epoch === this.epoch && operation === this.operation) { this.state.entering = false; this.emit(); }
    }
  }

  private async refresh() {
    if (!this.state.admitted || !this.seat || !this.uid || this.refreshing || !navigator.onLine) return;
    this.refreshing = true;
    const ref = this.seat, uid = this.uid, epoch = this.epoch;
    try {
      await runTransaction(db, async tx => {
        const data = (await tx.get(ref)).data();
        if (epoch !== this.epoch || data?.uid !== uid || data.sessionId !== this.sessionId) throw new Error('접속 자리가 변경됐어요');
        tx.update(ref, { nickname: this.nickname, updatedAt: serverTimestamp() });
      });
      if (epoch === this.epoch && this.state.admitted) this.lastAck = Date.now();
    } catch {
      if (epoch === this.epoch && Date.now() - this.lastAck >= LEASE_MS) this.revoke('접속을 확인하지 못했어요. 다시 입장해 주세요');
    } finally { this.refreshing = false; }
  }

  membership() { return this.state.admitted && this.seat ? { slotId: this.seat.id, sessionId: this.sessionId } : null; }
  setNickname(nickname: string) { this.nickname = nickname; }
  updatePose(pose: LocalPlayerPose) {
    if (!this.state.admitted || !this.seat) return;
    const round = (value: number) => Math.round(value * 10) / 10;
    const clean: LocalPlayerPose = {
      x: round(pose.x), z: round(pose.z), yaw: round(pose.yaw),
      rodSlots: pose.rodSlots.slice(0, 3).map(rod => ({ slotId: rod.slotId, rodId: rod.rodId })),
      heldRod: pose.heldRod ? {
        rodId: pose.heldRod.rodId,
        buttX: round(pose.heldRod.buttX), buttY: round(pose.heldRod.buttY), buttZ: round(pose.heldRod.buttZ),
        dirX: round(pose.heldRod.dirX), dirY: round(pose.heldRod.dirY), dirZ: round(pose.heldRod.dirZ),
      } : null,
    };
    const signature = JSON.stringify(clean);
    if (signature === this.lastPoseSignature) return;
    this.lastPoseSignature = signature;
    this.pendingPose = clean;
    if (this.poseTimer || this.poseWriting) return;
    this.schedulePoseWrite();
  }

  private schedulePoseWrite() {
    if (!this.pendingPose || !this.state.admitted || !this.seat) return;
    const delay = Math.max(0, 500 - (Date.now() - this.lastPoseSent));
    this.poseTimer = setTimeout(() => { this.poseTimer = undefined; void this.flushPose(); }, delay);
  }

  private async flushPose() {
    const ref = this.seat, uid = this.uid, epoch = this.epoch, pose = this.pendingPose;
    if (!pose || !ref || !uid || !this.state.admitted || this.poseWriting) return;
    this.pendingPose = null;
    this.poseWriting = true;
    this.lastPoseSent = Date.now();
    try {
      await updateDoc(ref, { ...pose, updatedAt: serverTimestamp() });
      if (epoch === this.epoch && this.state.admitted) this.lastAck = Date.now();
    } catch { /* 자리 임대 갱신이 계속 실패하면 heartbeat에서 입장을 회수한다. */ }
    finally {
      this.poseWriting = false;
      if (this.pendingPose) this.schedulePoseWrite();
    }
  }

  async leave() {
    ++this.operation;
    const ref = this.seat, uid = this.uid;
    this.seat = null; clearInterval(this.heartbeat);
    clearTimeout(this.poseTimer); this.poseTimer = undefined; this.pendingPose = null; this.lastPoseSignature = '';
    this.state.admitted = false; this.state.entering = false; this.emit();
    if (!ref || !uid || !navigator.onLine) return;
    try {
      await runTransaction(db, async tx => {
        const data = (await tx.get(ref)).data();
        if (data?.uid === uid && data.sessionId === this.sessionId) tx.delete(ref);
      });
    } catch { /* 비정상 종료와 동일하게 서버 임대 만료로 자리를 비운다. */ }
  }
}

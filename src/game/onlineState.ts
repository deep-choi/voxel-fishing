import type { FisheryId } from './fisheries';
import type { SpeciesId } from './data';
export type OnlineTab = 'account' | 'chat' | 'ranking';
export type ChatMessage = { id: string; uid: string; nickname: string; at: number } & (
  | { kind?: 'chat'; text: string }
  | { kind: 'catch'; catchId: string; speciesId: SpeciesId; cm: number; kg: number }
);
export interface RankingEntry { uid: string; nickname: string; cm: number; kg: number; fisheryId: FisheryId; at: number }
export interface RemoteRodState { slotId: string; rodId: string }
export interface RemoteHeldRodState {
  rodId: string;
  buttX: number; buttY: number; buttZ: number;
  dirX: number; dirY: number; dirZ: number;
}
export interface RemotePlayerState {
  uid: string; nickname: string; x: number; z: number; yaw: number;
  rodSlots: RemoteRodState[]; heldRod: RemoteHeldRodState | null; updatedAt: number;
}
export interface LocalPlayerPose {
  x: number; z: number; yaw: number;
  rodSlots: RemoteRodState[]; heldRod: RemoteHeldRodState | null;
}
/** 로그인한 계정의 진행 저장을 불러오고 닫는 쪽 (main.ts가 PlayerProgress와 연결한다) */
export interface SaveGate { open(uid: string): Promise<void>; close(): Promise<void> }
export interface OnlineState {
  /** 이 계정의 진행 저장을 불러왔는지. 불러오기 전에는 입장하지 않는다 */
  saveReady: boolean; saveError: string;
  termsAccepted: boolean; blockedUsers: Record<string, string>;
  uid: string | null; nickname: string; ready: boolean; busy: boolean; error: string;
  messages: ChatMessage[]; rankings: RankingEntry[]; loadingChat: boolean; loadingRanking: boolean;
  admitted: boolean; entering: boolean; admissionError: string;
  fisheryCounts: Partial<Record<FisheryId, number>>;
  players: RemotePlayerState[];
}
export const emptyOnlineState = (): OnlineState => ({ saveReady: false, saveError: '', termsAccepted: false, blockedUsers: {}, uid: null, nickname: '', ready: false, busy: false, error: '', messages: [], rankings: [], loadingChat: false, loadingRanking: false, admitted: false, entering: false, admissionError: '', fisheryCounts: {}, players: [] });

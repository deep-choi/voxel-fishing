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
export interface OnlineState {
  uid: string | null; nickname: string; ready: boolean; busy: boolean; error: string;
  messages: ChatMessage[]; rankings: RankingEntry[]; loadingChat: boolean; loadingRanking: boolean;
  admitted: boolean; entering: boolean; admissionError: string;
  fisheryCounts: Partial<Record<FisheryId, number>>;
  players: RemotePlayerState[];
}
export const emptyOnlineState = (): OnlineState => ({ uid: null, nickname: '', ready: false, busy: false, error: '', messages: [], rankings: [], loadingChat: false, loadingRanking: false, admitted: false, entering: false, admissionError: '', fisheryCounts: {}, players: [] });

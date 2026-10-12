import type { FisheryId } from './fisheries';
export type OnlineTab = 'account' | 'chat' | 'ranking';
export interface ChatMessage { id: string; uid: string; nickname: string; text: string; at: number }
export interface RankingEntry { uid: string; nickname: string; cm: number; kg: number; fisheryId: FisheryId; at: number }
export interface OnlineState {
  uid: string | null; nickname: string; ready: boolean; busy: boolean; error: string;
  messages: ChatMessage[]; rankings: RankingEntry[]; loadingChat: boolean; loadingRanking: boolean;
  admitted: boolean; entering: boolean; admissionError: string;
  fisheryCounts: Partial<Record<FisheryId, number>>;
}
export const emptyOnlineState = (): OnlineState => ({ uid: null, nickname: '', ready: false, busy: false, error: '', messages: [], rankings: [], loadingChat: false, loadingRanking: false, admitted: false, entering: false, admissionError: '', fisheryCounts: {} });

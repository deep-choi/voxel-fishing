// 기기별 설정: 서버로 올리지 않고 이 브라우저에만 남긴다.

export interface Settings {
  /** 마우스·터치 시점 감도 배수 */
  sensitivity: number;
  volume: number;
  touch: 'auto' | 'on' | 'off';
  /** 입질 알림 진동 (모바일) */
  vibrate: boolean;
}
const KEY = 'fishing-settings-v1';
const DEFAULTS: Settings = { sensitivity: 1, volume: 0.8, touch: 'auto', vibrate: true };

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      sensitivity: typeof raw.sensitivity === 'number' ? Math.min(3, Math.max(0.2, raw.sensitivity)) : DEFAULTS.sensitivity,
      volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : DEFAULTS.volume,
      touch: raw.touch === 'on' || raw.touch === 'off' ? raw.touch : 'auto',
      vibrate: raw.vibrate !== false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 못 해도 이번 세션엔 적용된다 */ }
}
/** 터치 조작을 보여 줄지: 자동이면 손가락 입력 기기에서만 */
export const touchEnabled = (s: Settings) => s.touch === 'on' || (s.touch === 'auto' && matchMedia('(pointer: coarse)').matches);

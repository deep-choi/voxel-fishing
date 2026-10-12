import type { Species } from './data';
import { SPECIES_RULES } from './items';
import { ACTIVE_FISHERY } from './fisheries';

// 게임 속 시간과 날씨. 러시안피싱4처럼 시간대·날씨·기압이 어종별 입질에 영향을 준다.
// 실제 1초 = 게임 0.5분 → 게임 하루 = 실제 48분.

export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog';
export const WEATHER: Record<Weather, { name: string; bite: number; air: number }> = {
  clear: { name: '맑음', bite: 1, air: 2 },
  cloudy: { name: '흐림', bite: 1.15, air: 0 },
  rain: { name: '비', bite: 1.25, air: -3 },
  fog: { name: '안개', bite: 1.1, air: -1 },
};
const MIN_PER_SEC = 0.5;
const START_MIN = ACTIVE_FISHERY.startMinutes;

/** 날짜·구간으로 정해지는 난수 (같은 시간대엔 같은 날씨) */
export function seeded(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class Environment {
  /** 게임 시작 후 흐른 게임 분 */
  minutes = START_MIN;
  update(dt: number) { this.minutes += dt * MIN_PER_SEC; }
  get day() { return Math.floor(this.minutes / 1440) + 1; }
  get hour() { return (this.minutes / 60) % 24; }
  get clock() {
    const m = Math.floor(this.minutes) % 1440;
    const h = Math.floor(m / 60);
    return `${h < 12 ? '오전' : '오후'} ${String(h % 12 || 12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  get period() {
    const h = this.hour;
    return h < 4 ? '밤' : h < 7 ? '새벽' : h < 11 ? '오전' : h < 15 ? '한낮' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
  }
  /** 3시간마다 날씨가 바뀐다 */
  get weather(): Weather {
    const r = seeded(Math.floor(this.minutes / 180) + ACTIVE_FISHERY.weatherSeed);
    return r < 0.45 ? 'clear' : r < 0.72 ? 'cloudy' : r < 0.88 ? 'rain' : 'fog';
  }
  /** 0 = 깊은 밤, 1 = 한낮 */
  get daylight() {
    const sun = Math.sin(((this.hour - 6) / 12) * Math.PI);
    return Math.max(0, Math.min(1, sun * 1.6 + 0.15)) * (this.weather === 'rain' ? 0.75 : this.weather === 'cloudy' ? 0.88 : 1);
  }
  get night() { return this.daylight < 0.2; }
  get airTemp() { return ACTIVE_FISHERY.temperature - 1 + 7 * Math.sin(((this.hour - 9) / 24) * Math.PI * 2) + WEATHER[this.weather].air; }
  /** 수온은 기온을 천천히 따라간다 */
  get waterTemp() { return ACTIVE_FISHERY.temperature + 2.5 * Math.sin(((this.hour - 13) / 24) * Math.PI * 2); }
  pressureAt(min: number) { return 1013 + 9 * Math.sin(min / 900) + 4 * Math.sin(min / 260 + 1.3); }
  get pressure() { return this.pressureAt(this.minutes); }
  /** 기압 추세: 오르면 입질이 약해지고 내리면 활발해진다 */
  get pressureTrend() { return this.pressureAt(this.minutes) - this.pressureAt(this.minutes - 60); }

  /** 어종별 입질 배수 */
  biteMul(sp: Species) {
    const h = this.hour;
    const twilight = (h >= 4.5 && h < 8) || (h >= 17.5 && h < 20.5);
    const active = SPECIES_RULES[sp.id].active;
    const time = active === 'night' ? (this.night ? 1.9 : twilight ? 1.2 : 0.55)
      : active === 'day' ? (this.night ? 0.3 : twilight ? 0.9 : 1.3)
      : active === 'twilight' ? (twilight ? 1.7 : this.night ? 0.7 : 0.95)
      : 1;
    const trend = this.pressureTrend;
    const pressure = trend > 0.6 ? 0.85 : trend < -0.6 ? 1.15 : 1;
    const ideal = sp.id === 'snakehead' || sp.id === 'bass' ? 24 : sp.id === 'mandarin' ? 19 : sp.id === 'catfish' ? 23 : sp.id === 'mirror' ? 22 : 20;
    const temperature = Math.max(0.35, 1 - Math.abs(this.waterTemp - ideal) * 0.055);
    const weather = sp.id === 'catfish' && this.weather === 'rain' ? 1.45 : WEATHER[this.weather].bite;
    return time * weather * pressure * temperature;
  }
}

// 소리: 파일 없이 Web Audio로 합성한다.
// 배경: 잔잔한 바람·물가 찰랑임 + 낮에는 새, 해 질 녘부터 귀뚜라미·개구리, 비 오면 빗소리.
// 효과: 캐스팅·찌 착수. 입질은 소리 없이 찌로만 본다. (챔질·원줄 울음 소리는 나중에 녹음 소리로 넣는다)

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private birdT = 3;
  private loadGain: GainNode | null = null;
  private loadFilter: BiquadFilterNode | null = null;
  private lineGain: GainNode | null = null;
  private lineTone: OscillatorNode | null = null;
  private lastLoad = 0;
  private sliceGain: GainNode | null = null;
  private creakT = 0;
  private volume = 0.8;
  /** 0 낮 ~ 1 밤 */
  private dark = 0;
  private raining = false;
  private rainGain: GainNode | null = null;
  private cricketT = 1;
  private frogT = 4;

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  private waitingGesture = false;
  /** 소리를 낼 수 있는 상태인지 (브라우저가 막고 있으면 아무것도 만들지 않는다) */
  private get live() { return this.ctx?.state === 'running'; }

  /**
   * 소리 켜기. 브라우저는 사용자가 화면을 누르거나 키를 치기 전에는 소리를 막는다(자동재생 정책).
   * 로그인 복원으로 자동 입장할 때처럼 아직 입력이 없으면, 첫 입력 때 켜지도록 기다린다.
   * (입력 전에 AudioContext를 만들면 콘솔에 경고가 쌓인다)
   */
  start() {
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    if (!activated) { this.startOnGesture(); return; }
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    // 핑크 노이즈 근사
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029;
      b1 = 0.985 * b1 + w * 0.032;
      b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 2.2;
    }

    // 바람: 낮게 깔린 노이즈, 천천히 세졌다 약해진다
    const wind = this.loop(0.0);
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 260;
    const wg = ctx.createGain();
    wg.gain.value = 0.03;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.018;
    lfo.connect(lfoG).connect(wg.gain);
    lfo.start();
    wind.connect(wf).connect(wg).connect(this.master);

    // 물가 찰랑임
    const lap = this.loop(0.7);
    const lf = ctx.createBiquadFilter();
    lf.type = 'bandpass';
    lf.frequency.value = 900;
    lf.Q.value = 0.8;
    const lg = ctx.createGain();
    lg.gain.value = 0.025;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.35;
    const lfo2G = ctx.createGain();
    lfo2G.gain.value = 0.02;
    lfo2.connect(lfo2G).connect(lg.gain);
    lfo2.start();
    lap.connect(lf).connect(lg).connect(this.master);

    // 빗소리: 비 올 때만 들리는 쏴아
    const rain = this.loop(1.6);
    const rf = ctx.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 1400;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rf).connect(this.rainGain).connect(this.master);

    // 릴 소리 대신, 민장대와 원줄의 하중을 낮은 긴장음으로 전달한다.
    this.loadFilter = ctx.createBiquadFilter();
    this.loadFilter.type = 'bandpass'; this.loadFilter.frequency.value = 420; this.loadFilter.Q.value = 2;
    this.loadGain = ctx.createGain(); this.loadGain.gain.value = 0;
    this.loop(0.3).connect(this.loadFilter).connect(this.loadGain).connect(this.master);
    this.lineTone = ctx.createOscillator(); this.lineTone.type = 'triangle'; this.lineTone.frequency.value = 95;
    this.lineGain = ctx.createGain(); this.lineGain.gain.value = 0;
    this.lineTone.connect(this.lineGain).connect(this.master); this.lineTone.start();
    // 고기가 옆으로 달리며 줄이 물을 가르는 "쉬익"
    const sf = ctx.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 2600;
    this.sliceGain = ctx.createGain(); this.sliceGain.gain.value = 0;
    this.loop(1.1).connect(sf).connect(this.sliceGain).connect(this.master);
  }

  /** 첫 클릭·터치·키 입력 때 한 번 소리를 켠다 */
  private startOnGesture() {
    if (this.waitingGesture) return;
    this.waitingGesture = true;
    const go = () => {
      for (const type of ['pointerdown', 'keydown', 'touchend'] as const) removeEventListener(type, go, true);
      this.waitingGesture = false;
      this.start();
    };
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) addEventListener(type, go, true);
  }

  private loop(offset: number): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, offset);
    return src;
  }

  private burst(dur: number, filter: BiquadFilterType, freq: number, gain: number, sweepTo?: number, q = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.live) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  cast(power: number) {
    this.burst(0.35, 'bandpass', 2400, 0.12 + power * 0.15, 900, 0.7);
  }

  splash(size: number, dist: number) {
    const v = Math.min(1, 6 / Math.max(6, dist));
    this.burst(0.25 + size * 0.35, 'lowpass', 1800 + size * 1200, (0.08 + size * 0.25) * v, 300);
    if (size > 0.5) this.burst(0.15, 'bandpass', 3500, 0.05 * v);
  }


  /** 시간·날씨: 낮엔 새, 어두워지면 귀뚜라미·개구리, 비 오면 빗소리 */
  setAmbience(dark: number, raining: boolean) {
    this.dark = dark;
    this.raining = raining;
  }

  snap() {
    this.burst(0.06, 'highpass', 4000, 0.4);
  }

  /** 매 프레임 */
  update(dt: number, load = 0, shake = 0, slice = 0) {
    // 막혀 있거나(입력 전) 멈춘 동안에는 새 소리를 만들지 않는다
    if (!this.ctx || !this.live) return;
    const t = this.ctx.currentTime;
    const stress = Math.max(0, Math.min(1, load));
    this.loadGain?.gain.setTargetAtTime(stress ** 1.4 * (0.05 + shake * 0.02), t, 0.05);
    this.loadFilter?.frequency.setTargetAtTime(320 + stress * 800, t, 0.07);
    this.lineGain?.gain.setTargetAtTime(stress ** 2 * 0.016, t, 0.06);
    this.lineTone?.frequency.setTargetAtTime(85 + stress * 100, t, 0.06);
    this.sliceGain?.gain.setTargetAtTime(Math.min(1, slice) * 0.05, t, 0.08);
    this.creakT -= dt;
    if (stress > 0.2 && this.creakT <= 0 && (stress - this.lastLoad > 0.018 || shake > 0.6)) {
      this.burst(0.12, 'bandpass', 280 + stress * 580, 0.04 + stress * 0.09, 220, 3);
      this.creakT = 0.18 + (1 - stress) * 0.25;
    }
    this.lastLoad = stress;
    this.rainGain?.gain.setTargetAtTime(this.raining ? 0.045 : 0, t, 1.5);
    // 낮: 가끔 멀리서 새가 운다
    this.birdT -= dt;
    if (this.birdT <= 0) {
      if (this.dark < 0.5 && !this.raining) this.bird();
      this.birdT = 3 + Math.random() * 9;
    }
    // 해 질 녘부터: 풀숲의 귀뚜라미가 여기저기서 운다
    this.cricketT -= dt;
    if (this.cricketT <= 0) {
      if (this.dark > 0.25) this.cricket();
      this.cricketT = (0.35 + Math.random() * 0.9) / Math.max(0.3, this.dark);
    }
    // 밤: 이따금 개구리
    this.frogT -= dt;
    if (this.frogT <= 0) {
      if (this.dark > 0.5 && !this.raining) this.frog();
      this.frogT = 4 + Math.random() * 10;
    }
  }

  /** 귀뚜라미: 4~5kHz 짧은 떨림 3~4번이 한 마디 */
  private cricket() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.8 - 0.9;
    pan.connect(this.master);
    const f = 4200 + Math.random() * 900;
    const level = 0.006 + Math.random() * 0.01;
    const pulses = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pulses; i++) {
      const t = t0 + i * 0.045;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.035);
    }
  }

  /** 개구리: 낮고 거친 "개굴" 두세 번 */
  private frog() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.master);
    const base = 180 + Math.random() * 90;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.22 + Math.random() * 0.08);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.09);
      const am = ctx.createOscillator();
      am.frequency.value = 38;
      const amG = ctx.createGain();
      amG.gain.value = 0.012;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      am.connect(amG).connect(g.gain);
      o.connect(bp).connect(g).connect(pan);
      o.start(t); am.start(t);
      o.stop(t + 0.16); am.stop(t + 0.16);
    }
  }

  private bird() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1600;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.master);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.12 + Math.random() * 0.1);
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = base * (0.9 + Math.random() * 0.3);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.025, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.12);
    }
  }
}

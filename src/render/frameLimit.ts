/** 모니터 주사율과 무관하게 최대 60회만 게임과 화면을 갱신한다. */
export class FrameLimit {
  private next = 0;
  private readonly interval = 1000 / 60;

  reset() { this.next = 0; }

  ready(now: number) {
    if (now + 0.01 < this.next) return false;
    // 프레임이 늦어졌어도 밀린 화면을 연달아 그리지 않는다.
    if (this.next === 0 || now - this.next >= this.interval) this.next = now + this.interval;
    else this.next += this.interval;
    return true;
  }
}

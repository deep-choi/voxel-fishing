// 모바일 터치 조작: 왼쪽 가상 조이스틱(걷기), 오른쪽 화면 끌기(둘러보기), 오른쪽 아래 버튼(던지기·챔질·대 세우기/숙이기).
// 마우스와 같은 입력 플래그를 건드리므로 낚시 규칙은 그대로 쓴다.

export type HoldKey = 'primary' | 'lift';
export type TapAction = 'hookset' | 'interact' | 'retrieve' | 'feed' | 'zoom' | 'stow';
export interface TouchApi {
  move(x: number, y: number): void;
  look(dx: number, dy: number): void;
  hold(key: HoldKey, down: boolean): void;
  tap(action: TapAction): void;
}

const BUTTONS: { id: string; label: string; hold?: HoldKey; tap?: TapAction; cls: string }[] = [
  { id: 'primary', label: '던지기\n세우기', hold: 'primary', cls: 'big' },
  { id: 'lift', label: '숙이기', hold: 'lift', cls: 'mid a' },
  { id: 'hookset', label: '챔질', tap: 'hookset', cls: 'mid b' },
  { id: 'interact', label: 'E 들기', tap: 'interact', cls: 'sm c1' },
  { id: 'retrieve', label: 'R 걷기', tap: 'retrieve', cls: 'sm c2' },
  { id: 'feed', label: 'G 집어', tap: 'feed', cls: 'sm c3' },
  { id: 'zoom', label: 'Z 망원', tap: 'zoom', cls: 'sm c4' },
  { id: 'stow', label: 'F 회수', tap: 'stow', cls: 'sm c5' },
];

export class TouchControls {
  readonly root = document.createElement('div');
  private stickId: number | null = null;
  private lookId: number | null = null;
  private readonly origin = { x: 0, y: 0 };
  private readonly lastLook = { x: 0, y: 0 };
  private readonly knob: HTMLElement;
  private readonly base: HTMLElement;

  constructor(parent: HTMLElement, private readonly api: TouchApi) {
    this.root.className = 'touch';
    this.root.innerHTML = `<div class="touch-look"></div><div class="stick"><i></i></div>
      <div class="touch-buttons">${BUTTONS.map(b => `<button class="tbtn ${b.cls}" data-touch="${b.id}">${b.label.replace('\n', '<br>')}</button>`).join('')}</div>`;
    // HUD의 다른 버튼·패널이 위에 오도록 맨 앞에 둔다
    parent.prepend(this.root);
    this.base = this.root.querySelector('.stick')!;
    this.knob = this.base.querySelector('i')!;
    const look = this.root.querySelector<HTMLElement>('.touch-look')!;

    // 화면 왼쪽 아래 어디서든 손가락을 대면 그 자리에 조이스틱이 생긴다
    look.addEventListener('pointerdown', e => {
      if (e.clientX < innerWidth * 0.4 && e.clientY > innerHeight * 0.35 && this.stickId === null) {
        this.stickId = e.pointerId;
        this.origin.x = e.clientX; this.origin.y = e.clientY;
        this.base.style.left = `${e.clientX}px`; this.base.style.top = `${e.clientY}px`;
        this.base.classList.add('on');
      } else if (this.lookId === null) {
        this.lookId = e.pointerId;
        this.lastLook.x = e.clientX; this.lastLook.y = e.clientY;
      }
      look.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    look.addEventListener('pointermove', e => {
      if (e.pointerId === this.stickId) {
        const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
        const len = Math.min(48, Math.hypot(dx, dy)) / (Math.hypot(dx, dy) || 1);
        this.knob.style.transform = `translate(${dx * len}px, ${dy * len}px)`;
        this.api.move((dx * len) / 48, (-dy * len) / 48);
      } else if (e.pointerId === this.lookId) {
        this.api.look(e.clientX - this.lastLook.x, e.clientY - this.lastLook.y);
        this.lastLook.x = e.clientX; this.lastLook.y = e.clientY;
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = null;
        this.knob.style.transform = '';
        this.base.classList.remove('on');
        this.api.move(0, 0);
      }
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    look.addEventListener('pointerup', end);
    look.addEventListener('pointercancel', end);

    for (const btn of this.root.querySelectorAll<HTMLElement>('[data-touch]')) {
      const def = BUTTONS.find(b => b.id === btn.dataset.touch)!;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        btn.classList.add('down');
        if (def.hold) this.api.hold(def.hold, true);
        if (def.tap) this.api.tap(def.tap);
      });
      const up = () => { btn.classList.remove('down'); if (def.hold) this.api.hold(def.hold, false); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
  }

  set visible(on: boolean) { this.root.hidden = !on; }
}

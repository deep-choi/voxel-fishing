// 모바일 터치 조작: 왼쪽 아래 어디든 엄지를 대면 조이스틱(걷기), 나머지 화면 끌기(둘러보기),
// 오른쪽 아래 상황 버튼. 몰입형 HUD에 맞춰 지금 할 수 있는 동작만 보인다.
//   큰 버튼: 던지기(눌렀다 놓기) → 챔질(누른 채 버티면 그대로 세우기) → 세우기 처럼 상황마다 바뀐다
//   보조 버튼: 걸었을 때 숙이기, 기다릴 때 채비 걷기
//   작은 버튼: 거치 · 회수 · 확대처럼 그때 쓸 수 있는 것만
// 마우스와 같은 입력 플래그를 건드리므로 낚시 규칙은 그대로 쓴다.
// 입질·걸림을 알려 주는 버튼은 두지 않는다. 입질은 찌를 보고 직접 알아채는 게임이다.

export type HoldKey = 'primary' | 'lift';
export type TapAction = 'interact' | 'retrieve' | 'zoom' | 'stow' | 'take';
export type TouchAct = 'cast' | 'hookset' | 'raise' | 'lower' | 'interact' | 'park' | 'retrieve' | 'zoom' | 'stow' | 'take';
export interface TouchApi {
  move(x: number, y: number): void;
  look(dx: number, dy: number): void;
  hold(key: HoldKey, down: boolean): void;
  tap(action: TapAction, n?: number): void;
}
/** 지금 보여 줄 버튼 */
/** 펼쳐 둔 낚싯대 한 대를 고르는 버튼 (n번) */
export interface TouchRod { n: number; /** 찌가 물에 있어 눌러 챔질할 수 있다 */ strike?: boolean }
export interface TouchLayout {
  main: TouchAct | null;
  alt: TouchAct | null;
  chips: TouchAct[];
  /** 큰 버튼을 잠깐 쉬게 (찌가 날아가는 중) */
  dim?: boolean;
  /** interact 버튼 이름 (들기 · 꺼내기 · 낚시점 …) */
  label?: string;
  zoomOn?: boolean;
  /** 펼쳐 둔 대 버튼. 'pick'은 대를 들지 않았을 때 큰 버튼으로, 'swap'은 다른 대를 들고 있을 때 작은 버튼으로 */
  rods?: TouchRod[];
  rodMode?: 'pick' | 'swap';
}
export const NO_TOUCH: TouchLayout = { main: null, alt: null, chips: [] };

const ACTS: Record<TouchAct, { label: string; sub?: string; hold?: HoldKey; tap?: TapAction }> = {
  cast: { label: '던지기', sub: '눌렀다 놓기', hold: 'primary' },
  hookset: { label: '챔질', sub: '누른 채 버티기', hold: 'primary' },
  raise: { label: '세우기', sub: '누르고 버티기', hold: 'primary' },
  lower: { label: '숙이기', hold: 'lift' },
  interact: { label: '들기', tap: 'interact' },
  park: { label: '거치', tap: 'interact' },
  retrieve: { label: '걷기', tap: 'retrieve' },
  zoom: { label: '확대', tap: 'zoom' },
  stow: { label: '회수', tap: 'stow' },
  take: { label: '들기', tap: 'take' },
};
const CHIPS = 3;
const RODS = 3;

let fullscreenDone = false;
/** 전체 화면 (안드로이드 크롬). 전체 화면이 되면 가로로 잠근다 (앱·웹 모두. 앱 설정이 안 먹는 브라우저 대비).
 *  사용자 터치 안에서만 열리므로 실패하면 다음 터치에 다시 시도 */
export function enterFullscreen() {
  const el = document.documentElement;
  // PC에서 창만 줄인 경우엔 전체 화면으로 바꾸지 않는다
  if (!matchMedia('(pointer: coarse)').matches) return;
  if (fullscreenDone || document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
    fullscreenDone = true;
    (screen.orientation as ScreenOrientation & { lock?(o: string): Promise<void> }).lock?.('landscape').catch(() => {});
  }).catch(() => {});
}

export class TouchControls {
  readonly root = document.createElement('div');
  private stickId: number | null = null;
  private lookId: number | null = null;
  private readonly origin = { x: 0, y: 0 };
  private readonly lastLook = { x: 0, y: 0 };
  private readonly knob: HTMLElement;
  private readonly base: HTMLElement;
  private readonly main: HTMLButtonElement;
  private readonly alt: HTMLButtonElement;
  private readonly chips: HTMLButtonElement[];
  private readonly rodBox: HTMLElement;
  private readonly rodBtns: HTMLButtonElement[];
  /** 누르고 있는 버튼 → 잡고 있는 입력 (버튼 이름이 바뀌어도 놓을 때 같은 입력을 푼다) */
  private readonly held = new Map<HTMLElement, HoldKey>();
  private layoutKey = '';

  constructor(parent: HTMLElement, private readonly api: TouchApi) {
    this.root.className = 'touch';
    this.root.innerHTML = `<div class="touch-look"></div><div class="stick"><i></i></div>
      <div class="touch-buttons"><div class="tchips">${'<button class="tbtn chip" hidden></button>'.repeat(CHIPS)}</div>
      <button class="tbtn alt" hidden></button><button class="tbtn main" hidden></button>
      <div class="trods">${'<button class="tbtn rodbtn gap" data-act="take"></button>'.repeat(RODS)}</div></div>`;
    // HUD의 다른 버튼·패널이 위에 오도록 맨 앞에 둔다
    parent.prepend(this.root);
    this.base = this.root.querySelector('.stick')!;
    this.knob = this.base.querySelector('i')!;
    this.main = this.root.querySelector('.tbtn.main')!;
    this.alt = this.root.querySelector('.tbtn.alt')!;
    this.chips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.tbtn.chip'));
    this.rodBox = this.root.querySelector('.trods')!;
    this.rodBtns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.tbtn.rodbtn'));
    const look = this.root.querySelector<HTMLElement>('.touch-look')!;
    // 길게 눌러도 복사·저장 메뉴가 뜨지 않게
    this.root.addEventListener('contextmenu', e => e.preventDefault());

    // 화면 왼쪽 아래 어디서든 손가락을 대면 그 자리에 조이스틱이 생긴다
    look.addEventListener('pointerdown', e => {
      enterFullscreen();
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
        this.base.style.left = this.base.style.top = '';
        this.api.move(0, 0);
      }
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    look.addEventListener('pointerup', end);
    look.addEventListener('pointercancel', end);

    for (const btn of [this.main, this.alt, ...this.chips, ...this.rodBtns]) {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        const def = ACTS[btn.dataset.act as TouchAct];
        if (!def || btn.hidden || btn.classList.contains('dim')) return;
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('down');
        if (def.hold) { this.held.set(btn, def.hold); this.api.hold(def.hold, true); }
        if (def.tap) this.api.tap(def.tap, Number(btn.dataset.n) || undefined);
        navigator.vibrate?.(8);
      });
      const up = () => {
        btn.classList.remove('down');
        const key = this.held.get(btn);
        if (key) { this.held.delete(btn); this.api.hold(key, false); }
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    }
  }

  /** 상황이 바뀔 때만 버튼을 고친다. 누르고 있는 버튼은 그대로 두어 손을 떼면 풀린다 */
  setLayout(l: TouchLayout) {
    const key = JSON.stringify(l);
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const paint = (btn: HTMLButtonElement, act: TouchAct | null | undefined) => {
      btn.hidden = !act;
      if (!act) { btn.removeAttribute('data-act'); return; }
      const def = ACTS[act];
      btn.dataset.act = act;
      const label = act === 'interact' && l.label ? l.label : def.label;
      btn.innerHTML = `<b>${label}</b>${def.sub && btn === this.main ? `<small>${def.sub}</small>` : ''}`;
      btn.classList.toggle('on', act === 'zoom' && !!l.zoomOn);
    };
    paint(this.main, l.main);
    this.main.classList.toggle('dim', !!l.dim);
    paint(this.alt, l.alt);
    this.chips.forEach((c, i) => paint(c, l.chips[i]));
    const rods = l.rods ?? [], pick = l.rodMode === 'pick';
    this.rodBox.classList.toggle('pick', pick);
    this.rodBox.classList.toggle('swap', !pick);
    this.rodBox.classList.toggle('after-main', !!l.main);
    this.rodBox.classList.toggle('after-alt', !!l.alt);
    this.rodBtns.forEach((b, i) => {
      // 버튼 자리는 번호에 고정: 1번은 왼쪽, 3번은 오른쪽. 없는 번호는 빈 자리로 둔다
      const r = rods.find(x => x.n === i + 1);
      b.classList.toggle('gap', !r);
      if (!r) { delete b.dataset.n; b.innerHTML = ''; return; }
      b.dataset.n = String(r.n);
      b.innerHTML = `<b>${r.n}번</b>${pick ? `<small>${r.strike ? '챔질' : '들기'}</small>` : ''}`;
    });
  }

  /** 누르고 있던 입력을 모두 푼다 (메뉴가 열리거나 조작을 숨길 때) */
  releaseAll() {
    for (const [btn, key] of this.held) { btn.classList.remove('down'); this.api.hold(key, false); }
    this.held.clear();
    if (this.stickId !== null) { this.stickId = null; this.knob.style.transform = ''; this.base.classList.remove('on'); this.api.move(0, 0); }
    this.lookId = null;
  }

  set visible(on: boolean) {
    if (!on) this.releaseAll();
    this.root.hidden = !on;
  }
}

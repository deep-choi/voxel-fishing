import { FLOATS, HOOKS, LINES, RODS, type FloatSpec, type HookSpec, type LineSpec } from '../game/data';
import { getHookTraits } from '../game/hookTraits';
import { artSize, cellAt, cellColor, type FishLook } from '../game/fishArt';

// 아이템 도트 아이콘. 32×32 칸에 글자 그림·원·관(굵은 선)으로 그리고 둘레에 1칸 어두운 테두리를 자동으로 두른다.
// 빛은 왼쪽 위에서 온다: 왼쪽 위 가장자리는 밝게, 오른쪽 아래는 어둡게.

const N = 32;
const SQ2 = Math.SQRT2;
const svg = (body: string, box = `0 0 ${N} ${N}`) => `<svg viewBox="${box}" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${body}</svg>`;
const rect = (x: number, y: number, w: number, h: number, color: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;

type Pal = Record<string, string>;
type P2 = [number, number];
type Paint = string | ((dx: number, dy: number, d: number, l: number) => string | null);

/** 색 밝기 조절: k>0 흰색 쪽, k<0 검은색 쪽 */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `#${((1 << 24) | (ch(n >> 16 & 255) << 16) | (ch(n >> 8 & 255) << 8) | ch(n & 255)).toString(16).slice(1)}`;
}
/** 밝기 l(-1~1)에 따라 밝은·보통·어두운 글자 */
const tone = (l: number, hi: string, mid: string, lo: string, k = 0.38) => l > k ? hi : l < -k ? lo : mid;
/** 원호 위의 점들 (각도는 도, y가 아래로 커진다: 0=오른쪽, 90=아래) */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 12): P2[] =>
  Array.from({ length: n + 1 }, (_, i): P2 => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

/** 32×32 글자 칸 그림판. '.'은 빈칸, '@'는 테두리 색 */
class Pix {
  g: string[][] = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  set(x: number, y: number, c: string | null) { x = Math.floor(x); y = Math.floor(y); if (c && x >= 0 && y >= 0 && x < N && y < N) this.g[y][x] = c; return this; }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < N && y < N ? this.g[y][x] : '.'; }
  box(x: number, y: number, w: number, h: number, c: string) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  /** 문자 그림을 (x0, y0)에 찍는다. '.'은 건너뛴다 */
  stamp(rows: string[], x0 = 0, y0 = 0) { rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') this.set(x0 + x, y0 + y, row[x]); }); return this; }
  /** 타원: 칸 중심이 안에 들면 f(dx, dy, 정규화 반지름, 밝기) */
  oval(cx: number, cy: number, rx: number, ry: number, f: Paint) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, e = Math.hypot(dx / rx, dy / ry);
      if (e <= 1) this.set(x, y, typeof f === 'string' ? f : f(dx, dy, e, -(dx / rx + dy / ry) / SQ2));
    }
    return this;
  }
  /** 원: f(dx, dy, 거리, 밝기) */
  disc(cx: number, cy: number, r: number, f: Paint) { return this.oval(cx, cy, r, r, typeof f === 'string' ? f : (dx, dy, e, l) => f(dx, dy, e * r, l)); }
  /** 고리 (밝기는 고리 단면 기준: 바깥쪽 절반은 바깥, 안쪽 절반은 안쪽을 향한다) */
  ring(cx: number, cy: number, ro: number, ri: number, f: (l: number) => string) {
    return this.disc(cx, cy, ro, (dx, dy, d) => {
      if (d <= ri) return null;
      const s = d > (ro + ri) / 2 ? 1 : -1;
      return f(-s * (dx + dy) / (SQ2 * Math.max(d, 0.01)));
    });
  }
  /** 관(굵은 선): 중심선 pts를 따라 반지름 r(t) 안의 칸에 f(밝기, t, 길이s)를 찍는다. t=0~1 */
  tube(pts: P2[], r: (t: number) => number, f: (l: number, t: number, s: number) => string | null) {
    const seg: number[][] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
      seg.push([ax, ay, bx - ax, by - ay, len, total]);
      total += len;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      let best = Infinity, bs = 0, vx = 0, vy = 0;
      for (const [ax, ay, dx, dy, len, s0] of seg) {
        const u = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (len * len))) : 0;
        const qx = px - (ax + dx * u), qy = py - (ay + dy * u), d = Math.hypot(qx, qy);
        if (d < best) { best = d; bs = s0 + len * u; vx = qx; vy = qy; }
      }
      const t = total ? bs / total : 0, rr = r(t);
      if (best <= rr) this.set(x, y, f(-(vx + vy) / (SQ2 * Math.max(rr, 0.5)), t, bs));
    }
    return this;
  }
  /** 같은 글자 덩어리의 위·왼쪽 가장자리는 hi, 아래(2칸)·오른쪽 가장자리는 lo */
  edge(c: string, hi: string, lo: string) {
    const g0 = this.g.map(r => [...r]);
    const out = (x: number, y: number) => x < 0 || y < 0 || x >= N || y >= N || g0[y][x] !== c;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g0[y][x] !== c) continue;
      if (out(x, y - 1) || out(x - 1, y)) this.g[y][x] = hi;
      else if (out(x, y + 1) || out(x, y + 2) || out(x + 1, y)) this.g[y][x] = lo;
    }
    return this;
  }
  /** SVG 본문. outline을 주면 그림에 닿은 빈칸을 테두리 색으로 칠한다 (skip 글자는 테두리를 만들지 않는다: 빛·낚싯줄) */
  render(pal: Pal, outline?: string, skip = '') {
    const solid = (x: number, y: number) => { const c = this.get(x, y); return c !== '.' && !skip.includes(c); };
    const colors: Pal = { ...pal, '@': outline ?? pal['@'] ?? '#000' };
    const paths: Record<string, string> = {};
    for (let y = 0; y < N; y++) {
      const row = this.g[y].map((c, x) => c === '.' && outline && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ? '@' : c);
      for (let x = 0; x < N;) {
        const c = row[x];
        let w = 1;
        while (x + w < N && row[x + w] === c) w++;
        const col = colors[c];
        if (c !== '.' && col) paths[col] = (paths[col] ?? '') + `M${x} ${y}h${w}v1h-${w}z`;
        x += w;
      }
    }
    return Object.entries(paths).map(([col, d]) => `<path fill="${col}" d="${d}"/>`).join('');
  }
}

// ── 낚싯대 (민장대: 릴·가이드 없이 마디를 빼서 쓰는 대) ──

/** 낚싯대별 손잡이 색 */
const ROD_GRIP: Record<string, string> = { light: '#7a8b4a', long: '#5a7fb5', power: '#2f3b2f', carbon: '#2a2a33', legend: '#b5862e', memphis: '#5a6951', grand: '#2d796b', gold: '#d1a94d', mugung: '#824b74' };
/** 버들못 계열대 손잡이 색 (id에 든 이름으로 고른다) */
const SERIES_GRIP: [string, string][] = [['heavy', '#6b2f2a'], ['guard', '#7a3a2a'], ['force', '#8a3a32'], ['finesse', '#5f9aa0'], ['soft', '#6fa596'],
  ['shore', '#6f9a4f'], ['reach', '#4f7fb8'], ['allround', '#a0703c'], ['master', '#c9a24a']];
/** 등급별 대 몸통·마디 장식 색 */
const ROD_BLANK: Record<string, [blank: string, joint: string]> = {
  common: ['#4a6e40', '#c9c4a6'], uncommon: ['#2f6a5e', '#cfd3cc'], rare: ['#33508a', '#d6dade'], epic: ['#5e3878', '#e0bd62'], legendary: ['#2e2a26', '#f2c95a'],
};
/** 대 마디: [끝 u, 위 o, 아래 o, 종류]. u=x-y(대를 따라), o=x+y-31(대를 가로질러, 작을수록 왼쪽 위) */
const ROD_PARTS: [number, number, number, string][] = [
  [-23, -3, 2, 'cap'], [-9, -3, 2, 'grip'], [-7, -3, 3, 'joint'], [3, -2, 2, 'blank'], [5, -2, 2, 'joint'],
  [13, -2, 1, 'blank'], [15, -2, 1, 'joint'], [21, -1, 1, 'blank'], [25, -1, 0, 'tip'], [27, 0, 0, 'end'],
];
function rodArt(id?: string) {
  const spec = id ? RODS.find(r => r.id === id) : undefined;
  const grip = (id ? ROD_GRIP[id] : undefined) ?? SERIES_GRIP.find(([k]) => id?.includes(k))?.[1] ?? '#3a4542';
  const [blank, joint] = ROD_BLANK[spec?.rarity ?? 'common'] ?? ROD_BLANK.common;
  const p = new Pix();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x - y, o = x + y - 31;
    if (u < -26 || u > 27) continue;
    const [, lo, hi, kind] = ROD_PARTS.find(([end]) => u <= end)!;
    if (o < lo || o > hi) continue;
    const edge = o === lo ? 0 : o === hi ? 2 : 1;
    let c: string;
    if (kind === 'cap') c = edge === 0 ? 'c' : 'C';
    // 손잡이: 양 끝에 실을 감은 띠
    else if (kind === 'grip') c = u === -21 || u === -20 || u === -12 || u === -11 ? 'k' : ['Q', 'G', 'K'][edge];
    else if (kind === 'joint') c = ['i', 'J', 'I'][edge];
    // 손잡이대에 금색 띠 장식
    else if (kind === 'blank') c = u === -4 || u === -3 ? 'Y' : ['L', 'B', 'D'][edge];
    else if (kind === 'tip') c = edge === 0 ? 'T' : 't';
    else c = 'R';
    p.set(x, y, c);
  }
  // 초릿대 끝에 묶어 늘어뜨린 원줄
  p.tube([[29.6, 2.6], [30.5, 5], [30.5, 9], [29.6, 14]], () => 0.45, () => 'l');
  return p.render({
    C: '#3b3b3b', c: '#8a8a8a', G: grip, Q: shade(grip, 0.32), K: shade(grip, -0.3), k: shade(grip, -0.55),
    J: joint, i: shade(joint, 0.5), I: shade(joint, -0.35), B: blank, L: shade(blank, 0.35), D: shade(blank, -0.4), Y: joint,
    T: shade(blank, 0.5), t: shade(blank, 0.2), R: '#e4573c', l: '#e8eef0',
  }, '#17181a', 'l');
}

// ── 찌 ──

/** 찌 몸통: [폭, 높이, 색, 마디띠 색] (3D 찌와 같은 특징) */
const FLOAT_BODY: Record<string, [w: number, h: number, color: string, ring?: string]> = {
  stick: [8, 11, '#7a2a1c'], short: [10, 9, '#2f5a36'], slim: [6, 13, '#2c3e56'], egg: [12, 11, '#8a3420'],
  long: [8, 12, '#4b2f63'], reed: [8, 12, '#c9b27a', '#8d7240'], peacock: [6, 14, '#ddd3bb', '#6b5a3a'], electro: [8, 11, '#2a2a2a'],
};
/** 찌 아이콘: 찌톱 길이(마디 수)·몸통 모양·불빛이 종류마다 다르다 */
function floatArt(f: FloatSpec) {
  const shape = f.shape ?? 'stick';
  const [w, h, color, ring] = FLOAT_BODY[shape] ?? FLOAT_BODY.stick;
  const chemi = f.light === 'chemi', electro = f.light === 'electro';
  const p = new Pix();
  const head = chemi ? 4 : 0;
  const top = Math.max(5, Math.min(Math.round(4 + (f.notches ?? 10) * 0.6), 30 - 1 - head - h - 4));
  let y = 1 + head;
  // 불빛 둘레의 번짐 (테두리 없이)
  if (chemi) p.disc(16, 3, 4.6, 'o').disc(16, 3, 3.3, 'g').box(15, 1, 2, 4, 'C').box(15, 1, 1, 2, 'c');
  if (electro) p.disc(16, y + 2, 4.6, 'o').disc(16, y + 2, 3.3, 'g');
  // 찌톱: 두 칸씩 빨강·노랑·초록 마디, 전자찌는 끝 4칸이 LED
  for (let i = 0; i < top; i++) {
    const led = electro && i < 4, k = Math.floor(i / 2) % 3;
    const [l, r] = led ? (f.shift && i >= 2 ? ['z', 'Z'] : ['x', 'X']) : [['r', 'R'], ['y', 'Y'], ['e', 'E']][k];
    p.set(15, y + i, l).set(16, y + i, r);
  }
  y += top;
  // 몸통: 모양별 윤곽, 왼쪽은 밝게 오른쪽은 어둡게
  for (let i = 0; i < h; i++) {
    const t = (i + 0.5) / h;
    const prof = shape === 'egg' ? Math.sqrt(Math.max(0.1, 1 - ((t - 0.62) / (t < 0.62 ? 0.68 : 0.42)) ** 2))
      : shape === 'short' ? (t < 0.13 || t > 0.87 ? 0.75 : 1)
      : t < 0.18 ? 0.6 + t / 0.18 * 0.4 : t > 0.7 ? 1 - (t - 0.7) / 0.3 * 0.62 : 1;
    const hw = Math.max(1, Math.round(w / 2 * prof));
    for (let x = 16 - hw; x < 16 + hw; x++) {
      let c = x === 16 - hw ? 'H' : x === 16 + hw - 1 ? 'S' : x === 17 - hw && hw > 2 && t < 0.75 ? 'h' : 'B';
      if (ring && i % 3 === 2) c = x === 16 + hw - 1 ? 'S' : 'N';
      if (i === 1 && !ring) c = electro ? 'M' : x === 16 - hw ? 'a' : 'A';
      if (electro && i === h - 1) c = 'M';
      if (i === h - 1 && !electro) c = 'S';
      p.set(x, y + i, c);
    }
  }
  y += h;
  // 찌다리와 찌고무, 아래로 이어지는 원줄
  for (; y < 28; y++) p.set(15, y, 'F').set(16, y, 'f');
  p.box(15, 28, 2, 2, 'U').set(15, 28, 'u').box(16, 30, 1, 2, 'l');
  const led = f.glowColor ?? '#ff4a3a', shift = f.shift ?? '#4dff7a';
  return p.render({
    o: chemi ? '#c8ff6a33' : `${led}33`, g: chemi ? '#c8ff6a77' : `${led}77`, C: '#b8f55a', c: '#f4ffd8',
    R: '#e8553a', r: '#ff9a7a', Y: '#f2cf3c', y: '#fff19a', E: '#4cbc4c', e: '#94e88a',
    X: led, x: shade(led, 0.55), Z: shift, z: shade(shift, 0.55),
    B: color, H: shade(color, 0.45), h: shade(color, 0.2), S: shade(color, -0.4), N: ring ?? color,
    A: '#e9c46a', a: '#fff0a8', M: '#c9ced2', F: '#efe2bf', f: '#cbb98f', U: '#3b3b3b', u: '#6b6b6b', l: '#e8eef0',
  }, '#1a1512', 'gol');
}

// ── 채비 소품 ──

/** 같은 제품(호수만 다른 것)은 같은 그림: 이름에서 호수를 뺀 제품명으로 색을 고른다 */
const productModel = (name: string) => name.replace(/\s*[\d.]+호.*$/, '').trim();
const pick = <T,>(list: readonly T[], key: string) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return list[h % list.length]; };

/** 바늘 도금 색 [밝음, 보통, 어두움] */
const HOOK_FINISH = {
  silver: ['#eef4f2', '#b3bfbc', '#6c7a77'], black: ['#9aa3a8', '#4a5257', '#1f2427'],
  bronze: ['#ecc49a', '#a8743f', '#5e3d1e'], gold: ['#fff0a8', '#d9b13c', '#86661a'], red: ['#f4a596', '#c24a36', '#6e2116'],
} as const;
function hookFinish(h?: HookSpec): keyof typeof HOOK_FINISH {
  const name = h?.name ?? '';
  if (/갈색/.test(name)) return 'bronze';
  if (/흑|강축|강공|대물/.test(name)) return 'black';
  if (/명인|금/.test(name)) return 'gold';
  return h ? pick(['silver', 'silver', 'black', 'bronze', 'red'] as const, productModel(name)) : 'silver';
}

/** 바늘: 형태(품 크기·허리 길이)·축 굵기·미늘·도금 색이 제품마다 다르다 */
function hookArt(h?: HookSpec) {
  const p = new Pix();
  const t = h ? getHookTraits(h) : { shape: 'wide' as const, wireMm: 0.5, barbed: true };
  const [W, S, D] = HOOK_FINISH[hookFinish(h)];
  const steel = (l: number) => tone(l, 'W', 'S', 'D', 0.3);
  const r = { fine: 4.6, round: 6.4, long: 5, wide: 6 }[t.shape];
  const top = t.shape === 'long' ? 5.5 : 8;
  const cx = 22 - r, bottom = t.shape === 'long' ? 23.5 : 22;
  const px = cx - r, tipY = bottom - r * (t.shape === 'wide' ? 1.45 : 1.15);
  const wire = Math.max(0.75, Math.min(1.2, 0.62 + t.wireMm * 0.55));
  // 바늘귀에 묶은 목줄
  p.tube([[20.5, top - 4.6], [13, -1]], () => 0.5, () => 'l');
  p.ring(22, top - 2.6, 2.8, 1.25, steel);
  // 허리 → 굽은 품 → 바늘 끝 (끝으로 갈수록 가늘다)
  p.tube([[22, top], [22, bottom], ...arc(cx, bottom, r, 0, 180), [px, tipY + 3], [px + 0.5, tipY - 1]], q => q > 0.9 ? wire - (q - 0.9) * 5 * wire : wire, steel);
  // 미늘: 끝 아래에서 안쪽·아래로 젖혀진 가시 (무미늘은 없다)
  if (t.barbed) p.tube([[px + 0.8, tipY + 1.4], [px + 2.6, tipY + 4.4]], () => 0.55, () => 'S');
  const shine = Math.round(top) + 2;
  p.set(21, shine, 'X').set(21, shine + 1, 'X');
  return p.render({ W, S, D, X: '#ffffff', l: '#e3ebee' }, shade(D, -0.45), 'l');
}

/** 감긴 줄 색: 재질마다 다르다 */
const LINE_COLOR: Record<string, string> = { nylon: '#ebe7cc', fluorocarbon: '#d4dee8', braid: '#72ad4c' };
const SPOOL_RIMS = ['#3d7fc4', '#c8473a', '#3f8f5a', '#d08a2c', '#7a4fa0', '#2f3640', '#2a9aa0', '#b8456f'] as const;

/** 원줄: 실패 테 색은 제품, 감긴 줄 색은 재질 */
function spoolArt(l?: LineSpec) {
  const rim = l ? pick(SPOOL_RIMS, productModel(l.name)) : '#3d7fc4';
  const line = LINE_COLOR[l?.material ?? 'nylon'];
  const p = new Pix();
  // 플라스틱 테 / 감긴 줄(동심원 결) / 가운데 축과 구멍
  p.disc(16, 16, 14.6, (_dx, _dy, d, l) => d > 11.6 ? tone(l, 'p', 'P', 'Q', 0.42)
    : d > 6.2 ? (l > 0.5 ? 'V' : l < -0.5 ? 'v' : Math.floor(d * 1.4) % 2 ? 'w' : 'W')
    : d > 4.7 ? tone(l, 'K', 'k', 'k') : d > 2.2 ? 'K' : '.');
  // 테의 걸림 홈 4곳
  for (const [x, y] of [[15, 2], [16, 2], [15, 29], [16, 29], [2, 15], [2, 16], [29, 15], [29, 16]] as P2[]) p.set(x, y, 'Q');
  // 풀려 나온 줄 끝
  p.tube([[24.6, 21.4], [27.5, 24.5], [29, 28], [31.5, 31]], () => 0.5, () => 'l');
  return p.render({ P: rim, p: shade(rim, 0.42), Q: shade(rim, -0.35), W: line, w: shade(line, -0.1), V: shade(line, 0.6), v: shade(line, -0.25), K: '#f2f2ee', k: '#a9adb0', l: shade(line, 0.3) }, shade(rim, -0.7), 'l');
}

function sinkerArt() {
  const p = new Pix();
  p.tube([[16.5, 0], [16.5, 3.6]], () => 0.5, () => 'l');
  // 황동 고리
  p.ring(16, 5.6, 2.6, 1.1, l => tone(l, 'Y', 'y', 'z', 0.2));
  // 물방울 모양 납 봉돌
  p.tube([[16, 10], [16, 20]], t => 2 + t * 6.8, l => l > 0.62 ? 'W' : tone(l, 'H', 'M', 'D', 0.25));
  p.stamp(['WW', 'W'], 11, 16);
  // 찍힌 자국
  p.set(19, 22, 'D').set(19, 23, 'H').set(14, 25, 'D').set(14, 26, 'H');
  return p.render({ W: '#f1f4f5', H: '#c4cbcf', M: '#8e969b', D: '#5b6267', Y: '#f2cf6a', y: '#c99a32', z: '#8a6418', l: '#e8eef0' }, '#1f2326', 'l');
}

function rigArt() {
  const p = new Pix();
  p.box(16, 0, 1, 23, 'l');
  // 찌: 찌톱 마디 → 몸통 → 찌다리
  for (let i = 0; i < 5; i++) { const [l, r] = [['r', 'R'], ['y', 'Y'], ['e', 'E']][Math.floor(i / 2) % 3]; p.set(15, 1 + i, l).set(16, 1 + i, r); }
  p.stamp(['..HBBS..', '.aAAAAA.', 'HhBBBBBS', 'HhBBBBBS', 'HhBBBBBS', 'HhBBBBBS', '.HBBBBS.', '..HBBS..', '...HS...'], 12, 6);
  p.box(15, 15, 1, 3, 'F').box(16, 15, 1, 3, 'f');
  // 좁쌀 봉돌
  p.disc(16, 20, 2.2, (_dx, _dy, _d, l) => tone(l, 'J', 'M', 'm', 0.3));
  // 바늘 (미늘 포함)
  const steel = (l: number) => tone(l, 'W', 'K', 'k', 0.3);
  p.tube([[16.5, 22.5], [16.5, 26.5], ...arc(13.5, 26.5, 3, 0, 180, 10), [10.5, 23.4]], () => 0.55, steel);
  p.set(11, 25, 'K');
  return p.render({
    R: '#e8553a', r: '#ff9a7a', Y: '#f2cf3c', y: '#fff19a', E: '#4cbc4c', e: '#94e88a',
    B: '#9b4a2a', H: '#d07a4a', h: '#b85e36', S: '#5e2a14', A: '#e9c46a', a: '#fff0a8', F: '#efe2bf', f: '#cbb98f',
    J: '#c4cbcf', M: '#8e969b', m: '#5b6267', W: '#eef4f2', K: '#b3bfbc', k: '#6c7a77', l: '#dfe8ec',
  }, '#1a1512', 'l');
}

// ── 미끼 ──

function wormArt() {
  const p = new Pix();
  const pts: P2[] = [[5, 7], [20, 7], ...arc(20, 11.5, 4.5, -90, 90), [11, 16], ...arc(11, 20.5, 4.5, -90, -270), [27, 25]];
  p.tube(pts, t => t < 0.03 ? 1.3 + t * 25 : t > 0.82 ? 2.1 - (t - 0.82) * 7.5 : 2.1, (l, t, s) => {
    // 환대(머리 쪽 굵은 띠)
    if (t > 0.12 && t < 0.21) return tone(l, 'c', 'C', 'R', 0.4);
    const seg = s % 2.6 < 0.8;
    return l > 0.4 ? (seg ? 'h' : 'H') : l < -0.4 ? (seg ? 'R' : 'D') : seg ? 'r' : 'P';
  });
  p.set(5, 6, 'h');
  return p.render({ P: '#d4675e', H: '#f2a497', h: '#e48a7e', D: '#9c3d3a', R: '#7e2c2a', r: '#b24f48', C: '#e98d6c', c: '#f7b896' }, '#3b1514');
}

function cornArt() {
  const p = new Pix();
  // 알갱이가 줄지어 박힌 옥수수 (알마다 왼쪽 위 밝은 점)
  for (let y = 2; y < 27; y++) {
    const hw = y === 2 ? 3 : y === 3 ? 4.5 : y === 4 ? 5.5 : 6;
    for (let x = Math.ceil(16 - hw); x < 16 + hw; x++) {
      const off = Math.floor((y - 2) / 2) % 2, lx = (x - 10 + off + 2) % 2, ly = (y - 2) % 2;
      let c = lx === 0 && ly === 0 ? 'h' : lx === 1 && ly === 1 ? 'k' : 'K';
      if (x >= 20) c = c === 'h' ? 'K' : 'k';
      else if (x <= 10 && c === 'K') c = 'h';
      p.set(x, y, c);
    }
  }
  // 껍질 잎 세 장과 꼭지
  const leaf = (l: number) => tone(l, 'L', 'G', 'g', 0.25);
  p.tube([[14, 30], [10, 24], [7.5, 17], [8.5, 11]], t => 2.6 * (1 - t) + 0.5, leaf);
  p.tube([[18, 30], [22, 25], [24, 19], [23, 14]], t => 2.6 * (1 - t) + 0.5, leaf);
  p.tube([[16, 30], [15.5, 23]], t => 1.8 * (1 - t) + 0.6, leaf);
  p.box(14, 29, 4, 2, 'S').set(14, 29, 's');
  return p.render({ K: '#f2c84b', h: '#fff0a0', k: '#c99a2a', L: '#a8d06a', G: '#7fae4a', g: '#4f7a2e', S: '#8a7a3a', s: '#b0a058' }, '#2e2410');
}

function shrimpArt() {
  const p = new Pix();
  // 더듬이 두 가닥 (가늘게, 테두리 없이)
  p.tube([[7, 10], [4, 6], [5, 2.5], [12, 1], [23, 1.5], [29, 3.5]], () => 0.45, () => 'a');
  p.tube([[8, 10], [7.5, 5], [13, 3.5], [20, 4.5]], () => 0.45, () => 'a');
  // 걷는 다리
  for (const [a, b] of [[[9, 16], [7, 21]], [[11.5, 17], [10.5, 22]], [[14, 17.5], [14, 21.5]]] as [P2, P2][]) p.tube([a, b], () => 0.45, () => 'q');
  // 이마뿔
  p.tube([[8, 12.4], [2.5, 10.6]], t => 0.9 - t * 0.5, l => tone(l, 'J', 'K', 'k'));
  // 몸: 머리가슴(단단한 껍질) → 마디진 배
  p.tube(arc(16, 15, 7.5, -165, 75, 18), t => t < 0.3 ? 3.3 - t * 1.2 : 2.9 - (t - 0.3) * 2.1, (l, t, s) =>
    t < 0.3 ? tone(l, 'J', 'K', 'k', 0.3) : s % 2.7 < 0.75 && l > -0.6 ? 's' : tone(l, 'H', 'B', 'D', 0.3));
  // 꼬리 부채
  for (const end of [[11, 21.5], [10.5, 25], [13, 28]] as P2[]) p.tube([[17.4, 22.6], end], t => 1.25 - t * 0.35, l => tone(l, 'f', 'F', 'd', 0.3));
  p.set(9, 11, 'E').set(10, 11, 'E').set(9, 12, 'E').set(10, 12, 'E').set(9, 11, 'e');
  return p.render({
    J: '#f3d2b0', K: '#d6a27a', k: '#a06e4c', H: '#f0cfae', B: '#cf9f7a', D: '#9c6c4c', s: '#a46a46',
    F: '#c48a5e', f: '#e6b48a', d: '#8a5838', E: '#151515', e: '#ffffff', a: '#b8875f', q: '#c99a74',
  }, '#3a2416', 'aq');
}

/** 떡밥 봉지 색: [봉지, 상표 띠, 내용물] */
const BAG_COLORS: Record<string, [string, string, string]> = {
  paste: ['#d88a2a', '#7a3a12', '#b39157'], gluten: ['#3d7fc4', '#f2f2ee', '#e2d9b4'],
  pellet: ['#8a2a22', '#e8c25a', '#876043'], chum: ['#3f7a46', '#e8c25a', '#9a834b'],
};
/** 은박 떡밥 봉지: 톱니 실링, 상표 띠, 물고기 로고, 내용물 창 */
function baitBagArt([bag, band, fill]: [string, string, string]) {
  const p = new Pix();
  p.box(6, 6, 20, 22, 'B').box(5, 8, 22, 18, 'B').edge('B', 'h', 'b');
  for (let x = 6; x < 26; x++) p.set(x, 3, 'T').set(x, 4, x % 2 ? 't' : 'T').set(x, 5, 'b').set(x, 28, 'T');
  for (let x = 6; x < 26; x += 2) p.set(x, 2, 'T').set(x, 29, 'T');
  p.set(25, 6, '.').set(25, 7, '.');  // 뜯는 홈
  p.box(6, 8, 20, 3, 'R');
  for (const x of [8, 9, 11, 13, 14, 16, 18, 19, 21, 23]) p.set(x, 9, 'w');
  p.box(8, 12, 16, 12, 'l').box(9, 13, 14, 10, 'L');
  p.stamp(['..FFFF...F', '.FFFFFF.FF', 'FeFFFFFFFF', '.FFFFFF.FF', '..FFFF...F'], 11, 13);
  for (let y = 19; y < 22; y++) for (let x = 10; x < 22; x++) p.set(x, y, (x * 3 + y * 5) % 7 === 0 ? 'c' : (x * 5 + y) % 9 === 0 ? 'k' : 'C');
  p.set(10, 19, 'L').set(21, 19, 'L').set(10, 21, 'L').set(21, 21, 'L');
  return p.render({
    B: bag, h: shade(bag, 0.35), b: shade(bag, -0.35), T: '#c9ced2', t: '#8b9296', R: band, w: band === '#f2f2ee' ? '#3d5a8a' : '#ffffff',
    L: '#f6efd8', l: '#c9bc9a', F: band === '#f2f2ee' ? '#3d5a8a' : band, e: '#f6efd8', C: fill, c: shade(fill, 0.4), k: shade(fill, -0.35),
  }, '#1e1a14');
}

/** 떡밥 재료 자루 색: [자루, 내용물] */
const SACK_COLORS: Record<string, [string, string]> = {
  bran: ['#c9a46a', '#ac925a'], cornmeal: ['#d8c08a', '#d8b857'], attractor: ['#e6dccb', '#c08c77'],
  fishmeal: ['#a8865c', '#987353'], glutenpowder: ['#ebe7dc', '#ece0b8'],
  barley: ['#c2ae80', '#b8a16a'], strawberry: ['#df8091', '#cc6579'],
};
/** 끈으로 묶은 재료 자루와 앞에 쏟아진 가루 */
function sackArt([sack, fill]: [string, string]) {
  const p = new Pix();
  const HW = [0, 0, 0, 5, 4.5, 4, 3.5, 3, 3, 3.5, 6, 7.5, 8.5, 9.5, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9.5, 9, 8, 6.5];
  HW.forEach((hw, y) => { for (let x = Math.ceil(16 - hw); x < 16 + hw; x++) if (hw) p.set(x, y, 'B'); });
  for (let x = 11; x < 21; x += 2) p.set(x, 3, '.');   // 오므린 입구의 주름
  p.edge('B', 'h', 'd');
  // 올 짠 결
  for (let y = 10; y < 28; y++) for (let x = 6; x < 26; x++) if (p.get(x, y) === 'B' && (x + y * 2) % 4 === 0) p.set(x, y, 'b');
  for (const x of [13, 15, 17]) p.set(x, 4, 'd').set(x, 5, 'd');
  // 묶은 끈과 매듭
  p.box(12, 7, 8, 2, 'T').set(12, 7, 't').set(13, 7, 't').stamp(['TT', '.T', '.T'], 19, 9).stamp(['T', 'T'], 18, 9);
  // 라벨: 내용물 색 견본
  p.box(10, 14, 12, 9, 'l').box(11, 15, 10, 7, 'L').box(12, 17, 8, 4, 'C').set(13, 18, 'c').set(16, 19, 'c').set(18, 17, 'k').set(14, 20, 'k');
  p.box(12, 15, 8, 1, 'k');
  // 쏟아진 가루 더미
  p.oval(25, 28.5, 5.6, 2.8, (_dx, _dy, _e, l) => tone(l, 'c', 'C', 'k', 0.25));
  return p.render({
    B: sack, b: shade(sack, -0.12), h: shade(sack, 0.35), d: shade(sack, -0.35), T: '#8a5a2e', t: '#b8844e',
    L: '#f6efd8', l: '#8a7a5a', C: fill, c: shade(fill, 0.4), k: shade(fill, -0.35),
  }, '#241a10');
}

// ── 장비 ──

function netArt() {
  const p = new Pix();
  // 그물: 테 안쪽과 아래로 처진 망 (마름모 그물코)
  const mesh = (x: number, y: number, deep: boolean) => (x + y) % 4 === 0 || (x - y + 32) % 4 === 0 ? (deep ? 'm' : 'n') : deep ? 'B' : 'b';
  p.oval(21, 17.5, 7, 10, (dx, dy) => mesh(Math.floor(dx + 21), Math.floor(dy + 17.5), true));
  p.oval(19.5, 10.5, 8.6, 7.6, (dx, dy) => mesh(Math.floor(dx + 19.5), Math.floor(dy + 10.5), false));
  // 알루미늄 테
  p.oval(19.5, 10.5, 9.8, 8.8, (dx, dy, e) => e > 0.86 ? tone(-(dx + dy) / 9, 'M', 'I', 'O', 0.3) : null);
  // 연결 고리와 뜰채 자루 (뽑는 마디·손잡이·끝마개)
  p.tube([[13.2, 16.8], [2.6, 29.4]], t => t < 0.45 ? 0.8 : 1.1, (l, t, s) =>
    t > 0.93 ? 'C' : t > 0.62 ? (s % 2 < 0.8 ? 'g' : tone(l, 'H', 'G', 'g', 0.3)) : t > 0.43 && t < 0.49 ? 'J' : tone(l, 's', 'S', 'd', 0.3));
  p.box(12, 15, 2, 2, 'J').set(12, 15, 'j');
  return p.render({
    n: '#dfe6dc', m: '#9fb09c', b: '#2c4636', B: '#1f3328', M: '#e2e8ea', I: '#9aa4aa', O: '#5a6268',
    S: '#3b4a52', s: '#6d808a', d: '#252f35', J: '#d0b25a', j: '#fff0a8', G: '#4a4a4a', H: '#7a7a7a', g: '#262626', C: '#c8402f',
  }, '#121a16');
}

function keepnetArt() {
  const p = new Pix();
  const rings: [number, number][] = [[5, 11.5], [11, 11], [17, 10.6], [22.5, 10.2], [27.5, 9.8]];
  // 망 몸통: 고리 사이를 이어 원통으로
  for (let y = 5; y < 28; y++) {
    const i = Math.min(3, rings.findIndex((_, k) => y < (rings[k + 1]?.[0] ?? 99)));
    const [y0, r0] = rings[i], [y1, r1] = rings[i + 1], hw = r0 + (r1 - r0) * (y - y0) / (y1 - y0);
    for (let x = Math.ceil(16 - hw); x < 16 + hw; x++) p.set(x, y, 'b');
  }
  // 안에 든 붕어 (그물코 너머로 보인다)
  p.oval(15, 16.5, 5.6, 2.8, (_dx, _dy, _e, l) => tone(l, 'F', 'f', 'k', 0.3));
  p.stamp(['Z..', 'ZZ.', 'ZZZ', 'ZZ.', 'Z..'], 20, 14).set(11, 16, 'E');
  for (let y = 5; y < 28; y++) for (let x = 0; x < N; x++) {
    const c = p.get(x, y);
    if (c !== '.' && ((x + y) % 4 === 0 || (x - y + 32) % 4 === 0)) p.set(x, y, c === 'b' ? 'n' : 'm');
  }
  // 고리: 앞쪽 절반은 밝고 뒤쪽은 어둡다. 맨 위는 굵은 입구 테
  rings.forEach(([cy, rx], i) => p.oval(16, cy, rx + 0.4, 2.6, (_dx, dy, e) => {
    if (i === 0) return e < 0.6 ? 'o' : dy < 0 ? 'T' : 't';
    return e > 0.55 ? (dy > 0.6 ? 'R' : dy > -0.6 ? 'Q' : 'r') : null;
  }));
  // 받침대에 꽂는 팔과 조임 손잡이
  p.tube([[5, 4.5], [1.8, 3.2]], () => 0.8, l => tone(l, 'A', 'A', 'a'));
  p.disc(2, 3, 1.6, 'K').set(1, 2, 'j');
  return p.render({
    b: '#22362a', n: '#7fae6a', m: '#5a6a3a', F: '#d8b450', f: '#b08e3a', k: '#7a6228', Z: '#9a7a32', E: '#151515',
    o: '#0f1a13', T: '#eef1e6', t: '#b8bfb0', R: '#e2e7da', Q: '#b4bcae', r: '#6f7a6a', A: '#c0c6c0', a: '#7f8680', K: '#d8402f', j: '#f07a6a',
  }, '#0e1610');
}

function coinArt() {
  const p = new Pix();
  p.disc(16, 16, 14.4, (dx, dy, d, l) => {
    // 톱니 테두리
    if (d > 13.3) return Math.floor((Math.atan2(dy, dx) * 180 / Math.PI + 360) / 12) % 2 ? tone(l, 'R', 'G', 'g', 0.3) : 'g';
    if (d > 11.6) return tone(l, 'R', 'G', 'g', 0.25);
    if (d > 10.6) return 'e';
    return tone(l, 'F', 'f', 'G', 0.45);
  });
  // ₩ 새김 (홈 안쪽 오른쪽 아래가 밝다)
  const W = ['X...........X', 'X...........X', 'XXXXXXXXXXXXX', '.X....X....X.', 'XXXXXXXXXXXXX', '..X..X.X..X..', '..X.X...X.X..', '...XX...XX...', '...X.....X...'];
  W.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') p.set(10 + x, 12 + y, 'w'); }));
  W.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') p.set(9 + x, 11 + y, 'e'); }));
  p.stamp(['.S.', 'SSS', '.S.'], 6, 6);
  return p.render({ R: '#ffe27a', G: '#e9b434', g: '#b07a12', e: '#a06810', F: '#ffe9a0', f: '#f6cd52', w: '#fff6c8', S: '#ffffff' }, '#4a2e04');
}

function lockArt() {
  const p = new Pix();
  // 고리(쇠) → 몸통(황동) → 열쇠 구멍
  p.tube([[10.5, 15], [10.5, 11], ...arc(16, 11, 5.5, 180, 360), [21.5, 15]], () => 1.25, l => tone(l, 's', 'S', 'd', 0.3));
  p.box(7, 14, 18, 15, 'G').box(7, 14, 18, 1, 't').box(7, 15, 1, 13, 'h').box(24, 15, 1, 14, 'g').box(8, 28, 16, 1, 'g');
  p.box(8, 15, 16, 1, 'H').box(9, 17, 14, 1, 'k').box(9, 25, 14, 1, 'k');
  for (const [x, y] of [[9, 16], [22, 16], [9, 26], [22, 26]] as P2[]) p.set(x, y, 'H').set(x + 1, y + 1, 'g');
  p.stamp(['.KK.', 'KKKK', 'KKKK', '.KK.', '.KK.', '.KK.'], 14, 19);
  return p.render({ G: '#e2b23c', t: '#ffe58a', h: '#f5cd5c', g: '#a87a1c', H: '#fff2b8', k: '#c4921f', K: '#3a2608', S: '#c9cdd0', s: '#f2f4f5', d: '#7d8488' }, '#2a1c06');
}

function boxArt() {
  const p = new Pix();
  // 낚시 소품 상자: 손잡이, 뚜껑, 걸쇠, 칸막이 창
  p.tube(arc(16, 8, 5, 180, 360, 10), () => 1, l => tone(l, 'h', 'H', 'H'));
  p.box(4, 8, 24, 6, 'L').edge('L', 'l', 'D');
  p.box(4, 14, 24, 14, 'B').edge('B', 'b', 'D');
  p.box(6, 16, 20, 9, 'G').box(6, 16, 20, 1, 'g');
  for (const x of [12, 19]) p.box(x, 16, 1, 9, 'k');
  p.box(7, 18, 3, 2, 'o').box(14, 19, 3, 3, 'q').box(21, 17, 3, 4, 'r');
  p.box(14, 12, 4, 4, 'M').set(14, 12, 'm').box(15, 14, 2, 1, 'K');
  return p.render({ L: '#4f8a5a', l: '#7fb886', B: '#3f7a4a', b: '#68a46e', D: '#24452a', G: '#a8d4e0', g: '#e8fbff', k: '#24452a',
    o: '#e8b030', q: '#e8553a', r: '#d8d8d0', M: '#d8c070', m: '#fff0a8', K: '#6a5420', H: '#3a3a3a', h: '#6a6a6a' }, '#101a12');
}

// ── 날씨 ──

function sunArt() {
  const p = new Pix();
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    p.tube([[16 + c * 10.2, 16 + s * 10.2], [16 + c * 13.4, 16 + s * 13.4]], () => 1.05, l => tone(l, 'o', 'O', 'Q', 0.3));
  }
  p.disc(16, 16, 7.6, (_dx, _dy, _d, l) => tone(l, 'y', 'Y', 'Z', 0.35));
  p.stamp(['.WW', 'WW.', 'W..'], 11, 11);
  return p.render({ Y: '#ffd84a', y: '#fff3a0', Z: '#f0a828', W: '#fffbe0', O: '#ffb23a', o: '#ffd27a', Q: '#e0861a' }, '#6a3e06');
}

function moonArt() {
  const p = new Pix();
  p.disc(15, 16.5, 12, (_dx, _dy, _d, l) => tone(l, 'm', 'M', 'K', 0.3));
  p.disc(21.5, 11, 9.8, '.');
  p.box(7, 17, 2, 2, 'c').set(8, 18, 'm').box(11, 24, 2, 1, 'c').set(6, 22, 'c').box(15, 26, 2, 2, 'c');
  p.stamp(['.s.', 'sSs', '.s.'], 20, 11).set(27, 5, 's').set(25, 21, 's');
  return p.render({ M: '#f4edc2', m: '#fffbe6', K: '#cfc58e', c: '#d4c98f', s: '#fff6b0', S: '#ffffff' }, '#3e3820', 'sS');
}

/** 구름: 원 여러 개 + 평평한 밑면, 위는 밝고 아래는 그늘 */
function cloud(p: Pix, discs: [number, number, number][], base: [number, number, number, number], c: string, hi: string, lo: string) {
  for (const [x, y, r] of discs) p.disc(x, y, r, c);
  p.box(...base, c).edge(c, hi, lo);
}
function cloudyArt() {
  const p = new Pix();
  cloud(p, [[20.5, 9, 4], [26, 11.5, 3.5]], [17, 11, 13, 4], 'g', 'G', 'k');
  cloud(p, [[8.5, 19.5, 5], [16, 15, 7], [24, 19.5, 5.5]], [5, 19, 24, 6], 'C', 'W', 'S');
  return p.render({ C: '#eef1ef', W: '#ffffff', S: '#b9c2c6', g: '#c3cbd0', G: '#dfe5e8', k: '#97a3aa' }, '#3e4a52');
}
function rainArt() {
  const p = new Pix();
  cloud(p, [[9, 11, 5], [16, 7.5, 6.5], [23.5, 11, 5.2]], [5, 11, 24, 5], 'C', 'W', 'S');
  for (const [x, y] of [[7, 19], [14, 22], [21, 19], [10, 26], [24, 25]] as P2[]) p.stamp(['.d', 'dD', 'D.'], x, y);
  return p.render({ C: '#9aa6b0', W: '#c8d2da', S: '#6c7a86', d: '#bfe2ff', D: '#4f9de8' }, '#1f2e3c');
}
function fogArt() {
  const p = new Pix();
  ([[4, 21, 5, 'A'], [10, 28, 12, 'B'], [3, 23, 19, 'A'], [12, 27, 26, 'B']] as [number, number, number, string][]).forEach(([x0, x1, y, c]) =>
    p.tube([[x0, y], [x1, y]], () => 1.55, l => c === 'A' ? tone(l, 'a', 'A', 'q', 0.3) : tone(l, 'b', 'B', 'Q', 0.3)));
  return p.render({ a: '#ffffff', A: '#e2e7ea', q: '#b6bfc4', b: '#eef1f2', B: '#c9d0d4', Q: '#9aa4aa' }, '#5d686e');
}

// ── 메뉴 ──

function bagArt() {
  const p = new Pix();
  // 손잡이 끈과 D고리
  p.tube(arc(16, 10, 6.5, 180, 360, 12), () => 1, l => tone(l, 'h', 'H', 'H'));
  p.box(8, 9, 3, 2, 'M').box(21, 9, 3, 2, 'M').set(8, 9, 'm').set(21, 9, 'm');
  // 몸통 → 덮개(스티치) → 잠금 끈과 버클 → 앞주머니(지퍼)
  p.box(4, 11, 24, 18, 'B').edge('B', 'b', 'D');
  p.box(5, 11, 22, 8, 'F').box(5, 11, 22, 1, 'f').set(5, 18, 'B').set(26, 18, 'B').box(6, 19, 20, 1, 'D');
  for (let x = 7; x < 25; x += 2) p.set(x, 12, 'S').set(x, 17, 'S');
  for (let y = 14; y < 17; y += 2) p.set(6, y, 'S').set(25, y, 'S');
  p.box(14, 15, 4, 7, 'K').box(13, 18, 6, 3, 'M').box(15, 19, 2, 1, 'K').set(13, 18, 'm').set(14, 18, 'm');
  p.box(7, 22, 18, 6, 'P').box(7, 22, 18, 1, 'p');
  for (let x = 7; x < 25; x++) p.set(x, 23, x % 2 ? 'Z' : 'z');
  p.box(21, 24, 2, 2, 'M').set(21, 24, 'm');
  for (let x = 8; x < 24; x += 2) p.set(x, 26, 'S');
  return p.render({
    B: '#8b5a2e', b: '#b07840', D: '#5e3a1c', F: '#6f4524', f: '#93603a', S: '#e8c890', K: '#4a2c14',
    M: '#d8c070', m: '#fff0a8', P: '#7a4e28', p: '#a06a3a', Z: '#cfc7b0', z: '#6b6b6b', H: '#5a3a1e', h: '#8a5a32',
  }, '#24160a');
}

function shopArt() {
  const p = new Pix();
  // 간판 (금색 물고기 표시)
  p.box(9, 1, 14, 5, 'W').edge('W', 'V', 'w');
  p.stamp(['...YYY...Y', '.YYYYYYY.YY', 'YkYYYYYYYY', '.YYYYYYY.YY', '...YYY...Y'].map(r => r.slice(0, 10)), 11, 1);
  // 줄무늬 차양과 물결 끝단
  for (let x = 3; x < 29; x++) {
    const red = Math.floor((x - 3) / 3) % 2 === 0, k = (x - 3) % 3;
    for (let y = 6; y < 11; y++) p.set(x, y, y === 6 ? 'k' : red ? (k === 2 ? 'r' : 'R') : (k === 2 ? 'v' : 'w'));
    if (k === 1) p.set(x, 11, red ? 'R' : 'w');
  }
  // 나무 벽(널빤지), 진열창, 문
  p.box(5, 12, 22, 17, 'B');
  for (let y = 14; y < 29; y += 3) p.box(5, y, 22, 1, 'b');
  p.box(7, 14, 9, 9, 'F').box(8, 15, 7, 7, 'G').set(9, 16, 'g').set(10, 16, 'g').set(9, 17, 'g');
  p.box(8, 20, 7, 1, 'F').box(9, 18, 2, 2, 'o').box(12, 17, 2, 3, 'q');
  p.box(18, 15, 7, 14, 'D').box(19, 16, 5, 5, 'd').box(19, 23, 5, 4, 'd').set(19, 22, 'Y');
  p.box(3, 29, 26, 2, 'S').box(3, 29, 26, 1, 's');
  return p.render({
    W: '#a8743e', V: '#d09a5a', w: '#7a5228', Y: '#f2cf5a', k: '#7a2a1c', R: '#d8402f', r: '#a82a20', v: '#cfc6b2',
    B: '#b07a44', b: '#8a5a2e', F: '#e0b878', G: '#9fd4e8', g: '#e8fbff', D: '#6b4120', d: '#5a3418', S: '#8d9290', s: '#b5bab8', o: '#e8b030', q: '#5aa7ff',
  }, '#24160a');
}

function bookArt(cover: string) {
  const p = new Pix();
  // 종이 두께(오른쪽·아래로 비치는 책장)
  p.box(8, 5, 19, 24, 'P');
  for (let y = 6; y < 28; y += 2) p.set(26, y, 'p');
  for (let x = 9; x < 26; x += 2) p.set(x, 28, 'p');
  // 표지와 책등, 금박 모서리
  p.box(5, 3, 20, 24, 'G').edge('G', 'g', 'D');
  p.box(5, 3, 3, 24, 'S').box(5, 6, 3, 1, 'Y').box(5, 23, 3, 1, 'Y').box(5, 3, 1, 24, 's');
  p.stamp(['YYY', '.YY', '..Y'], 22, 3).stamp(['..Y', '.YY', 'YYY'], 22, 24);
  // 금박 제목 줄 사이에 물고기 문장
  p.box(10, 8, 12, 1, 'Y').box(10, 22, 12, 1, 'Y').box(12, 10, 8, 1, 'D');
  p.stamp(['....YYY.......', '..YYYYYYY...YY', '.YYYYYYYYY.YYY', 'YeYYYYYYYYYYY.', '.YYYYYYYYY.YYY', '..YYYYYYY...YY', '....YY........'], 9, 12);
  p.box(12, 20, 8, 1, 'D');
  p.box(19, 27, 2, 4, 'r').set(20, 27, 'R').set(19, 30, '.').set(20, 30, 'R');
  return p.render({
    P: '#f3ead2', p: '#c9bc9a', G: cover, g: shade(cover, 0.3), D: shade(cover, -0.35), S: shade(cover, -0.45), s: shade(cover, -0.2),
    Y: '#e8c25a', e: shade(cover, -0.35), r: '#d0443a', R: '#9a2a24',
  }, '#14181a');
}

function trophyArt() {
  // 왼쪽 반을 그리고 좌우 대칭 (오른쪽 반은 밝은 글자를 그늘 글자로 바꾼다)
  const half = [
    '', '',
    '.....RRRRRRRRRRR',
    '.....Riiiiiiiiii',
    '.....hRRRRRRRRRR',
    '..GGGhHGGGGGGGGG',
    '.G...hHHGGGGGGGG',
    '.G...hHHGGGGGGGS',
    '.G...hHHGGGGGSSS',
    '.GG..hHHGGGGGGSS',
    '..G..hHGGGGGGGSG',
    '..GGGhHGGGGGGGGG',
    '......hHGGGGGGGG',
    '.......hHGGGGGGG',
    '........hGGGGGGG',
    '.........hGGGGGG',
    '...........hGGGG',
    '.............hGG',
    '..............hG',
    '.............hGG',
    '..............hG',
    '...........RRRRR',
    '.........ttttttt',
    '.........bBBBBBB',
    '.........bBBpppp',
    '.........bBBPPPP',
    '.........bBBBBBB',
    '.........kkkkkkk',
  ];
  const swap: Record<string, string> = { H: 'G', h: 'g', b: 'k' };
  const rows = half.map(r => r.padEnd(16, '.')).map(r => r + [...r].reverse().map(c => swap[c] ?? c).join(''));
  return new Pix().stamp(rows).render({
    R: '#fff2a8', G: '#e8b730', H: '#fff6c8', h: '#f6d462', g: '#b88618', i: '#7a5208', S: '#fff0a0',
    t: '#a8744a', B: '#6b3f22', b: '#8f5a32', k: '#4a2a16', P: '#e8b730', p: '#fff2a8',
  }, '#2a1a06');
}

function skillArt() {
  const p = new Pix();
  // 리본 꼬리 두 갈래 → 금테 메달 → 별
  p.tube([[12.5, 20], [8.5, 29.5]], () => 2.1, l => tone(l, 'r', 'R', 'Q', 0.3));
  p.tube([[19.5, 20], [23.5, 29.5]], () => 2.1, l => tone(l, 'r', 'R', 'Q', 0.3));
  p.set(8, 30, '.').set(23, 30, '.');
  p.disc(16, 13.5, 11, (_dx, _dy, d, l) => d > 8.8 ? tone(l, 'y', 'Y', 'Z', 0.3) : tone(l, 'v', 'V', 'U', 0.45));
  const star = ['.....XX.....', '.....XX.....', '....XXXX....', 'XXXXXXXXXXXX', '.XXXXXXXXXX.', '..XXXXXXXX..', '...XXXXXX...', '...XXXXXX...', '..XXX..XXX..', '..XX....XX..', '.XX......XX.'];
  star.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') p.set(11 + x, 9 + y, 'U'); }));
  star.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') p.set(10 + x, 8 + y, x < 6 ? 'T' : 'S'); }));
  return p.render({ Y: '#e8bb3a', y: '#fff0a0', Z: '#a87a12', V: '#6a46a8', v: '#8f6ad0', U: '#3e2668', S: '#ffd84a', T: '#fff6c0', r: '#f07a8a', R: '#c43a50', Q: '#8a2438' }, '#1c1228');
}

function gearArt() {
  const p = new Pix();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - 16, dy = y + 0.5 - 16, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI + 360;
    const tooth = Math.abs(((a + 22.5) % 45) - 22.5) < 10;
    if (d > 10.4 && !(tooth && d <= 14)) continue;
    const l = -(dx + dy) / (SQ2 * Math.max(d, 1));
    // 안쪽 축 둘레는 움푹 들어가 밝기가 반대
    p.set(x, y, d < 4 ? '.' : d < 6.3 ? tone(-l, 'H', 'M', 'D', 0.3) : d < 7 ? 'D' : tone(l, 'H', 'M', 'D', 0.3));
  }
  return p.render({ H: '#e6eae6', M: '#a9b0ac', D: '#6d7571' }, '#24282a');
}

function mapArt() {
  const p = new Pix();
  // 세 쪽으로 접힌 지도: 가운데 쪽은 그늘
  p.box(3, 5, 9, 22, 'P').box(12, 6, 9, 22, 'P').box(21, 5, 9, 22, 'P');
  p.tube([[3, 12], [9, 14.5], [15, 11], [21, 16], [30, 18]], () => 1.3, l => tone(l, 'b', 'b', 'c', 0.5));
  p.tube([[9, 14.5], [13, 22], [12, 27]], () => 0.8, () => 'b');
  for (const [x, y] of [[5, 19], [7, 21], [5, 23], [24, 8], [26, 10], [27, 7]] as P2[]) p.box(x, y, 2, 2, 'g').set(x + 1, y + 1, 'G');
  for (const [x, y] of [[8, 25], [10, 24], [16, 24], [18, 23], [20, 22]] as P2[]) p.set(x, y, 'r');
  p.stamp(['X..X', '.XX.', '.XX.', 'X..X'], 22, 19);
  p.box(24, 22, 1, 1, 'X');
  // 가운데 쪽 그늘과 접힌 선
  for (let y = 0; y < N; y++) for (let x = 12; x < 21; x++) { const c = p.get(x, y); p.set(x, y, ({ P: 'p', b: 'c', g: 'G', r: 'R' } as Pal)[c] ?? null); }
  p.box(11, 5, 1, 22, 'f').box(21, 6, 1, 21, 'f');
  return p.render({ P: '#efe2b8', p: '#d6c592', b: '#5aa7ff', c: '#3f86d8', g: '#6aa84f', G: '#4f8a3a', r: '#c8402f', R: '#a03020', X: '#d0302a', f: '#b9a46e' }, '#2e2412');
}

function scrollArt() {
  const p = new Pix();
  // 종이 → 위아래 나무 축과 손잡이 → 글줄 → 붉은 도장
  p.box(7, 5, 18, 22, 'P').box(7, 5, 1, 22, 'h').box(24, 5, 1, 22, 'd').box(8, 6, 16, 1, 'd');
  const rod = (y: number) => {
    p.tube([[5, y], [27, y]], () => 1.5, l => tone(l, 'w', 'W', 'Q', 0.3));
    p.disc(4, y, 2, (_dx, _dy, _d, l) => tone(l, 'k', 'K', 'Q', 0.3)).disc(28, y, 2, (_dx, _dy, _d, l) => tone(l, 'k', 'K', 'Q', 0.3));
  };
  rod(4.5);
  rod(27.5);
  p.box(10, 9, 12, 1, 't');
  for (const [y, w] of [[12, 12], [14, 10], [16, 12], [18, 7]] as P2[]) p.box(10, y, w, 1, 'l');
  p.box(17, 20, 5, 4, 's').box(18, 21, 3, 2, 'S').set(19, 21, 's');
  return p.render({ P: '#efe2b8', h: '#fff4d4', d: '#cbb582', t: '#6b4a24', l: '#a08458', W: '#a8743e', w: '#d09a5a', Q: '#5e3a1a', K: '#7a4a22', k: '#a8743e', s: '#d0443a', S: '#f07a6a' }, '#2e1e0e');
}

function rulerArt() {
  const p = new Pix();
  // 계측자: 눈금판과 코 받침
  p.box(1, 20, 30, 8, 'Y').box(1, 20, 30, 1, 'y').box(1, 27, 30, 1, 'Z');
  for (let x = 4; x < 30; x++) if (x % 2 === 0) p.box(x, 21, 1, x % 6 === 0 ? 4 : 2, 'k');
  p.box(1, 13, 3, 15, 'W').box(1, 13, 1, 15, 'w').box(3, 13, 1, 7, 'V');
  // 잰 붕어
  p.oval(14, 14, 9.5, 4.6, (_dx, dy, _e, l) => dy > 2 ? 'b' : dy < -2.2 ? 'K' : tone(l, 'f', 'F', 'F', 0.35));
  for (let y = 11; y < 17; y++) for (let x = 9; x < 21; x++) if (p.get(x, y) === 'F' && (x + 2 * y) % 4 === 0) p.set(x, y, 's');
  for (let x = 23; x < 30; x++) for (let y = 8; y < 21; y++) if (Math.abs(y + 0.5 - 14) <= (x - 21.5) * 0.85 && !(x === 29 && Math.abs(y + 0.5 - 14) < 2)) p.set(x, y, x < 25 ? 'T' : 't');
  p.stamp(['...TTTT', '.TTTTTT', 'TTTTTTT'], 10, 7).stamp(['TT', '.TT'], 14, 19);
  p.box(7, 12, 2, 2, 'E').set(7, 12, 'e');
  return p.render({ Y: '#e9c440', y: '#fff09a', Z: '#a88320', k: '#5c4512', W: '#a8743e', w: '#d09a5a', V: '#7a5228',
    F: '#b8a45e', f: '#e2d39a', K: '#6f6230', b: '#efe6c4', s: '#958a4a', T: '#8a7a3e', t: '#6f6230', E: '#151515', e: '#ffffff' }, '#2a220c');
}

// ── 음식 ──

function riceballArt() {
  const p = new Pix();
  for (let y = 4; y < 28; y++) { const hw = Math.min(12, 1.5 + (y - 4) * 0.62); for (let x = Math.ceil(16 - hw); x < 16 + hw; x++) p.set(x, y, 'W'); }
  p.edge('W', 'V', 'v');
  for (let y = 6; y < 26; y++) for (let x = 5; x < 27; x++) if (p.get(x, y) === 'W' && (x * 7 + y * 3) % 11 === 0) p.set(x, y, 'v');
  for (let y = 18; y < 28; y++) for (let x = 9; x < 23; x++) if (p.get(x, y) !== '.') p.set(x, y, x < 11 ? 'n' : 'N');
  p.box(14, 18, 4, 10, 'R').box(14, 18, 1, 10, 'r');
  return p.render({ W: '#f6f3e8', V: '#ffffff', v: '#d8d2bf', N: '#1f2d22', n: '#3a5040', R: '#d8402f', r: '#f07a6a' }, '#1a1a16');
}

function kimbapArt() {
  const p = new Pix();
  const slice = (cx: number, cy: number, r: number) => {
    p.disc(cx, cy, r, (dx, _dy, d, l) => d > r - 1.4 ? tone(l, 'n', 'N', 'N', 0.4) : (Math.floor(d * 3 + dx) % 4 === 0 ? 'v' : 'W'));
    p.box(cx - 3, cy - 3, 3, 2, 'E').box(cx, cy - 3, 3, 2, 'G').box(cx - 3, cy - 1, 2, 3, 'O').box(cx - 1, cy - 1, 3, 2, 'K').box(cx + 1, cy + 1, 2, 2, 'Y');
  };
  slice(21, 11, 8);
  slice(12, 20, 9);
  return p.render({ N: '#1f2d22', n: '#3a5040', W: '#f6f3e8', v: '#d8d2bf', E: '#f2c84b', G: '#5d9c3c', O: '#e8853a', K: '#e88a9a', Y: '#e8d84a' }, '#101410');
}

function ramenArt() {
  const p = new Pix();
  for (let y = 9; y < 29; y++) { const hw = 11 - (y - 9) * 0.18; for (let x = Math.ceil(16 - hw); x < 16 + hw; x++) p.set(x, y, 'W'); }
  p.edge('W', 'V', 'v');
  for (let y = 13; y < 19; y++) for (let x = 0; x < N; x++) if (p.get(x, y) !== '.') p.set(x, y, y === 13 ? 'r' : 'R');
  for (const x of [10, 12, 15, 17, 19, 21]) p.set(x, 15, 'w').set(x, 16, 'w');
  p.box(4, 7, 24, 2, 'S').box(4, 7, 24, 1, 's').box(25, 5, 4, 3, 'S');
  p.tube([[11, 5], [10, 3], [11, 0]], () => 0.5, () => 'm').tube([[19, 5], [20, 3], [19, 0]], () => 0.5, () => 'm');
  return p.render({ W: '#ece6d4', V: '#ffffff', v: '#c9c2ac', R: '#c8402f', r: '#e8705a', w: '#ffe9a0', S: '#c9ced2', s: '#eef1f2', m: '#ffffff99' }, '#241a14', 'm');
}

/** 음료 캔: 은색 뚜껑, 둥근 몸통 명암 */
function canArt(body: string, art: string[], ink: string) {
  const p = new Pix();
  p.box(8, 5, 16, 24, 'B');
  for (let y = 5; y < 29; y++) p.set(8, y, 'b').set(9, y, 'h').set(10, y, 'h').set(22, y, 'd').set(23, y, 'D');
  p.box(9, 3, 14, 2, 'S').box(9, 3, 14, 1, 's').box(9, 29, 14, 1, 'S').box(14, 2, 4, 1, 'S');
  p.stamp(art, 11, 10);
  return p.render({ B: body, b: shade(body, 0.1), h: shade(body, 0.35), d: shade(body, -0.25), D: shade(body, -0.45), S: '#b9bec0', s: '#eef1f2', I: ink, i: shade(ink, 0.5), c: '#e8d7b0' }, '#16181a');
}

// ── 목록 ──

const ART: Record<string, () => string> = {
  rod: () => rodArt(), float: () => floatArt(FLOATS[0]), hook: () => hookArt(), line: () => spoolArt(), worm: wormArt, corn: cornArt, shrimp: shrimpArt, box: boxArt,
  riceball: riceballArt, kimbap: kimbapArt, ramen: ramenArt,
  coffee: () => canArt('#6a3f23', ['cccccccccc', 'cccIIIIccc', 'ccIiIIIIcc', 'ccIIIiIIcc', 'ccIIIIiIcc', 'cccIIIIccc', 'cccccccccc'], '#4a2a14'),
  energy: () => canArt('#2f5fc0', ['.....II', '....II.', '...II..', '..IIIII', '....II.', '...II..', '..II...', '.II....'], '#ffe14d'),
  net: netArt, keepnet: keepnetArt, coin: coinArt, lock: lockArt,
  clear: sunArt, moon: moonArt, cloudy: cloudyArt, rain: rainArt, fog: fogArt,
  bag: bagArt, shop: shopArt, book: () => bookArt('#3f7a46'), trophy: trophyArt, scroll: scrollArt, skill: skillArt,
  gear: gearArt, map: mapArt, rig: rigArt, ruler: rulerArt, sinker: sinkerArt,
};
const cache = new Map<string, string>();
const cached = (key: string, make: () => string) => { let s = cache.get(key); if (!s) cache.set(key, s = svg(make())); return s; };

export function itemIcon(id: string, variant?: string): string {
  if (id === 'rod') return cached(`rod:${variant ?? ''}`, () => rodArt(variant));
  const fl = id === 'float' && variant ? FLOATS.find(f => f.id === variant) : undefined;
  if (fl) return cached(`float:${fl.id}`, () => floatArt(fl));
  const ln = id === 'line' && variant ? LINES.find(l => l.id === variant) : undefined;
  if (ln) return cached(`line:${ln.material}:${productModel(ln.name)}`, () => spoolArt(ln));
  const hk = id === 'hook' && variant ? HOOKS.find(h => h.id === variant) : undefined;
  if (hk) return cached(`hook:${hk.id}`, () => hookArt(hk));
  if (ART[id]) return cached(id, ART[id]);
  if (SACK_COLORS[id]) return cached(id, () => sackArt(SACK_COLORS[id]));
  return cached(`bag:${id}`, () => baitBagArt(BAG_COLORS[id] ?? ['#7d8a80', '#e8c25a', '#aaa17f']));
}

/** 도감 아이콘도 3D 물고기와 같은 단면·색·무늬를 사용한다. */
/** 어종 도트 그림(game/fishArt.ts)을 그대로 그린다. 3D 모델과 같은 무늬다. */
export function fishIcon(look: FishLook): string {
  const { cols, rows } = artSize(look);
  let blocks = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = cellAt(look, c, r);
    if (ch === '.') continue;
    const [cr, cg, cb] = cellColor(look, ch, c, r);
    blocks += rect(c, r, 1, 1, `rgb(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)})`);
  }
  return svg(blocks, `-1 -1 ${cols + 2} ${rows + 2}`);
}

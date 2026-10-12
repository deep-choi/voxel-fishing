import { artSize, cellAt, cellColor, type FishLook } from '../game/fishArt';

const svg = (body: string, box = '0 0 16 16') => `<svg viewBox="${box}" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${body}</svg>`;
const rect = (x: number, y: number, w: number, h: number, color: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
const icons: Record<string, string> = {
  rod: '<path d="M2 14L12 2H14L4 14Z" fill="#bd8b4b"/><path d="M2 14L5 10H7L4 14Z" fill="#3a4542"/><path d="M13 3V10H12V4Z" fill="#d9d8ba"/>',
  float: rect(7, 1, 2, 3, '#e86c42') + rect(7, 4, 2, 3, '#edda77') + rect(5, 7, 6, 5, '#9b5733') + rect(7, 12, 2, 3, '#e5d8b7'),
  hook: '<path d="M10 1H12V10H10V12H5V10H3V7H5V9H7V10H10Z" fill="#d4dedb"/>',
  line: rect(3, 3, 10, 10, '#807b66') + rect(4, 4, 8, 8, '#d4d6bd') + rect(7, 6, 2, 4, '#555d55'),
  worm: '<path d="M2 4H9V6H5V8H12V10H5V12H2V10H3V8H2V6H7V5H2Z" fill="#d9897c"/>',
  corn: rect(5, 2, 6, 11, '#eec95b') + rect(6, 3, 1, 9, '#ffe799') + rect(9, 3, 1, 9, '#bb9533') + '<path d="M2 7H4V10H6V14H10V10H12V7H14V11H12V14H4V11H2Z" fill="#789447"/>',
  shrimp: '<path d="M11 2H14V4H9V6H6V9H8V11H12V13H7V11H4V5H6V3H11Z" fill="#d9ac8a"/>' + rect(11, 2, 1, 1, '#2e302b') + rect(12, 4, 1, 4, '#debfa3'),
  box: rect(3, 4, 10, 10, '#99784b') + rect(2, 2, 12, 3, '#c7a975') + rect(7, 3, 2, 10, '#d9c698'),
  // 음식
  riceball: '<path d="M8 2H9V4H10V6H11V8H12V10H13V13H3V10H4V8H5V6H6V4H7V2Z" fill="#f4f1e6"/>' + rect(5, 10, 6, 3, '#1f2d22') + rect(7, 5, 1, 1, '#d8d2bf'),
  kimbap: rect(2, 4, 12, 9, '#1f2d22') + rect(3, 5, 10, 7, '#f1ede0') + rect(5, 7, 2, 2, '#e9a23a') + rect(8, 7, 2, 2, '#5d9c3c') + rect(7, 9, 2, 2, '#d0503b'),
  ramen: rect(3, 5, 10, 9, '#ece6d4') + rect(3, 5, 10, 2, '#c8402f') + rect(4, 9, 8, 1, '#c8402f') + rect(5, 1, 1, 3, '#ffffff88') + rect(9, 2, 1, 2, '#ffffff88'),
  coffee: rect(5, 2, 6, 12, '#6a3f23') + rect(5, 5, 6, 5, '#e8d7b0') + rect(6, 1, 4, 1, '#b9b9b0') + rect(7, 6, 2, 3, '#6a3f23'),
  energy: rect(5, 2, 6, 12, '#2f5fc0') + rect(6, 1, 4, 1, '#b9b9b0') + '<path d="M9 4H10L8 8H10L7 12H6L8 9H6Z" fill="#ffe14d"/>',
  // 장비
  net: '<path d="M1 15L7 9H8L2 15Z" fill="#a8763f"/>' + rect(7, 2, 8, 2, '#d0d6d2') + rect(7, 8, 8, 2, '#d0d6d2') + rect(7, 2, 2, 8, '#d0d6d2') + rect(13, 2, 2, 8, '#d0d6d2') + rect(9, 4, 4, 4, '#4f6b5c') + rect(10, 5, 1, 1, '#d0d6d2') + rect(11, 6, 1, 1, '#d0d6d2'),
  keepnet: rect(4, 1, 8, 2, '#c9cfb9') + rect(3, 4, 10, 2, '#5f7a5a') + rect(3, 7, 10, 2, '#5f7a5a') + rect(4, 10, 8, 2, '#5f7a5a') + rect(5, 13, 6, 2, '#5f7a5a') + rect(7, 3, 2, 12, '#3d5240'),
  coin: rect(5, 2, 6, 12, '#e7b93a') + rect(3, 4, 10, 8, '#e7b93a') + rect(6, 4, 4, 8, '#ffd96a') + rect(7, 5, 2, 6, '#b8861f'),
  lock: rect(4, 7, 8, 7, '#d8b44a') + rect(5, 3, 6, 2, '#c5c8c0') + rect(5, 3, 2, 5, '#c5c8c0') + rect(9, 3, 2, 5, '#c5c8c0') + rect(7, 9, 2, 3, '#5c4512'),
  // 날씨
  clear: rect(6, 6, 4, 4, '#ffd34d') + rect(5, 7, 6, 2, '#ffd34d') + rect(7, 5, 2, 6, '#ffd34d') + rect(7, 1, 2, 2, '#ffb83a') + rect(7, 13, 2, 2, '#ffb83a') + rect(1, 7, 2, 2, '#ffb83a') + rect(13, 7, 2, 2, '#ffb83a') + rect(3, 3, 2, 2, '#ffb83a') + rect(11, 11, 2, 2, '#ffb83a') + rect(11, 3, 2, 2, '#ffb83a') + rect(3, 11, 2, 2, '#ffb83a'),
  moon: '<path d="M6 2H10V3H8V5H7V11H8V12H10V13H12V14H6V13H4V11H3V5H4V3H6Z" fill="#f2ecc4"/>',
  cloudy: rect(3, 7, 11, 5, '#e3e6e3') + rect(5, 5, 5, 2, '#e3e6e3') + rect(9, 6, 3, 1, '#e3e6e3') + rect(3, 11, 11, 1, '#aab0ab'),
  rain: rect(3, 4, 11, 5, '#b9bec0') + rect(5, 2, 5, 2, '#b9bec0') + rect(4, 11, 1, 2, '#5aa7ff') + rect(7, 12, 1, 2, '#5aa7ff') + rect(10, 11, 1, 2, '#5aa7ff') + rect(13, 12, 1, 2, '#5aa7ff'),
  fog: rect(2, 4, 12, 1, '#d6dad6') + rect(4, 7, 11, 1, '#c2c7c3') + rect(1, 10, 11, 1, '#d6dad6') + rect(5, 13, 9, 1, '#c2c7c3'),
  // 메뉴
  bag: rect(3, 4, 10, 11, '#8b5a2e') + rect(5, 2, 6, 2, '#6b4120') + rect(4, 7, 8, 4, '#a8733e') + rect(7, 8, 2, 2, '#e3c26b'),
  shop: rect(2, 2, 12, 4, '#c8402f') + rect(2, 2, 2, 4, '#f1ede0') + rect(6, 2, 2, 4, '#f1ede0') + rect(10, 2, 2, 4, '#f1ede0') + rect(3, 6, 10, 8, '#a8733e') + rect(6, 9, 4, 5, '#5c3a1c'),
  book: rect(3, 2, 10, 12, '#3f6d3a') + rect(4, 3, 8, 10, '#5f9a50') + rect(3, 2, 2, 12, '#2b4b28') + rect(7, 6, 4, 3, '#f1ede0'),
  trophy: rect(4, 2, 8, 6, '#e7b93a') + rect(2, 3, 2, 3, '#e7b93a') + rect(12, 3, 2, 3, '#e7b93a') + rect(7, 8, 2, 3, '#c7951f') + rect(5, 11, 6, 3, '#8b5a2e') + rect(6, 3, 2, 3, '#ffe38a'),
  scroll: rect(3, 2, 10, 12, '#e9dcb0') + rect(2, 2, 12, 2, '#b98d4c') + rect(2, 12, 12, 2, '#b98d4c') + rect(5, 5, 6, 1, '#7a6440') + rect(5, 7, 6, 1, '#7a6440') + rect(5, 9, 4, 1, '#7a6440'),
  skill: rect(3, 2, 10, 12, '#5a3f8c') + rect(4, 3, 8, 10, '#7b5bb5') + '<path d="M8 4L9 7H12L10 9L11 12L8 10L5 12L6 9L4 7H7Z" fill="#ffe14d"/>',
  gear: rect(6, 1, 4, 14, '#aeb3ad') + rect(1, 6, 14, 4, '#aeb3ad') + rect(3, 3, 10, 10, '#aeb3ad') + rect(6, 6, 4, 4, '#3f4540'),
  map: rect(2, 3, 12, 10, '#e9dcb0') + rect(5, 3, 1, 10, '#c7b88a') + rect(10, 3, 1, 10, '#c7b88a') + rect(6, 7, 4, 3, '#5aa7ff') + rect(12, 5, 1, 1, '#c8402f'),
  rig: rect(7, 1, 2, 3, '#e86c42') + rect(7, 4, 2, 2, '#edda77') + rect(6, 6, 4, 4, '#9b5733') + rect(7, 10, 1, 3, '#d4d6bd') + '<path d="M8 12H9V15H6V14H8Z" fill="#d4dedb"/>',
  ruler: rect(1, 5, 14, 6, '#e9c440') + rect(1, 10, 14, 1, '#a88320') + rect(3, 5, 1, 3, '#5c4512') + rect(6, 5, 1, 2, '#5c4512') + rect(9, 5, 1, 3, '#5c4512') + rect(12, 5, 1, 2, '#5c4512'),
  sinker: rect(6, 3, 4, 2, '#8d9290') + rect(5, 5, 6, 7, '#6d7270') + rect(6, 12, 4, 1, '#6d7270') + rect(6, 6, 2, 3, '#a9aeac'),
};
/** 등급별 낚싯대 손잡이 색 */
const ROD_GRIP: Record<string, string> = { light: '#7a8b4a', long: '#5a7fb5', power: '#2f3b2f', carbon: '#2a2a33', legend: '#b5862e', memphis: '#5a6951', grand: '#2d796b', gold: '#d1a94d', mugung: '#824b74' };
export function itemIcon(id: string, variant?: string): string {
  if (id === 'rod' && variant && ROD_GRIP[variant]) return svg(icons.rod.replace('#3a4542', ROD_GRIP[variant]));
  if (icons[id]) return svg(icons[id]);
  const colors: Record<string, string> = { paste: '#b39157', gluten: '#e2d9b4', pellet: '#876043', chum: '#9a834b',
    bran: '#ac925a', cornmeal: '#d8b857', attractor: '#c08c77', fishmeal: '#987353', glutenpowder: '#ece0b8' };
  const color = colors[id] ?? '#aaa17f';
  return svg(rect(3, 3, 10, 11, '#c4b990') + rect(4, 5, 8, 8, color) + rect(5, 6, 2, 2, '#f0e0b0') + rect(9, 10, 2, 2, '#5c5138') + rect(5, 1, 6, 2, '#6e8050'));
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

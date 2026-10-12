import type { SpeciesId } from './data';

// 물고기 디자인: 어종마다 옆모습을 도트로 찍은 그림 한 장.
// 3D 복셀 모델(render/voxelFishModel.ts)은 이 그림을 몸 두께만큼 쌓고, 도감 아이콘은 그대로 그린다.
// 머리가 왼쪽이다. 글자 하나가 한 칸이다.
//
//  몸통  B 등  S 옆구리  W 배  D 무늬  d 옅은 무늬  L 반짝이는 비늘  O 강조색(가슴 주황 등)
//        G 아가미 선  E 눈  K 눈동자  M 입  P 가슴지느러미(몸 옆에 붙는다)
//  밖    F 등·꼬리지느러미  f 배·뒷지느러미  R 수염  . 빈칸

export interface FishColors {
  back: string; side: string; belly: string; fin: string; finLow: string; eye: string;
  mark?: string; accent?: string; shine?: string; barbel?: string;
}
export interface FishLook {
  art: string[];
  colors: FishColors;
  /** 위에서 본 몸 반폭 (칸): [열, 반폭] 사이를 잇는다 */
  width: [number, number][];
  /** 비늘 격자 세기 (0~1) */
  scales?: number;
  /** 얼룩 세기 (0~1): 메기·가물치처럼 비늘 없는 몸 */
  mottle?: number;
}

const crucian: FishLook = {
  art: [
    '..........FFFF',
    '.........FFFFFFFF',
    '.......BBBBBBBBBBBFF',
    '.....BBBBBBBBBBBBBBBB.......FF',
    '....BBSSSSSSSSSSSSSSSBB....FFF',
    '...BBSSSSSSSSSSSSSSSSSSBB.FFFF',
    '..BEKGSSSSSSSSSSSSSSSSSSBBFFF.',
    '.MSSSGSSSSSSSSSSSSSSSSSSSSFF..',
    '..WSSGSSSSSSSSSSSSSSSSSSSSFFF.',
    '...WWPPSSSSSSSSSSSSSSSSWW.FFFF',
    '....WWPPWWWWWWWWWWWWWWW....FFF',
    '.....WWWWWWWWWWWWWWWWW......FF',
    '........ff.....fff',
    '.........f......f',
  ],
  colors: { back: '#3d3a22', side: '#a88f4e', belly: '#e2d3a2', fin: '#6e5c3c', finLow: '#7e6640', eye: '#e2bc4e' },
  width: [[0, 1.5], [4, 2.4], [10, 3.6], [16, 3.3], [22, 1.8], [25, 1.2]],
  scales: 0.9,
};

const carp: FishLook = {
  art: [
    '............FFF',
    '...........FFFFFFFFFFF',
    '........BBBBBBBBBBBBBBBFF',
    '......BBBBBBBBBBBBBBBBBBB......FFF',
    '....BBSSSSSSSSSSSSSSSSSSBBB...FFFF',
    '...BEKGSSSSSSSSSSSSSSSSSSSBB.FFFF',
    '.MSSSSGSSSSSSSSSSSSSSSSSSSSSSFFF',
    '.RWSSSGSSSSSSSSSSSSSSSSSSSSSSFF',
    'R..WWPPSSSSSSSSSSSSSSSSSSSWW.ffff',
    '....WWPPWWWWWWWWWWWWWWWWW....ffff',
    '......WWWWWWWWWWWWWWWWWW.......ff',
    '........ff......ffff',
    '.........f.......ff',
  ],
  colors: { back: '#3e3620', side: '#b08a44', belly: '#e0cb90', fin: '#5b4a30', finLow: '#b8603a', eye: '#d8b24e', barbel: '#c9b080' },
  width: [[1, 1.8], [5, 3], [12, 3.9], [20, 3.3], [26, 1.8], [28, 1.2]],
  scales: 1,
};

// 향어(이스라엘잉어): 잉어 몸에 큰 비늘이 등선과 옆줄에만 드문드문 있다.
const mirror: FishLook = {
  ...carp,
  art: carp.art.map((row, i) => i === 4 ? '....BBLLSSLLLSSSLLSSSSSSBBB...FFFF'
    : i === 5 ? '...BEKGSLLSSSSLLSSSSSSSSSBB.FFFF'
    : i === 7 ? '.RWSSSGSSLLSSSLLLSSSSLLSSSSSSFF' : row),
  colors: { ...carp.colors, back: '#3a3c27', side: '#9c8c58', belly: '#ddd0a0', shine: '#e2c25e', finLow: '#a0603c' },
  scales: 0,
};

const bluegill: FishLook = {
  art: [
    '.......FFFFFFFF',
    '.....FFFFFFFFFFFFF',
    '....BBBBBBBBBBBBBBFF',
    '...BBBBBBBBBBBBBBBBB.....F',
    '..BBSSSSSSdSSSdSSdBB...FFF',
    '..BEKSSSSSdSSSdSSdSSB.FFFF',
    '.BSSSDDSSSdSSSdSSdSSSSFFF.',
    'MSSSSDDSSSdSSSdSSdSSSSFF..',
    '.OSSSDDSSSdSSSdSSdSSSSFFF.',
    '.OOOPPSSSSdSSSdSSdSW..FFFF',
    '..OOOPPWWWdWWWdWWdW...FFF.',
    '...OOOWWWWWWWWWWWW.....FF',
    '.....fWWWWWWWWWWff',
    '......f..fffffff',
  ],
  colors: { back: '#2f4030', side: '#6f7d55', belly: '#d8c991', mark: '#1a2018', accent: '#e08a34', fin: '#3d4834', finLow: '#52563a', eye: '#3a2a1a' },
  width: [[0, 1.2], [4, 2.1], [10, 2.7], [16, 2.1], [20, 1.2]],
  scales: 0.4,
};

const catfish: FishLook = {
  art: [
    '..............FFF',
    '.........BBBBBBBBBBBB',
    'R....BBBBBBBBBBBBBBBBBBBBBBBBBBB',
    '.R.BBEKBBBBBBBBBBBBBBBBBBBBBBBBBBBB..FF',
    '..MSSSGSSSSSSSSSSSSSSSSSSSSSSSSSSSSFFFF',
    '..MWWWGPPSSSSSSSSSSSSSSSSSSSSSSSSSSFFFF',
    '.R..WWWPPWWWWWWWWWWWWWWWWWWWWWWWWWfFFF',
    'R....WWWWWWWWWWWfffffffffffffffffffFF',
    '..........ff.....fffffffffffffffff',
  ],
  colors: { back: '#3d443c', side: '#76806c', belly: '#dcd9b8', fin: '#5a6658', finLow: '#7d8975', eye: '#d6c452', barbel: '#4a5046' },
  width: [[2, 3.9], [6, 4.5], [12, 3.9], [22, 2.7], [30, 1.5], [34, 0.9]],
  mottle: 0.45,
};

const yellowcat: FishLook = {
  art: [
    '........F',
    '.......FFF',
    '......FFFF.........BBB',
    '....BBBBBBBBBBBBBBBBBBBB.....FF',
    '.R.BEKBDDDBBBBBDDDDBBBBBBB..FFF',
    '..MSSSGDDDSSSSSDDDDSSSSDDSSFFF',
    '.RMSSSGSDDSSSSSSDDSSSSSDDSSFF',
    'R.WWWWPPWWWWWWWWWWWWSSSSSSSFFF',
    '.R..WWPPWWWWWWWWWWWWW.......FFF',
    '.......ff.....ffffffff.......FF',
  ],
  colors: { back: '#6a5226', side: '#c9a23e', belly: '#ecdc90', mark: '#3b2a16', fin: '#8a6a30', finLow: '#b08a40', eye: '#2a2016', barbel: '#d8c27a' },
  width: [[2, 3], [6, 3.6], [12, 3], [20, 2.1], [26, 1]],
};

const snakehead: FishLook = {
  art: [
    '.........FFFFFFFFFFFFFFFFFFFFFFFFFF',
    '.....BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBFF',
    '..BBEKBDDBBBDDDBBBDDDBBBDDDBBBDDBBBBFFFF',
    '.MSSSGSDDSSSDDDSSSDDDSSSDDDSSSDDSSSSFFFF',
    'MSSSSGSSSDDSSSSDDSSSSDDSSSSDDSSSSSSSFFFF',
    '.MWWWGPPWWWWWWWWWWWWWWWWWWWWWWWWWWWWFFFF',
    '..WWWWPPWWWWWWWWWWWWWWWWWWWWWWWWWWWWFFF',
    '....WWWWWWWWffffffffffffffffffffffffFF',
    '...........ffffffffffffffffffffff',
  ],
  colors: { back: '#33452f', side: '#7d8a52', belly: '#d8d2a4', mark: '#1e281c', fin: '#4e6440', finLow: '#717a52', eye: '#d89a3e' },
  width: [[1, 2.4], [5, 3.3], [15, 3.3], [28, 2.4], [35, 1.5]],
  mottle: 0.15,
};

const mandarin: FishLook = {
  art: [
    '..........F.F.F.FFFF',
    '.........FFFFFFFFFFFFF',
    '.......BBBBBBBBBBBBBBBFFF',
    '.....BBBBDBBBBDBBBBDBBBB....FF',
    '...BBBDSSSSDDSSSSDSSSDSSBB.FFF',
    '..BEKGSSDDSSSSDDSSSSDDSSSSBFFFF',
    '.MSSSGSSDDSSSSDSSSDDSSSDSSSFFFF',
    'MMSSSGDSSSSDDSSSSSSSSDDSSSSFFFF',
    '.MWWWPPWWDWWWWWWDWWWWWWWWWSFFFF',
    '..WWWPPWWWWWWWWWWWWWWWW....FFF',
    '....WWWWWWWWWWWWWWWWWW.....FF',
    '......ff......fffffff',
  ],
  colors: { back: '#5a4a26', side: '#c8a650', belly: '#ece0b0', mark: '#2a2014', fin: '#8c7038', finLow: '#a8884a', eye: '#c8963a' },
  width: [[0, 1.8], [4, 2.7], [10, 3.3], [18, 2.7], [25, 1.5], [27, 1]],
  scales: 0.3,
};

const bass: FishLook = {
  art: [
    '.........FFFF...FFF',
    '........FFFFFF..FFFFFF',
    '......BBBBBBBBBBBBBBBBBBB',
    '....BBBBBBBBBBBBBBBBBBBBBB...FF',
    '..BBEKBSSSSSSSSSSSSSSSSSSBB..FFF',
    '.BSSSGSSSSSSSSSSSSSSSSSSSSSBFFFF',
    'MMMMMGDDDSDDDDSDDDSDDDDSDDSSFFF',
    '.MWWWGWWSSSSSSSSSSSSSSSSSSSSFF',
    '..WWWPPWWWWWWWWWWWWWWWWWWS...FFF',
    '...WWPPWWWWWWWWWWWWWWWW......FFF',
    '.....WWWWWWWWWWWWWWW..........FF',
    '........ff....ffffff',
  ],
  colors: { back: '#2c4a2a', side: '#8aa660', belly: '#e6e4c8', mark: '#25361f', fin: '#5b7444', finLow: '#9ca36e', eye: '#c0802a' },
  width: [[0, 2.1], [5, 3], [12, 3.6], [20, 2.7], [26, 1.5], [28, 1]],
  scales: 0.5,
};

// 떡붕어는 머리 뒤가 높고 납작하며 꼬리 쪽으로 급격히 좁아진다.
const hera: FishLook = {
  art: [
    '.......FFFF',
    '......FFFFFFFF',
    '.....BBBBBBBBBBFF',
    '....BBBBBBBBBBBBBFF',
    '...BBSSSSSSSSSSSSSBB',
    '..BBSSSSSSSSSSSSSSSSB.......FF',
    '..BEKGSSSSSSSSSSSSSSSBB...FFFF',
    '.MSSSGSSSSSSSSSSSSSSSSSB.FFFFF',
    '..WSSGSSSSSSSSSSSSSSSSSSSFFF',
    '...WPPSSSSSSSSSSSSSSSSSSSFF',
    '...WWPPSSSSSSSSSSSSSSSSW.FFFF',
    '....WWWWSSSSSSSSSSSSWWW...FFF',
    '.....WWWWWWWWWWWWWWW.......FF',
    '......WWWWWWWWWWWW',
    '........ff....fff',
    '.........f.....f',
  ],
  colors: { back: '#606d67', side: '#bdc5b4', belly: '#edf0d9', fin: '#738179', finLow: '#909486', eye: '#e2d88c', shine: '#f4f5df' },
  width: [[1, 1.1], [5, 1.9], [10, 2.9], [16, 2.5], [22, 1.35], [25, 0.8]], scales: 0.85,
};
// 누치: 길고 낮은 몸, 아래로 향한 입과 작은 수염, 뚜렷한 꼬리 갈래.
const nuchi: FishLook = {
  art: [
    '..............FFF',
    '.............FFFFF',
    '.........BBBBBBBBBBBBB',
    '.....BBBBBBBBBBBBBBBBBBBBB......FF',
    '..BBEKGSSSSSSSSSSSSSSSSSSSSBB..FFFF',
    '.BSSSSGSSSSSSSSSSSSSSSSSSSSSSSFFFF',
    '..MWWWGPPSSSSSSSSSSSSSSSSSSSSSSFF',
    '.R..WWPPWWWWWWWWWWWWWWWWWWWW..FFFF',
    '......WWWWWWWWWWWWWWWWWW.......FF',
    '.........ff........fff',
  ],
  colors: { back: '#555c4b', side: '#aaa98a', belly: '#e3e0c9', fin: '#6c7059', finLow: '#969471', eye: '#d8c365', barbel: '#c5b78e' },
  width: [[1, 1.1], [5, 2], [12, 2.8], [21, 2.3], [27, 1.2], [30, 0.7]], scales: 0.75,
};
// 관상 품종은 흰 몸·붉은 반점 외에도 긴 몸통과 넓은 꼬리로 구별한다.
const koi: FishLook = {
  art: [
    '...............FFFF',
    '............FFFFFFFFFFF',
    '........BBBBBOOOBBBBBBBB',
    '.....BBSSSOOOOOSSSSSSSSSBB.......FFF',
    '...BBSSSSSOOOOOSSSOOOSSSSSBB....FFFF',
    '..BEKGSSSSSSSSSSSSOOOOSSSSSSB..FFFFF',
    '.MSSSGSSSOOOSSSSSSOOOOSSSSSSSSSFFFF',
    '.RWSSGSSSOOOSSSSSSSSSSSSOOOSSSSFF',
    'R..WWPPSSSSSSSSSSSSSSSSSOOOSWW.FFFF',
    '....WWPPWWWWWWWWWWWWWWWWWWWWW...FFFF',
    '......WWWWWWWWWWWWWWWWWWW........FFF',
    '.........ff........ffff',
  ],
  colors: { back: '#dedbce', side: '#f4eee0', belly: '#fff5dc', accent: '#d7472e', fin: '#d8c9b4', finLow: '#e4d3b8', eye: '#d3a767', barbel: '#e7ddc7' },
  width: [[1, 1.6], [5, 2.6], [12, 3.7], [23, 3.1], [29, 1.5], [31, 1]], scales: 0.5,
};
// 가죽잉어: 두껍고 높은 몸, 매끈한 옆구리, 등선에만 남은 비늘.
const leather: FishLook = {
  art: [
    '...........FFFFF',
    '.........FFFFFFFFFFFF',
    '.......BBBBBBBBBBBBBBB',
    '.....BBBBBLLBBLBBBBBBBBBB',
    '....BBSSSSSSSSSSSSSSSSSSSBB.....FF',
    '...BBSSSSSSSSSSSSSSSSSSSSSSBB..FFF',
    '..BEKGSSSSSSSSSSSSSSSSSSSSSSB.FFFF',
    '.MSSSGSSSSSSSSSSSSSSSSSSSSSSSSFFF',
    '.RWSSGSSSSSSSSSSSSSSSSSSSSSSSSFF',
    'R..WWPPSSSSSSSSSSSSSSSSSSSSSS.FFFF',
    '...WWWPPSSSSSSSSSSSSSSSSSSWW...FFF',
    '....WWWWWWWWWWWWWWWWWWWWWW......FF',
    '......WWWWWWWWWWWWWWWWWW',
    '.........ff.......ffff',
  ],
  colors: { back: '#464a31', side: '#8c895b', belly: '#d2c998', fin: '#595b3c', finLow: '#8b7546', eye: '#d6b75c', shine: '#b4a76b', barbel: '#bcb080' },
  width: [[1, 1.8], [5, 3.3], [12, 4.7], [21, 3.8], [27, 1.8], [29, 1.15]], scales: 0, mottle: 0.08,
};
// 육종향어: 높고 둥근 체형을 별도 실루엣으로 만들고 큰 비늘은 적게 남긴다.
const bredmirror: FishLook = {
  art: [
    '.........FFFFF',
    '.......FFFFFFFFFFF',
    '......BBBBBBBBBBBBB',
    '.....BBBBBBBBBBBBBBBB',
    '....BBSSSSSSSSSSSSSSSBB',
    '...BBSSSSSSSSSSSSSSSSSSB.....FF',
    '..BBSSSSSSSSSSSSSSSSSSSSB...FFF',
    '..BEKGSSSSSSSSSSSSSSSSSSSB.FFFF',
    '.MSSSGSSLSSSSSSSSSSSSSSSSSSFFF',
    '.RWSSGSSSSSSSSSLSSSSSSSSSSSFF',
    'R..WWPPSSSSSSSSSSSSSSSSSSS.FFFF',
    '...WWWPPSSSSSSSSSSSSSSSSW...FFF',
    '....WWWWSSSSSSSSSSSSWWWW.....FF',
    '.....WWWWWWWWWWWWWWWWW',
    '......WWWWWWWWWWWWWW',
    '.........ff.....fff',
  ],
  colors: { back: '#4a4432', side: '#a79363', belly: '#e0c997', fin: '#6a5b3b', finLow: '#987448', eye: '#dcb553', shine: '#cfb370', barbel: '#c9b082' },
  width: [[1, 1.9], [5, 3.6], [11, 5.1], [18, 4.6], [24, 2.2], [27, 1.15]], scales: 0,
};
// 초어: 길고 원통형인 몸, 낮고 짧은 등지느러미, 수염 없는 머리.
const grasscarp: FishLook = {
  art: [
    '..................FFF',
    '.................FFFFF',
    '.........BBBBBBBBBBBBBBBBBBBB',
    '.....BBBBBBBBBBBBBBBBBBBBBBBBBBB......FF',
    '..BBEKGSSSSSSSSSSSSSSSSSSSSSSSSSBB...FFF',
    '.MSSSSGSSSSSSSSSSSSSSSSSSSSSSSSSSSS.FFFF',
    '..WSSSGSSSSSSSSSSSSSSSSSSSSSSSSSSSSSFFF',
    '...WWPPSSSSSSSSSSSSSSSSSSSSSSSSSSSSSFF',
    '....WWPPWWWWWWWWWWWWWWWWWWWWWWWWWW.FFFF',
    '.......WWWWWWWWWWWWWWWWWWWWWWWW....FFF',
    '...........ff...........fff..........FF',
  ],
  colors: { back: '#4c6147', side: '#a5ac7c', belly: '#e2e1bc', fin: '#657253', finLow: '#a49c6b', eye: '#d0bb58' },
  width: [[1, 1.8], [6, 3], [15, 3.6], [25, 3.2], [32, 1.8], [35, 0.9]], scales: 1,
};

export const FISH_LOOKS: Record<SpeciesId, FishLook> = { crucian, carp, mirror, bluegill, catfish, yellowcat, snakehead, mandarin, bass, hera, nuchi, koi, leather, bredmirror, grasscarp };

/** 몸통 칸 (두께만큼 쌓는다) */
export const BODY_CELLS = 'BSWDdLOGEKMP';
export const FIN_CELLS = 'Ff';

export function cellAt(look: FishLook, c: number, r: number) { return look.art[r]?.[c] ?? '.'; }
export function artSize(look: FishLook) {
  return { cols: Math.max(...look.art.map(row => row.replace(/\.+$/, '').length)), rows: look.art.length };
}
export function halfWidth(look: FishLook, c: number) {
  const w = look.width;
  if (c <= w[0][0]) return w[0][1];
  for (let i = 1; i < w.length; i++) if (c <= w[i][0]) {
    const t = (c - w[i - 1][0]) / (w[i][0] - w[i - 1][0]);
    return w[i - 1][1] + (w[i][1] - w[i - 1][1]) * t;
  }
  return w[w.length - 1][1];
}

const hash = (c: number, r: number) => (((c * 73856093) ^ (r * 19349663)) >>> 0) % 1000 / 1000;
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
const mul = (c: [number, number, number], k: number): [number, number, number] => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];

/** 칸 하나의 색 (sRGB 0~1). 비늘 격자·얼룩·도트 잡음을 여기서 더해 3D와 아이콘이 같은 무늬를 쓴다. */
export function cellColor(look: FishLook, ch: string, c: number, r: number): [number, number, number] {
  const k = look.colors;
  const side = rgb(k.side);
  let col: [number, number, number];
  switch (ch) {
    case 'B': col = rgb(k.back); break;
    case 'W': col = rgb(k.belly); break;
    case 'D': col = rgb(k.mark ?? k.back); break;
    case 'd': col = mul(side, 0.74); break;
    case 'L': col = rgb(k.shine ?? k.side); break;
    case 'O': col = rgb(k.accent ?? k.belly); break;
    case 'G': col = mul(side, 0.7); break;
    case 'E': col = rgb(k.eye); break;
    case 'K': return [0.05, 0.06, 0.06];
    case 'M': return [0.17, 0.12, 0.1];
    case 'F': col = mul(rgb(k.fin), c % 2 ? 0.86 : 1); break;
    case 'f': case 'P': col = mul(rgb(k.finLow), c % 2 ? 0.88 : 1); break;
    case 'R': col = rgb(k.barbel ?? k.belly); break;
    default: col = side;
  }
  if ('BSW'.includes(ch)) {
    if (look.scales) {
      // 엇갈린 비늘: 두 줄마다 반 칸씩 밀린 밝은 점과 그 아래 어두운 테두리
      const q = (c + (r >> 1) * 2) % 4;
      if (r % 2 === 0 && q === 0) col = mul(col, 1 + 0.16 * look.scales);
      else if (r % 2 === 1 && q === 1) col = mul(col, 1 - 0.12 * look.scales);
    }
    if (look.mottle && ch !== 'W' && Math.sin(c * 0.9 + r * 0.35) * Math.sin(c * 0.37 - r * 1.1 + 1.7) > 0.3 - look.mottle * 0.15) col = mul(col, 0.62);
  }
  return mul(col, 0.94 + hash(c, r) * 0.1);
}

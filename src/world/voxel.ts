import * as THREE from 'three';
import { heightAt, SEAT, shoreDistance } from './lake';
import { fbm, mulberry } from './noise';
import { ACTIVE_FISHERY } from '../game/fisheries';

// 스타일 비교용 샘플: 마인크래프트풍 복셀 지형과 나무.
// 블록 기둥 하나 = 상자 하나(세로로 늘림). 블록 경계와 도트 무늬는 셰이더가 월드 좌표로 그린다.

const C = {
  grass: new THREE.Color(ACTIVE_FISHERY.palette.grass),
  dirt: new THREE.Color(ACTIVE_FISHERY.palette.dirt),
  sand: new THREE.Color(ACTIVE_FISHERY.palette.sand),
  mud: new THREE.Color(ACTIVE_FISHERY.palette.mud),
  stone: new THREE.Color(ACTIVE_FISHERY.palette.stone),
  forest: new THREE.Color(ACTIVE_FISHERY.palette.forest),
  log: new THREE.Color(ACTIVE_FISHERY.palette.log),
  leaf: new THREE.Color(ACTIVE_FISHERY.palette.leaf),
  leafAutumn: new THREE.Color(ACTIVE_FISHERY.palette.leafAutumn),
};

interface Block {
  x: number;
  z: number;
  top: number;
  bottom: number;
  size: number;
  /** 블록 경계선 간격 (없으면 size) */
  grid?: number;
  topColor: THREE.Color;
  sideColor: THREE.Color;
}

function material(): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial();
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aSide; attribute vec2 aInfo; // aInfo: 윗면 높이, 블록 크기
        varying vec3 vSide; varying vec2 vInfo; varying vec3 vWP; varying vec3 vN;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSide = aSide; vInfo = aInfo;
        vWP = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vN = normal;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSide; varying vec2 vInfo; varying vec3 vWP; varying vec3 vN;
        float vh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float bs = vInfo.y;
          bool top = vN.y > 0.5;
          // 옆면 맨 위 띠는 윗면 색 (잔디 블록)
          bool strip = !top && (vInfo.x - vWP.y) < bs * 0.22;
          vec3 base = (top || strip) ? diffuseColor.rgb : vSide;
          // 한 블록을 16×16 도트로
          vec3 cell = floor(vWP / bs * 16.0 + 0.001);
          float n = vh(cell);
          base *= 0.86 + 0.24 * n;
          // 블록 경계선
          vec3 f = fract(vWP / bs + 0.0005);
          vec2 e = top ? f.xz : (abs(vN.x) > 0.5 ? f.zy : f.xy);
          float edge = step(min(min(e.x, 1.0 - e.x), min(e.y, 1.0 - e.y)), 0.02);
          base *= 1.0 - edge * 0.25;
          diffuseColor.rgb = base;
        }`,
      );
  };
  return mat;
}

function buildMesh(blocks: Block[]): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const side = new Float32Array(blocks.length * 3);
  const info = new Float32Array(blocks.length * 2);
  geo.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 3));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 2));
  const mesh = new THREE.InstancedMesh(geo, material(), blocks.length);
  const m = new THREE.Matrix4();
  blocks.forEach((b, i) => {
    m.makeScale(b.size, Math.max(0.01, b.top - b.bottom), b.size);
    m.setPosition(b.x, b.bottom, b.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.topColor);
    side.set([b.sideColor.r, b.sideColor.g, b.sideColor.b], i * 3);
    info.set([b.top, b.grid ?? b.size], i * 2);
  });
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  return mesh;
}

/** 블록 높이로 맞춘 지형 높이 */
function snap(h: number, size: number) {
  return Math.round(h / size) * size;
}

export function createVoxelWorld(): THREE.Group {
  const group = new THREE.Group();
  const blocks: Block[] = [];
  // 가까울수록 작은 블록: 1m(60m 안) → 2m(300m 안) → 8m(먼 산)
  const rings = [
    { size: 1, half: 60 },
    { size: 2, half: 300 },
    { size: 8, half: 1500 },
  ];
  // 블록 격자를 월드 8m 격자에 맞춘다
  const ox = Math.round(SEAT.x / 8) * 8;
  const oz = Math.round(SEAT.z / 8) * 8;
  // 물 밑 블록 윗면은 수면(높이 0)보다 조금 낮춘다. 1m 단위로 맞추면 물가 바닥이 정확히 수면 높이(0)가 되어
  // 수면과 같은 면에서 겹쳐 그려지며 깜빡이고 깨져 보인다
  const topOf = (x: number, z: number, s: number) => {
    const t = snap(heightAt(x, z), Math.min(s, 1));
    return t <= 0 ? t - 0.12 : t;
  };
  rings.forEach((r, ri) => {
    const inner = ri > 0 ? rings[ri - 1].half : -1;
    for (let gz = -r.half; gz < r.half; gz += r.size) {
      for (let gx = -r.half; gx < r.half; gx += r.size) {
        const cx = gx + r.size / 2;
        const cz = gz + r.size / 2;
        if (Math.abs(cx) < inner && Math.abs(cz) < inner) continue;
        const x = ox + cx;
        const z = oz + cz;
        const top = topOf(x, z, r.size);
        // 옆 칸 중 가장 낮은 곳까지 기둥을 내려 빈틈을 막는다
        let low = top;
        for (const [dx, dz] of [
          [r.size, 0],
          [-r.size, 0],
          [0, r.size],
          [0, -r.size],
        ]) {
          low = Math.min(low, topOf(x + dx, z + dz, r.size));
        }
        const s = shoreDistance(x, z);
        let topColor = C.grass;
        let sideColor = C.dirt;
        if (top <= 0) {
          topColor = sideColor = C.mud;
        } else if (s < 2.5) {
          topColor = sideColor = C.sand;
        } else if (top > 60 || low < top - r.size * 2) {
          topColor = sideColor = C.stone;
        } else if (s > 12) {
          topColor = C.forest;
        }
        blocks.push({ x, z, top, bottom: Math.min(low, top - r.size) - 0.01, size: r.size, topColor, sideColor });
      }
    }
  });
  const terrain = buildMesh(blocks);
  group.add(terrain);

  // 나무: 통나무 기둥 + 잎 덩어리 두 층
  const trees: Block[] = [];
  const rnd = mulberry(ACTIVE_FISHERY.terrain.seed + 2);
  for (let gz = -280; gz < 280; gz += 7) {
    for (let gx = -280; gx < 280; gx += 7) {
      const x = Math.round(SEAT.x + gx + (rnd() - 0.5) * 5);
      const z = Math.round(SEAT.z + gz + (rnd() - 0.5) * 5);
      const s = shoreDistance(x, z);
      if (s < 8 || rnd() > ACTIVE_FISHERY.trees * (0.35 + 0.4 * (fbm(x / 40, z / 40, 2, 9) + 0.5))) continue;
      const base = snap(heightAt(x, z), 1);
      const h = 4 + Math.floor(rnd() * 3);
      const leaf = rnd() < 0.2 ? C.leafAutumn : C.leaf;
      const tx = x + 0.5;
      const tz = z + 0.5;
      trees.push({ x: tx, z: tz, bottom: base, top: base + h, size: 1, topColor: C.log, sideColor: C.log });
      trees.push({ x: tx, z: tz, bottom: base + h - 2, top: base + h, size: ACTIVE_FISHERY.id === 'moon' ? 4 : 5, grid: 1, topColor: leaf, sideColor: leaf });
      trees.push({ x: tx, z: tz, bottom: base + h, top: base + h + 2, size: ACTIVE_FISHERY.id === 'moon' ? 2 : 3, grid: 1, topColor: leaf, sideColor: leaf });
    }
  }
  const treeMesh = buildMesh(trees);
  treeMesh.castShadow = true;
  group.add(treeMesh);
  return group;
}

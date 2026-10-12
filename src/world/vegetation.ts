import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, SEAT, reedDensity, shoreDistance } from './lake';
import { fbm, mulberry, smoothstep } from './noise';
import { shared } from './sky';

// 산을 덮은 숲(소나무 + 활엽수), 물가 갈대, 발밑 풀. 모두 인스턴싱.

const rnd = mulberry(2026);
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function colorize(geo: THREE.BufferGeometry, color: THREE.Color, shadeBottom = 0.6): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox!;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / (max.y - min.y || 1);
    const s = shadeBottom + (1 - shadeBottom) * t;
    col.set([color.r * s, color.g * s, color.b * s], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** 소나무: 줄기 + 층층이 쌓인 원뿔 (높이 1 기준) */
function pineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.018, 0.03, 0.45, 5);
  trunk.translate(0, 0.225, 0);
  parts.push(colorize(trunk, new THREE.Color('#4a3a2c'), 0.8));
  const tiers = [
    [0.3, 0.2, 0.42],
    [0.5, 0.17, 0.34],
    [0.68, 0.13, 0.26],
    [0.84, 0.08, 0.18],
  ];
  for (const [y, r, h] of tiers) {
    const cone = new THREE.ConeGeometry(r, h, 7, 1);
    cone.translate(0, y + h * 0.35, 0);
    parts.push(colorize(cone, new THREE.Color('#ffffff'), 0.55));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

/** 활엽수: 줄기 + 뭉게뭉게한 수관 */
function broadleafGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.02, 0.035, 0.5, 5);
  trunk.translate(0, 0.25, 0);
  parts.push(colorize(trunk, new THREE.Color('#4d3f31'), 0.8));
  const blobs = [
    [0, 0.62, 0, 0.28],
    [0.14, 0.52, 0.06, 0.2],
    [-0.12, 0.55, -0.08, 0.21],
    [0.03, 0.8, -0.04, 0.2],
    [-0.05, 0.5, 0.14, 0.18],
  ];
  for (const [x, y, z, r] of blobs) {
    const b = new THREE.IcosahedronGeometry(r, 1);
    const p = b.attributes.position;
    // 울퉁불퉁하게
    for (let i = 0; i < p.count; i++) {
      tmpP.fromBufferAttribute(p, i);
      const k = 1 + 0.18 * Math.sin(tmpP.x * 31 + tmpP.y * 17) * Math.cos(tmpP.z * 23);
      p.setXYZ(i, tmpP.x * k, tmpP.y * k * 0.85, tmpP.z * k);
    }
    b.translate(x, y, z);
    parts.push(colorize(b, new THREE.Color('#ffffff'), 0.5));
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

function treeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
}

export function createForest(): THREE.Group {
  const group = new THREE.Group();
  const pines: THREE.Matrix4[] = [];
  const pineCols: THREE.Color[] = [];
  const leafs: THREE.Matrix4[] = [];
  const leafCols: THREE.Color[] = [];
  const SP = 6.5;
  const R = 700;
  for (let gz = -R; gz < R; gz += SP) {
    for (let gx = -R; gx < R; gx += SP) {
      const x = SEAT.x + gx + (rnd() - 0.5) * SP * 0.9;
      const z = SEAT.z + gz + (rnd() - 0.5) * SP * 0.9;
      const d = Math.hypot(x - SEAT.x, z - SEAT.z);
      if (d > R) continue;
      const s = shoreDistance(x, z);
      if (s < 7) continue;
      // 멀수록 성기게 (먼 산은 지형 색이 대신한다)
      if (d > 350 && rnd() < smoothstep(350, R, d) * 0.6) continue;
      // 물가 쪽은 듬성듬성, 숲 안쪽은 빽빽
      const dens = smoothstep(7, 30, s) * (0.6 + 0.4 * smoothstep(-0.4, 0.3, fbm(x / 40, z / 40, 3, 9)));
      if (rnd() > dens) continue;
      const h = heightAt(x, z);
      const isPine = fbm(x / 70, z / 70, 2, 13) + (rnd() - 0.5) * 0.6 > -0.05;
      const height = (isPine ? 9 : 8) + rnd() * 7 + smoothstep(0, 0.5, s / 100) * 3;
      const w = height * (0.85 + rnd() * 0.35);
      tmpQ.setFromAxisAngle(up, rnd() * Math.PI * 2);
      tmpS.set(w, height, w);
      tmpP.set(x, h - 0.3, z);
      const m = new THREE.Matrix4().compose(tmpP, tmpQ, tmpS);
      if (isPine) {
        pines.push(m);
        pineCols.push(new THREE.Color().setHSL(0.27 + rnd() * 0.06, 0.32 + rnd() * 0.15, 0.13 + rnd() * 0.06));
      } else {
        leafs.push(m);
        // 10월: 대부분 초록, 일부 노랗고 붉게 물든다
        const a = rnd();
        const c = new THREE.Color();
        if (a < 0.68) c.setHSL(0.2 + rnd() * 0.08, 0.35 + rnd() * 0.15, 0.17 + rnd() * 0.08);
        else if (a < 0.88) c.setHSL(0.11 + rnd() * 0.04, 0.5 + rnd() * 0.2, 0.25 + rnd() * 0.08);
        else c.setHSL(0.04 + rnd() * 0.03, 0.55 + rnd() * 0.15, 0.22 + rnd() * 0.06);
        leafCols.push(c);
      }
    }
  }
  const make = (geo: THREE.BufferGeometry, ms: THREE.Matrix4[], cs: THREE.Color[]) => {
    const mesh = new THREE.InstancedMesh(geo, treeMaterial(), ms.length);
    ms.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, cs[i]);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  };
  group.add(make(pineGeometry(), pines, pineCols), make(broadleafGeometry(), leafs, leafCols));
  return group;
}

// ── 갈대와 풀: 바람에 흔들리는 잎 ──────────────────────

/** 잎 한 다발 (높이 1 기준). 잎마다 휘는 방향이 다르다 */
function bladeClump(blades: number, spread: number, width: number, seed: number): THREE.BufferGeometry {
  const r = mulberry(seed);
  const pos: number[] = [];
  const nor: number[] = [];
  const hgt: number[] = [];
  const idx: number[] = [];
  const SEGS = 4;
  for (let b = 0; b < blades; b++) {
    const bx = (r() - 0.5) * spread;
    const bz = (r() - 0.5) * spread;
    const ang = r() * Math.PI * 2;
    const lean = 0.08 + r() * 0.25;
    const len = 0.65 + r() * 0.35;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const base = pos.length / 3;
    for (let s = 0; s <= SEGS; s++) {
      const t = s / SEGS;
      const w = width * (1 - t * 0.92);
      const off = lean * t * t;
      const cx = bx + dx * off;
      const cz = bz + dz * off;
      const y = t * len;
      // 잎 면은 휘는 방향과 수직
      pos.push(cx - dz * w, y, cz + dx * w, cx + dz * w, y, cz - dx * w);
      nor.push(dx * 0.3, 1, dz * 0.3, dx * 0.3, 1, dz * 0.3);
      hgt.push(t, t);
    }
    for (let s = 0; s < SEGS; s++) {
      const a = base + s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
  g.setIndex(idx);
  return g;
}

function swayMaterial(root: string, tip: string, amp: number): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  const uniforms = { uRoot: { value: new THREE.Color(root) }, uTip: { value: new THREE.Color(tip) }, uAmp: { value: amp } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.uniforms.uTime = shared.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH; uniform float uTime; uniform float uAmp; varying float vH;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vH = aH;
        {
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float ph = ip.x * 0.35 + ip.z * 0.27;
          float gust = 0.6 + 0.4 * sin(uTime * 0.31 + ip.x * 0.02);
          float sway = (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25) * gust;
          float k = aH * aH * uAmp;
          transformed.x += sway * k;
          transformed.z += sway * k * 0.45;
          transformed.y -= abs(sway) * k * 0.25;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRoot; uniform vec3 uTip; varying float vH;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(uRoot, uTip, smoothstep(0.0, 0.85, vH));`,
      );
  };
  mat.customProgramCacheKey = () => `sway-${root}-${tip}`;
  return mat;
}

export function createReeds(): THREE.InstancedMesh {
  const geo = bladeClump(9, 0.5, 0.012, 5);
  const mats: THREE.Matrix4[] = [];
  const cols: THREE.Color[] = [];
  const r = mulberry(91);
  for (let gz = -280; gz < 40; gz += 0.9) {
    for (let gx = -230; gx < 230; gx += 0.9) {
      const x = gx + (r() - 0.5) * 0.9;
      const z = gz + (r() - 0.5) * 0.9;
      const d = reedDensity(x, z);
      if (d <= 0 || r() > d * 0.9) continue;
      const h = heightAt(x, z);
      const height = (1.3 + r() * 1.1) * (0.7 + 0.3 * d);
      tmpQ.setFromAxisAngle(up, r() * Math.PI * 2);
      tmpS.set(1 + r() * 0.5, height, 1 + r() * 0.5);
      tmpP.set(x, h, z);
      mats.push(new THREE.Matrix4().compose(tmpP, tmpQ, tmpS));
      cols.push(new THREE.Color().setHSL(0.13 + r() * 0.05, 0.3 + r() * 0.2, 0.55 + r() * 0.25));
    }
  }
  const mesh = new THREE.InstancedMesh(geo, swayMaterial('#3e4a22', '#c9b47a', 0.09), mats.length);
  mats.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, cols[i]);
  });
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  return mesh;
}

export function createGrass(): THREE.InstancedMesh {
  const geo = bladeClump(14, 0.35, 0.01, 8);
  const mats: THREE.Matrix4[] = [];
  const cols: THREE.Color[] = [];
  const r = mulberry(17);
  const R = 34;
  for (let i = 0; i < 16000; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R;
    const x = SEAT.x + Math.cos(a) * d;
    const z = SEAT.z + Math.sin(a) * d;
    const s = shoreDistance(x, z);
    if (s < 0.8) continue;
    // 앉은 자리 바로 앞은 밟혀서 풀이 짧고 듬성하다
    const pd = Math.hypot(x - SEAT.x, z - SEAT.z);
    const trampled = smoothstep(2.6, 1.0, pd);
    if (r() < trampled * 0.8) continue;
    if (r() > 0.35 + 0.65 * smoothstep(-0.3, 0.3, fbm(x / 4, z / 4, 2, 77))) continue;
    const h = heightAt(x, z);
    const height = (0.22 + r() * 0.4) * (1 - trampled * 0.6) * (0.6 + 0.4 * smoothstep(0.8, 4, s));
    tmpQ.setFromAxisAngle(up, r() * Math.PI * 2);
    tmpS.set(1, height, 1);
    tmpP.set(x, h - 0.02, z);
    mats.push(new THREE.Matrix4().compose(tmpP, tmpQ, tmpS));
    const dry = r();
    cols.push(new THREE.Color().setHSL(0.15 + dry * 0.08, 0.35 + r() * 0.2, 0.42 + r() * 0.2));
  }
  const mesh = new THREE.InstancedMesh(geo, swayMaterial('#2f3a1c', '#a8a65a', 0.12), mats.length);
  mats.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, cols[i]);
  });
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  return mesh;
}

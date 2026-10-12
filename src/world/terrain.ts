import * as THREE from 'three';
import { heightAt, SEAT, shoreDistance } from './lake';
import { fbm, smoothstep } from './noise';
import { ACTIVE_FISHERY } from '../game/fisheries';

// 지형 메시. 격자를 플레이어 쪽으로 모아(가까이는 촘촘, 멀리는 성기게) 한 장으로 먼 산까지 덮는다.

const SEG = 440;
const RADIUS = 2600;
/** 격자 좌표 -1~1 → 월드 거리. 가운데는 약 0.5m 간격 */
const warp = (u: number) => RADIUS * (0.045 * u + 0.955 * u * u * u);

// 10월 한국의 저수지 색 (sRGB → 선형으로 변환됨)
const C = {
  mudDeep: new THREE.Color('#2f2c20'),
  mudWet: new THREE.Color('#463b2a'),
  dirt: new THREE.Color('#6e5236'),
  grass: new THREE.Color(ACTIVE_FISHERY.palette.grass),
  grassDry: new THREE.Color('#988a4c'),
  forest: new THREE.Color(ACTIVE_FISHERY.palette.forest),
  forestAutumn: new THREE.Color('#5d4a25'),
  rock: new THREE.Color(ACTIVE_FISHERY.palette.stone),
  far: new THREE.Color('#33402f'),
};

export function createTerrain(): THREE.Mesh {
  const n = SEG + 1;
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    const z = SEAT.z + warp((j / SEG) * 2 - 1);
    for (let i = 0; i < n; i++) {
      const x = SEAT.x + warp((i / SEG) * 2 - 1);
      const k = (j * n + i) * 3;
      pos[k] = x;
      pos[k + 1] = heightAt(x, z);
      pos[k + 2] = z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * n + i;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  // 색: 높이·경사·물가 거리로 칠한다
  const nor = geo.attributes.normal.array as Float32Array;
  const col = new Float32Array(n * n * 3);
  const c = new THREE.Color();
  const grass = new THREE.Color();
  const forest = new THREE.Color();
  for (let k = 0; k < n * n * 3; k += 3) {
    const x = pos[k];
    const h = pos[k + 1];
    const z = pos[k + 2];
    const s = shoreDistance(x, z);
    const slope = 1 - nor[k + 1];
    const n1 = fbm(x / 7, z / 7, 3, 61);
    const n2 = fbm(x / 60, z / 60, 3, 62);
    if (h < -0.05) {
      c.copy(C.mudWet).lerp(C.mudDeep, smoothstep(0, 2.5, -h));
    } else {
      // 물가 젖은 흙 → 마른 흙 → 풀밭 → 숲
      c.copy(C.mudWet).lerp(C.dirt, smoothstep(0.1, 1.2, s));
      grass.copy(C.grass).lerp(C.grassDry, smoothstep(-0.3, 0.6, n1));
      // 물가 쪽은 밟힌 갈색 흙, 멀어질수록 풀밭
      c.lerp(grass, smoothstep(5, 14, s) * (0.6 + 0.4 * n1));
      forest.copy(C.forest).lerp(C.forestAutumn, smoothstep(0.1, 0.7, n2) * 0.7);
      c.lerp(forest, smoothstep(10, 40, s));
      c.lerp(C.rock, smoothstep(0.25, 0.5, slope) * 0.7);
      c.lerp(C.far, smoothstep(300, 900, s));
    }
    c.multiplyScalar(0.92 + 0.12 * n1);
    col[k] = c.r;
    col[k + 1] = c.g;
    col[k + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  // 가까이서 봤을 때 밋밋하지 않게, 월드 좌표로 잔 얼룩을 더한다
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tn(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float d = length(vWPos - cameraPosition);
          float fine = tn(vWPos.xz * 3.1) * 0.5 + tn(vWPos.xz * 9.7) * 0.3 + tn(vWPos.xz * 0.7) * 0.4;
          diffuseColor.rgb *= mix(1.0, 0.72 + fine * 0.42, smoothstep(80.0, 6.0, d));
          // 물가의 젖은 띠: 수면 바로 위가 어둡다
          diffuseColor.rgb *= 1.0 - 0.35 * smoothstep(0.25, 0.0, vWPos.y) * smoothstep(-0.3, 0.0, vWPos.y);
        }`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

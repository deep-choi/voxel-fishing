import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 3D 도트 마무리: 깊이 차이로 외곽선을 긋고, 색을 단계로 나눠 도트 그림처럼 만든다.
// (화면은 저해상도로 그린 뒤 픽셀이 뭉개지지 않게 확대한다)

export interface PixelLook {
  /** 밝기 단계 수 (0이면 단계 나누지 않음) */
  levels: number;
  /** 디더 세기 (0이면 없음) */
  dither: number;
  /** 채도 배율 */
  sat: number;
  /** 캐스트앤칠풍 32색 팔레트로 고정 (그림자는 보라, 빛은 금빛) */
  palette?: boolean;
  /** 원본 해상도로 그린 뒤 이 크기(렌더 픽셀) 블록을 평균내 한 도트로 만든다. 1이면 끔 */
  block?: number;
}

// 캐스트앤칠 분위기 팔레트 (sRGB)
const PALETTE = [
  '#1b1530', '#2a2145', '#3b2f5e', '#4f3f78',
  '#6a5592', '#8a74ad', '#a996c8', '#c9b9e0',
  '#e8c3d0', '#f2d4c2', '#f6e4c8', '#fff3dc',
  '#6b4a2a', '#9a6a2e', '#c98c3a', '#e2b04e', '#f1d27a',
  '#23362f', '#34503f', '#4f6e4a', '#7a8f55',
  '#1f2a5a', '#2d4380', '#4766a8', '#6f8fc8', '#9bb5e0', '#c4d6f0',
  '#3e3446', '#5a4e60', '#7d7086', '#a59bab', '#ffffff',
].map((h) => {
  const c = new THREE.Color();
  c.setStyle(h, THREE.NoColorSpace);
  return new THREE.Vector3(c.r, c.g, c.b);
});

export function createPixelPass(depth: THREE.DepthTexture, camera: THREE.PerspectiveCamera, look: PixelLook) {
  return new ShaderPass({
    name: 'PixelArt',
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: depth },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uLevels: { value: look.levels },
      uDither: { value: look.dither },
      uSat: { value: look.sat },
      uUsePalette: { value: look.palette ? 1 : 0 },
      uBlock: { value: look.block ?? 1 },
      uPalette: { value: PALETTE },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      #include <packing>
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform vec2 uRes;
      uniform float uNear;
      uniform float uFar;
      uniform float uLevels;
      uniform float uDither;
      uniform float uSat;
      uniform float uUsePalette;
      uniform float uBlock;
      uniform vec3 uPalette[32];
      varying vec2 vUv;

      float dist(vec2 uv) {
        float z = texture2D(tDepth, uv).x;
        return -perspectiveDepthToViewZ(z, uNear, uFar);
      }
      // 4×4 바이엘 디더
      float bayer(vec2 p) {
        int x = int(mod(p.x, 4.0));
        int y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
        return m[i] / 16.0 - 0.5;
      }

      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
      }
      vec3 hsv2rgb(vec3 c) {
        vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
        return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
      }

      void main() {
        // 블록 도트: 블록 안 픽셀을 평균내 한 색으로 (깜빡이는 잔점이 사라진다)
        vec2 origin = floor(vUv * uRes / uBlock) * uBlock;
        vec2 uv = (origin + uBlock * 0.5) / uRes;
        vec3 c = vec3(0.0);
        float n = 0.0;
        for (int y = 0; y < 6; y++) {
          for (int x = 0; x < 6; x++) {
            if (float(x) >= uBlock || float(y) >= uBlock) continue;
            c += texture2D(tDiffuse, (origin + vec2(float(x), float(y)) + 0.5) / uRes).rgb;
            n += 1.0;
          }
        }
        c /= n;
        // 하이라이트 압축: 해 근처가 하얗게 날아가 눈부시지 않게
        c = min(c, 0.8 + max(c - 0.8, 0.0) * 0.3);
        vec2 px = uBlock / uRes;
        float d = dist(uv);

        // 외곽선: 옆 픽셀이 훨씬 멀면 여기는 물체의 가장자리
        float far = 0.0;
        far = max(far, dist(uv + vec2(px.x, 0.0)) - d);
        far = max(far, dist(uv - vec2(px.x, 0.0)) - d);
        far = max(far, dist(uv + vec2(0.0, px.y)) - d);
        far = max(far, dist(uv - vec2(0.0, px.y)) - d);
        float edge = step(0.25 + d * 0.08, far) * smoothstep(260.0, 60.0, d);
        if (uUsePalette > 0.5) {
          // 그림자는 보라·남색으로, 밝은 곳은 금빛으로
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c * vec3(0.78, 0.72, 1.12) + vec3(0.03, 0.02, 0.07), c * vec3(1.08, 1.0, 0.86), smoothstep(0.15, 0.85, lum));
          c = mix(c, vec3(0.16, 0.12, 0.27), edge * 0.7);
        } else {
          c *= 1.0 - edge * 0.45;
        }

        // 셀 셰이딩처럼: 색상은 두고 밝기만 몇 단계로 나눈다. 디더는 띠 경계만 살짝 섞는 정도
        vec2 fp = floor(origin / uBlock);
        vec3 hsv = rgb2hsv(clamp(c, 0.0, 1.0));
        if (uLevels > 0.0) hsv.z = floor(hsv.z * uLevels + 0.5 + bayer(fp) * uDither) / uLevels;
        hsv.y = min(1.0, hsv.y * uSat);
        c = hsv2rgb(hsv);
        if (uUsePalette > 0.5) {
          // 가장 가까운 팔레트 색으로 (사람 눈에 가까운 가중 거리)
          vec3 best = uPalette[0];
          float bd = 1e9;
          for (int i = 0; i < 32; i++) {
            vec3 p = uPalette[i];
            vec3 dd = c - p;
            float rm = (c.r + p.r) * 0.5;
            float dist2 = (2.0 + rm) * dd.r * dd.r + 4.0 * dd.g * dd.g + (3.0 - rm) * dd.b * dd.b;
            if (dist2 < bd) { bd = dist2; best = p; }
          }
          c = best;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

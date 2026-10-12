import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LAKE_BOUNDS, waterDepth, WATER_Y } from './lake';
import { mulberry } from './noise';
import { shared, SKY_AMBIENT, SUN_COLOR, sunDir } from './sky';

// 저수지 수면: 평면 반사 + 잔물결 노멀 + 파문(찌 움직임, 캐스팅, 물고기) + 수심에 따른 탁한 물빛.

const MAX_RIPPLES = 16;

/** 타일링되는 잔물결 기울기 텍스처 (정수 주파수 사인파 합 → 이음매 없음) */
function rippleTexture(size = 256): THREE.DataTexture {
  const rnd = mulberry(7);
  const waves: { kx: number; kz: number; a: number; p: number }[] = [];
  for (let i = 0; i < 72; i++) {
    // 바람 방향(대각선)으로 치우친 파향
    // 바람 방향으로 조금 치우치되 사방으로 퍼진 파향
    const ang = rnd() < 0.5 ? -0.6 + (rnd() - 0.5) * 1.6 : rnd() * Math.PI * 2;
    const k = 6 + Math.floor(rnd() * rnd() * 26);
    const kx = Math.round(Math.cos(ang) * k);
    const kz = Math.round(Math.sin(ang) * k);
    if (kx === 0 && kz === 0) continue;
    waves.push({ kx, kz, a: 1 / Math.pow(Math.hypot(kx, kz), 1.25), p: rnd() * Math.PI * 2 });
  }
  const data = new Uint8Array(size * size * 4);
  let max = 0;
  const gx = new Float32Array(size * size);
  const gz = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i / size) * Math.PI * 2;
      const v = (j / size) * Math.PI * 2;
      let dx = 0;
      let dz = 0;
      for (const w of waves) {
        const c = Math.cos(w.kx * u + w.kz * v + w.p) * w.a;
        dx += c * w.kx;
        dz += c * w.kz;
      }
      gx[j * size + i] = dx;
      gz[j * size + i] = dz;
      max = Math.max(max, Math.abs(dx), Math.abs(dz));
    }
  }
  for (let k = 0; k < size * size; k++) {
    data[k * 4] = Math.round((gx[k] / max) * 127 + 128);
    data[k * 4 + 1] = Math.round((gz[k] / max) * 127 + 128);
    data[k * 4 + 2] = 128;
    data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** 수심 텍스처: 물가로 갈수록 물이 맑아지고 바닥이 비친다 */
function depthTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const { minX, maxX, minZ, maxZ } = LAKE_BOUNDS;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = minX + ((i + 0.5) / size) * (maxX - minX);
      const z = minZ + ((j + 0.5) / size) * (maxZ - minZ);
      const d = Math.min(1, waterDepth(x, z) / 8);
      const k = (j * size + i) * 4;
      data[k] = Math.round(d * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const WaterShader = {
  name: 'ReservoirWater',
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uNormal: { value: null },
      uDepth: { value: null },
      uDepthBox: { value: new THREE.Vector4() },
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3() },
      uSunColor: { value: new THREE.Color() },
      uSky: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color('#163330') },
      uShallow: { value: new THREE.Color('#2f5a4a') },
      uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
      uWind: { value: 1 },
      uReflection: { value: 1 },
      uGlint: { value: 1 },
    },
  ]),
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D uNormal;
    uniform sampler2D uDepth;
    uniform vec4 uDepthBox;
    uniform float uTime;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSky;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec4 uRip[${MAX_RIPPLES}];
    uniform float uWind;
    uniform float uReflection;
    uniform float uGlint;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>

    vec2 slopeAt(vec2 uv) { return texture2D(uNormal, uv).xy * 2.0 - 1.0; }

    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = vWorld.xz;
      float camDist = length(cameraPosition - vWorld);
      // 잔물결: 크기와 흐르는 방향이 다른 세 겹
      vec2 g = slopeAt(p / 1.7 + vec2(0.031, 0.017) * uTime) * 0.4
             + slopeAt(p / 4.3 + vec2(-0.016, 0.022) * uTime) * 0.45
             + slopeAt(p.yx / 11.0 + vec2(0.008, -0.011) * uTime) * 0.15;
      // 멀수록 잔물결이 뭉개져 거울처럼 보인다
      g *= 0.085 * uWind * mix(1.0, 0.35, smoothstep(30.0, 250.0, camDist));

      // 파문 고리
      for (int i = 0; i < ${MAX_RIPPLES}; i++) {
        vec4 r = uRip[i];
        float age = uTime - r.z;
        if (r.w <= 0.0 || age < 0.0 || age > 7.0) continue;
        vec2 d = p - r.xy;
        float dist = length(d) + 1e-4;
        float rad = age * 0.42;
        float x = dist - rad;
        float w = 0.03 + age * 0.05;
        float env = exp(-x * x / w) * exp(-age * 0.75) * r.w;
        g += (d / dist) * env * cos(x * 30.0) * 0.55;
      }
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 V = normalize(cameraPosition - vWorld);

      float cosT = max(dot(N, V), 0.0);
      float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);

      vec2 ruv = vUv.xy / vUv.w + N.xz * 0.045 / (1.0 + camDist * 0.015);
      vec3 refl = texture2D(tDiffuse, clamp(ruv, vec2(0.002), vec2(0.998))).rgb;

      float depth = texture2D(uDepth, (p - uDepthBox.xy) / uDepthBox.zw).r * 8.0;
      vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 2.5, depth));
      float sunUp = max(uSunDir.y, 0.0);
      body *= uSky * 0.55 + uSunColor * (0.15 + sunUp * 0.6);

      vec3 col = mix(body, refl, F * uReflection);
      // 윤슬
      vec3 H = normalize(uSunDir + V);
      float spec = pow(max(dot(N, H), 0.0), 600.0) * 9.0 + pow(max(dot(N, H), 0.0), 90.0) * 0.25;
      col += uSunColor * spec * uGlint;

      // 아주 얕은 물가는 바닥이 비친다
      float alpha = clamp(smoothstep(0.0, 0.55, depth) * 0.9 + F * 0.6, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

export class Water {
  readonly mesh: Reflector;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private ripIndex = 0;

  constructor() {
    const geo = new THREE.PlaneGeometry(1400, 1400);
    this.mesh = new Reflector(geo, {
      shader: WaterShader,
      textureWidth: 1024,
      textureHeight: 1024,
      clipBias: 0.002,
      multisample: 0,
    });
    // Reflector는 메시의 회전으로 반사면 법선을 계산한다.
    // 지오메트리만 돌리면 수평 수면을 수직 거울로 계산해 반사가 깨진다.
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, WATER_Y, -240);
    // 반사 카메라는 원래 카메라를 복제해 레이어까지 따라오므로, 반사 제외 레이어(1)를 끈다
    const getCam = this.mesh.getReflectionCamera.bind(this.mesh);
    this.mesh.getReflectionCamera = (cam: THREE.Camera) => {
      const rc = getCam(cam);
      rc.layers.set(0);
      return rc;
    };
    const mat = this.mesh.material as THREE.ShaderMaterial;
    mat.transparent = true;
    mat.fog = true;
    mat.depthWrite = true;
    this.uniforms = mat.uniforms;
    const { minX, maxX, minZ, maxZ } = LAKE_BOUNDS;
    this.uniforms.uNormal.value = rippleTexture();
    this.uniforms.uDepth.value = depthTexture();
    this.uniforms.uDepthBox.value.set(minX, minZ, maxX - minX, maxZ - minZ);
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunColor.value.copy(SUN_COLOR);
    this.uniforms.uSky.value.copy(SKY_AMBIENT);
    this.uniforms.uTime = shared.uTime;
    this.mesh.renderOrder = 1;
  }

  setSize(w: number, h: number) {
    this.mesh.getRenderTarget().setSize(Math.round(w * 0.6), Math.round(h * 0.6));
  }

  /** 파문 하나 추가 (세기 0~1) */
  ripple(x: number, z: number, strength: number) {
    const v = this.uniforms.uRip.value[this.ripIndex] as THREE.Vector4;
    v.set(x, z, shared.uTime.value, strength);
    this.ripIndex = (this.ripIndex + 1) % MAX_RIPPLES;
  }
}

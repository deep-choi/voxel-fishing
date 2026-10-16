import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// 이른 아침 하늘, 해, 안개, 조명. 반사·환경광도 같은 하늘에서 만든다.

export const shared = { uTime: { value: 0 } };

/** 해 방향: 정면(-z) 왼쪽 낮은 곳 → 수면에 윤슬이 길게 깔린다 */
const SUN_ELEVATION = 13;
const SUN_AZIMUTH = -62; // 0 = 정면, 음수 = 왼쪽
export const sunDir = new THREE.Vector3().setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(90 - SUN_ELEVATION),
  THREE.MathUtils.degToRad(180 - SUN_AZIMUTH),
);

export const SUN_COLOR = new THREE.Color('#ffd7a8');
export const SKY_AMBIENT = new THREE.Color('#9fb3c9');
export const FOG_COLOR = new THREE.Color('#b9c2c4');

function makeSky(): Sky {
  const sky = new Sky();
  sky.scale.setScalar(9000);
  const u = sky.material.uniforms;
  u.turbidity.value = 5.5;
  u.rayleigh.value = 1.4;
  u.mieCoefficient.value = 0.0025;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDir);
  u.cloudCoverage.value = 0.32;
  u.cloudDensity.value = 0.35;
  u.cloudElevation.value = 0.55;
  return sky;
}

export function setupSky(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const sky = makeSky();
  scene.add(sky);

  // 환경광: 하늘만 있는 장면을 PMREM으로 굽는다
  const envScene = new THREE.Scene();
  const envSky = makeSky();
  envSky.material.uniforms.showSunDisc.value = 0;
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 20000).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0011);

  const sun = new THREE.DirectionalLight(SUN_COLOR, 2.6);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight('#c3d2e4', '#4b4632', 0.55);
  scene.add(hemi);

  return {
    sky,
    sun,
    hemi,
    /** 낮밤: 0 = 밤, 1 = 낮. 해와 하늘빛 세기만 줄인다 */
    setDaylight(d: number) {
      sun.intensity = 2.6 * d;
      hemi.intensity = 0.12 + 0.43 * d;
      scene.environmentIntensity = 0.12 + 0.43 * d;
    },
    /** 그림자 범위를 플레이어 주변으로 */
    follow(center: THREE.Vector3) {
      if (sun.target.position.equals(center)) return false;
      sun.target.position.copy(center);
      sun.position.copy(center).addScaledVector(sunDir, 120);
      return true;
    },
    update(t: number) {
      sky.material.uniforms.time.value = t;
    },
  };
}

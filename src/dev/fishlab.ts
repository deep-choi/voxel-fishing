import * as THREE from 'three';
import { SPECIES_LIST } from '../game/data';
import { VoxelFishModel } from '../render/voxelFishModel';
import { fishIcon } from '../ui/pixelIcons';

// 개발용 미리보기: fishlab.html. ?spin=0 이면 옆모습으로 멈춘다.

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#5d7f86');
scene.add(new THREE.HemisphereLight('#dfefff', '#4a4a38', 1.6));
const sun = new THREE.DirectionalLight('#fff4dc', 2.4);
sun.position.set(2, 5, 4);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 50);
camera.position.set(0, 0.3, 6.2);
camera.lookAt(0, 0.15, 0);

const spin = new URLSearchParams(location.search).get('spin') !== '0';
const fish = SPECIES_LIST.map((sp, i) => {
  const model = new VoxelFishModel(sp.look, 1);
  const holder = new THREE.Group();
  holder.position.set(((i % 3) - 1) * 1.45, 1.05 - Math.floor(i / 3) * 0.78, 0);
  holder.add(model.group);
  scene.add(holder);
  return { sp, model, holder };
});

const labels = document.getElementById('labels')!;
document.getElementById('icons')!.innerHTML = SPECIES_LIST.map(sp => `<div>${fishIcon(sp.look)}<small>${sp.name}</small></div>`).join('');

const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function frame() {
  const dt = clock.getDelta(), t = clock.elapsedTime;
  for (const f of fish) {
    f.holder.rotation.y = spin ? Math.sin(t * 0.6) * 0.9 : 0.25;
    f.holder.rotation.x = 0.12;
    f.model.update(dt);
  }
  renderer.render(scene, camera);
  labels.innerHTML = fish.map(f => {
    tmp.copy(f.holder.position).setY(f.holder.position.y + 0.3).project(camera);
    return `<span style="left:${(tmp.x + 1) / 2 * innerWidth}px;top:${(1 - tmp.y) / 2 * innerHeight}px">${f.sp.name}</span>`;
  }).join('');
  requestAnimationFrame(frame);
}
frame();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

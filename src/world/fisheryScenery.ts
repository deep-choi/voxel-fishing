import * as THREE from 'three';
import { ACTIVE_FISHERY as map } from '../game/fisheries';
import { heightAt, SHORE_Z, waterDepth } from './lake';
import { mulberry } from './noise';

/** 색만 바꾸지 않고 수초·별·바위·관리형 둑 등 각 낚시터의 복셀 소품을 만든다. */
export function createFisheryScenery(): THREE.Group {
  const group = new THREE.Group();
  const blocks: { x: number; y: number; z: number; w: number; h: number; d: number; color: string }[] = [];
  const add = (x: number, y: number, z: number, w: number, h: number, d: number, color: string) => blocks.push({ x, y, z, w, h, d, color });
  const rnd = mulberry(map.terrain.seed + 200);
  if (map.id === 'willow' || map.id === 'lotus') {
    for (let i = 0; i < 180; i++) {
      const x = (rnd() - 0.5) * map.terrain.rx * 1.9;
      const z = SHORE_Z - 15 - rnd() * 180;
      // 세 대를 던지는 좌대 앞 포인트는 비워 둔다.
      if (Math.abs(x) < map.platforms.gap + 17) continue;
      const depth = waterDepth(x, z);
      if (depth <= 0 || depth > 3.8) continue;
      if (map.id === 'lotus') {
        const size = 0.8 + rnd() * 1.4;
        add(x, 0.055, z, size, 0.08, size * 0.8, i % 3 ? '#438749' : '#78a552');
        if (i % 5 === 0) {
          add(x, 0.14, z, 0.23, 0.13, 0.23, '#f5c0cd');
          add(x, 0.24, z, 0.12, 0.1, 0.12, '#fff0b9');
        }
      } else if (depth < 1.2) {
        for (let j = 0; j < 4; j++) {
          const h = 1.2 + rnd();
          add(x + (rnd() - 0.5), h / 2 - 0.1, z + rnd(), 0.09, h, 0.09, '#999457');
          add(x, h, z, 0.22, 0.32, 0.2, '#b3a373');
        }
      }
    }
  }
  if (map.id === 'moon') {
    for (let i = 0; i < 70; i++) {
      const side = i % 2 ? -1 : 1;
      const x = side * (map.terrain.rx + rnd() * 30);
      const z = map.terrain.cz + (rnd() - 0.5) * 270;
      const h = 1 + rnd() * 5;
      add(x, heightAt(x, z) + h / 2, z, 2 + rnd() * 4, h, 2 + rnd() * 3, i % 3 ? '#84969e' : '#657480');
    }
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) positions.set([(rnd() - 0.5) * 2400, 250 + rnd() * 1000, SHORE_Z - 600 - rnd() * 1600], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#daeaff', size: 3.5, fog: false, transparent: true, opacity: 0.75 }));
    stars.name = 'fishery-stars';
    group.add(stars);
  }
  if (map.id === 'gold') {
    const { cx, cz, rx, rz } = map.terrain;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 30; i++) {
        const z = cz - rz * 0.8 + i * rz * 1.6 / 29;
        const x = cx + side * (rx + 3);
        const y = heightAt(x, z);
        add(x, y + 0.7, z, 0.18, 1.4, 0.18, '#aa9271');
        add(x, y + 0.9, z, 0.12, 0.15, rz * 1.6 / 29 + 0.2, '#d3c19d');
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = -110 + i * 20, z = SHORE_Z + 7;
      add(x, heightAt(x, z) + 0.2, z, 2.5, 0.4, 2.5, i % 2 ? '#bdc870' : '#c9a762');
    }
  }
  if (blocks.length) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), blocks.length);
    const matrix = new THREE.Matrix4();
    blocks.forEach((b, i) => {
      matrix.makeScale(b.w, b.h, b.d); matrix.setPosition(b.x, b.y, b.z);
      mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, new THREE.Color(b.color));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

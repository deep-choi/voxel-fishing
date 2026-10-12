import * as THREE from 'three';
import { lakeQ, SEAT } from './lake';
import { mulberry } from './noise';
import { ACTIVE_FISHERY } from '../game/fisheries';

// 이른 아침 저수지 물안개: 수면 위에 낮게 깔려 천천히 흐른다.

function mistTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const r = mulberry(33);
  // 부드러운 덩어리 여러 개를 겹쳐 가장자리가 불규칙한 안개 조각
  for (let i = 0; i < 40; i++) {
    const x = 40 + r() * 176;
    const y = 50 + r() * 40;
    const rad = 18 + r() * 34;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Mist {
  readonly group = new THREE.Group();
  private readonly sprites: { s: THREE.Sprite; vx: number; base: THREE.Vector3; o: number }[] = [];

  constructor() {
    const tex = mistTexture();
    const r = mulberry(12);
    let tries = 0;
    while (this.sprites.length < 46 && tries++ < 2000) {
      const x = ACTIVE_FISHERY.terrain.cx + (r() - 0.5) * ACTIVE_FISHERY.terrain.rx * 1.6;
      const z = ACTIVE_FISHERY.terrain.cz + (r() - 0.5) * ACTIVE_FISHERY.terrain.rz * 1.3;
      if (lakeQ(x, z) > 0.97) continue;
      const d = Math.hypot(x - SEAT.x, z - SEAT.z);
      if (d < 55) continue;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: new THREE.Color(ACTIVE_FISHERY.palette.fog),
        transparent: true,
        opacity: 0.12 + r() * 0.16,
        depthWrite: false,
        fog: true,
      });
      const s = new THREE.Sprite(mat);
      const w = 35 + r() * 55;
      s.scale.set(w, w * 0.12, 1);
      s.center.set(0.5, 0.3);
      const base = new THREE.Vector3(x, 0.2 + r() * 1.2, z);
      s.position.copy(base);
      s.renderOrder = 5;
      this.group.add(s);
      this.sprites.push({ s, vx: 0.25 + r() * 0.35, base, o: mat.opacity });
    }
  }

  update(t: number) {
    for (const m of this.sprites) {
      // 바람 방향으로 흘러가다 저수지 끝에서 되돌아 나타난다
      const x = ((m.base.x + t * m.vx + 200) % 400) - 200;
      m.s.position.set(x, m.base.y, m.base.z);
      const inLake = lakeQ(x, m.base.z) < 0.97 ? 1 : 0;
      const mat = m.s.material as THREE.SpriteMaterial;
      mat.opacity += (inLake * m.o - mat.opacity) * 0.02;
    }
  }
}

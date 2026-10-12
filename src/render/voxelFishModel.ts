import * as THREE from 'three';
import { BODY_CELLS, FIN_CELLS, artSize, cellAt, cellColor, halfWidth, type FishLook } from '../game/fishArt';

interface Voxel { x: number; y: number; z: number; w: number; h: number; d: number; color: THREE.Color; u: number }

/**
 * 도트 옆모습(game/fishArt.ts)을 몸 두께만큼 쌓은 복셀 물고기.
 * 로컬 단위에서 입~꼬리 끝 길이가 1이고, group.scale이 실제 전장(m)이다.
 */
export class VoxelFishModel {
  readonly group = new THREE.Group();
  amp = 0.04;
  freq = 2;
  bend = 0;
  private time = 0;
  private readonly nose = new THREE.Vector3();
  private readonly voxels: Voxel[] = [];
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly material = new THREE.MeshLambertMaterial();
  private readonly mesh: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly offset = new THREE.Vector3();

  constructor(readonly look: FishLook, lengthM: number) {
    const { cols, rows } = artSize(look);
    const cell = 1 / cols;
    // 입이 있는 줄을 y=0으로 둔다 (바늘이 입에 걸린다)
    const mouth: [number, number][] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (cellAt(look, c, r) === 'M') mouth.push([c, r]);
    const mouthCol = Math.min(...mouth.map(m => m[0]));
    const mouthRow = mouth.filter(m => m[0] === mouthCol).reduce((s, m) => s + m[1], 0) / mouth.filter(m => m[0] === mouthCol).length;
    const px = (c: number) => 0.5 - (c + 0.5) * cell;
    const py = (r: number) => (mouthRow - r) * cell;
    this.nose.set(px(mouthCol) + cell * 0.5, 0, 0);

    // 열마다 몸통 위아래 끝을 찾아 타원 단면으로 두께를 준다
    const thick = (c: number, r: number) => {
      let top = r, bottom = r;
      while (BODY_CELLS.includes(cellAt(look, c, top - 1))) top--;
      while (BODY_CELLS.includes(cellAt(look, c, bottom + 1))) bottom++;
      const half = (bottom - top) / 2 + 0.5, t = (r - (top + bottom) / 2) / half;
      // 각진 타원 단면: 옆구리가 평평하고 등·배 쪽에서만 좁아진다
      return Math.max(0, Math.round(halfWidth(look, c) * Math.pow(Math.max(0, 1 - Math.abs(t) ** 2.6), 1 / 2.6)));
    };
    const color = (ch: string, c: number, r: number) => {
      const [cr, cg, cb] = cellColor(look, ch, c, r);
      return new THREE.Color().setRGB(cr, cg, cb, THREE.SRGBColorSpace);
    };
    const solid = new Set<string>();
    const body: { c: number; r: number; z: number; ch: string; n: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ch = cellAt(look, c, r);
      if (!BODY_CELLS.includes(ch)) continue;
      const n = thick(c, r);
      for (let z = -n; z <= n; z++) { body.push({ c, r, z, ch, n }); solid.add(`${c},${r},${z}`); }
    }
    for (const v of body) {
      // 다른 칸에 완전히 둘러싸인 속은 그리지 않는다
      const hidden = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].every(([a, b, e]) => solid.has(`${v.c + a},${v.r + b},${v.z + e}`));
      if (hidden) continue;
      // 눈·아가미·가슴지느러미 자리는 옆면에만 그 색을 쓴다
      const sideOnly = 'EKGP'.includes(v.ch) && Math.abs(v.z) < v.n;
      this.box(px(v.c), py(v.r), v.z * cell, cell, cell, cell, color(sideOnly ? (v.r < mouthRow ? 'B' : 'S') : v.ch === 'P' ? 'S' : v.ch, v.c, v.r));
      if (v.ch === 'P' && Math.abs(v.z) === v.n && v.z !== 0) {
        const s = Math.sign(v.z);
        this.box(px(v.c + 0.6), py(v.r + 0.3), (v.z + s * 0.7) * cell, cell * 1.1, cell, cell * 0.45, color('P', v.c, v.r));
      }
    }
    // 지느러미는 얇은 판, 수염은 머리 양옆으로 늘어진 가는 줄
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ch = cellAt(look, c, r);
      if (FIN_CELLS.includes(ch)) this.box(px(c), py(r), 0, cell, cell, cell * 0.45, color(ch, c, r));
      if (ch === 'R') {
        const z = (Math.round(halfWidth(look, mouthCol)) * 0.8 + 0.4) * cell;
        for (const s of [-1, 1]) this.box(px(c), py(r), s * z, cell, cell * 0.45, cell * 0.45, color('R', c, r));
      }
    }

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.voxels.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.voxels.forEach((v, i) => this.mesh.setColorAt(i, v.color));
    this.group.add(this.mesh);
    this.group.scale.setScalar(lengthM);
    this.update(0);
  }

  private box(x: number, y: number, z: number, w: number, h: number, d: number, color: THREE.Color) {
    this.voxels.push({ x, y, z, w, h, d, color, u: Math.max(0, this.nose.x - x) });
  }
  update(dt: number) {
    this.time += dt;
    this.voxels.forEach((v, i) => {
      const wave = Math.sin(this.time * this.freq * Math.PI * 2 - v.u * 7) * this.amp * v.u ** 1.8;
      this.matrix.makeScale(v.w, v.h, v.d);
      this.matrix.setPosition(v.x, v.y, v.z + wave + this.bend * v.u * v.u * 0.2);
      this.mesh.setMatrixAt(i, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  /** 물리 위치는 바늘이 걸린 입이다. 몸통이 흔들려도 입과 바늘은 떨어지지 않는다. */
  attachMouth(world: THREE.Vector3) {
    this.offset.copy(this.nose).multiply(this.group.scale).applyQuaternion(this.group.quaternion);
    this.group.position.copy(world).sub(this.offset);
  }
  getMouth(out: THREE.Vector3) {
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(out.copy(this.nose));
  }
  dispose() { this.geometry.dispose(); this.material.dispose(); }
}

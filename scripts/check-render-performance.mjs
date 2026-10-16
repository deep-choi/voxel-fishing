import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

globalThis.location = { search: '' };
// 물보라의 그라데이션 텍스처 생성에만 쓰는 최소 캔버스.
globalThis.document = { createElement: () => ({ getContext: () => ({
  createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {},
}) }) };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { FrameLimit } = await server.ssrLoadModule('/src/render/frameLimit.ts');
  for (const hz of [30, 60, 90, 120, 144, 165, 240]) {
    const clock = new FrameLimit();
    let frames = 0;
    for (let i = 0; i < hz * 10; i++) if (clock.ready(i * 1000 / hz)) frames++;
    assert.equal(frames, Math.min(60, hz) * 10, `${hz}Hz: 60FPS cap without halving 60Hz`);
    assert.equal(clock.ready(60_000), true, 'late frames resume once');
    assert.equal(clock.ready(60_001), false, 'no burst of catch-up frames');
    clock.reset();
    assert.equal(clock.ready(60_002), true, 'visibility resume starts a fresh schedule');
  }

  const { Splashes } = await server.ssrLoadModule('/src/render/tackle.ts');
  const splashes = new Splashes();
  const positions = splashes.points.geometry.attributes.position;
  const initialVersion = positions.version;
  splashes.update(1 / 60);
  assert.equal(positions.version, initialVersion, 'idle particles must not upload buffers');
  assert.equal(splashes.points.visible, false);
  // Overwrite the circular pool to check active counts do not leak.
  for (let i = 0; i < 20; i++) splashes.burst(0, 0, 1);
  assert.equal(splashes.points.visible, true);
  splashes.update(1 / 60);
  assert.ok(positions.version > initialVersion);
  for (let i = 0; i < 300; i++) splashes.update(1 / 60);
  assert.equal(splashes.points.visible, false, 'all particles expire after pool wrap');
  const settledVersion = positions.version;
  splashes.update(1 / 60);
  assert.equal(positions.version, settledVersion, 'uploads stop again after expiry');
  splashes.burst(0, 0, 0.3);
  assert.equal(splashes.points.visible, true, 'later splashes reactivate');

  const { Water } = await server.ssrLoadModule('/src/world/water.ts');
  const { shared } = await server.ssrLoadModule('/src/world/sky.ts');
  const water = new Water();
  const uniforms = water.mesh.material.uniforms;
  water.update(0);
  assert.equal(uniforms.uRipCount.value, 0);
  shared.uTime.value = 2;
  water.ripple(10, -20, 0.8);
  water.ripple(30, -40, 0);
  water.update(2);
  assert.equal(uniforms.uRipCount.value, 1, 'only live, nonzero ripples reach the shader');
  assert.deepEqual(uniforms.uRip.value[0].toArray(), [10, -20, 2, 0.8]);
  water.update(9);
  assert.equal(uniforms.uRipCount.value, 1, 'preserve the original seven-second lifetime');
  water.update(9.01);
  assert.equal(uniforms.uRipCount.value, 0);
  shared.uTime.value = 10;
  for (let i = 0; i < 20; i++) water.ripple(i, -i, 1);
  water.update(10);
  assert.equal(uniforms.uRipCount.value, 16, 'circular ripple pool remains bounded');
  assert.deepEqual(uniforms.uRip.value.slice(0, 16).map(v => v.x).sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i + 4), 'newest sixteen ripples survive pool wrap');
  water.mesh.dispose();

  const { createVoxelWorld } = await server.ssrLoadModule('/src/world/voxel.ts');
  const { Platforms } = await server.ssrLoadModule('/src/world/platforms.ts');
  const platforms = new Platforms();
  const markerBatch = platforms.group.children.find(o => o.isInstancedMesh && o.count === platforms.slots.length);
  assert.ok(markerBatch, 'slot markers must be rendered in one batch');
  assert.equal(platforms.slots.length, 72);
  assert.ok(platforms.slots.every(slot => slot.marker.parent === null), 'individual markers must not cause draw calls');
  const occupied = new Set([platforms.slots[0].id]);
  platforms.updateMarkers(occupied);
  const markerVersion = markerBatch.instanceColor.version;
  platforms.updateMarkers(occupied);
  assert.equal(markerBatch.instanceColor.version, markerVersion, 'unchanged markers do not upload colors');
  const markerColor = new THREE.Color();
  const matchesColor = hex => markerColor.toArray().every((v, i) => Math.abs(v - new THREE.Color(hex).toArray()[i]) < 1e-6);
  markerBatch.getColorAt(0, markerColor);
  assert.ok(matchesColor('#83b8a4'), 'occupied slot stays green');
  markerBatch.getColorAt(1, markerColor);
  assert.ok(matchesColor('#eac67d'), 'empty slot stays yellow');
  occupied.clear();
  platforms.updateMarkers(occupied);
  assert.equal(markerBatch.instanceColor.version, markerVersion + 1);
  markerBatch.getColorAt(0, markerColor);
  assert.ok(matchesColor('#eac67d'), 'recalled slot becomes yellow again');
  const { PLAYER } = await server.ssrLoadModule('/src/world/lake.ts');
  const world = createVoxelWorld();
  world.updateMatrixWorld(true);
  let totalInstances = 0;
  const instanceBounds = new THREE.Box3();
  const matrix = new THREE.Matrix4();
  for (const mesh of world.children) {
    totalInstances += mesh.count;
    mesh.geometry.computeBoundingBox();
    const bounds = new THREE.Box3().setFromObject(mesh);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      instanceBounds.copy(mesh.geometry.boundingBox).applyMatrix4(matrix);
      assert.ok(bounds.containsBox(instanceBounds), 'batch bounds must enclose every block, including edges');
    }
  }
  assert.equal(totalInstances, 240546, 'default map keeps the full original block count');
  const baselineTriangles = totalInstances * 12;
  const scenarios = [
    ['entry', [66, 42, 226], [0, 0, 113], 55],
    ['forward', [PLAYER.x, 2.4, PLAYER.z], [PLAYER.x, 2.3, PLAYER.z - 100], 55],
    ['zoom', [PLAYER.x, 2.4, PLAYER.z], [PLAYER.x, 1, PLAYER.z - 40], 18],
  ];
  for (const [name, position, target, fov] of scenarios) {
    const camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.03, 12000);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let triangles = 0, calls = 0;
    for (const mesh of world.children) {
      if (frustum.intersectsObject(mesh)) { triangles += mesh.count * mesh.geometry.index.count / 3; calls++; }
    }
    assert.ok(triangles < baselineTriangles * 0.8, `${name}: remove at least 20% of submitted triangles`);
    assert.ok(calls <= 17, 'face batching must not create excessive draw calls');
    console.log(`${name}: ${baselineTriangles.toLocaleString()} -> ${triangles.toLocaleString()} triangles (${(100 * (1 - triangles / baselineTriangles)).toFixed(1)}% fewer), ${calls} world draw calls`);
  }
  console.log('PASS: 60FPS scheduling, particle/ripple lifecycle, batch bounds and submission budgets');
} finally {
  await server.close();
}

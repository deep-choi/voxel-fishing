import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.location = { search: '' };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PlayerProgress } = await server.ssrLoadModule('/src/game/profile.ts');
  const { Fishing } = await server.ssrLoadModule('/src/game/fishing.ts');
  const { createFeedBlend } = await server.ssrLoadModule('/src/game/feedMixing.ts');
  const { baitAffinity } = await server.ssrLoadModule('/src/game/ecology.ts');
  const { SPECIES } = await server.ssrLoadModule('/src/game/data.ts');
  const { baitProduct } = await server.ssrLoadModule('/src/game/realCatalog.ts');
  let saved;
  const repository = { load: () => saved, save: data => { saved = structuredClone(data); } };
  const player = new PlayerProgress(repository);
  const part = (key, count) => ({ key, count });
  const draft = {
    name: '경원 + 마루큐 내 배합', use: 'hook',
    parts: [part('product:kw-aqua2', 3), part('product:mq-wata', 2), part('ingredient:bran', 1)],
  };
  const oldGeneric = player.genericBaitCount('pellet');
  const before = structuredClone(player.data);
  assert.equal(player.craftFeed(draft).ok, true);
  const blend = player.data.baitBlends[0];
  assert.equal(blend.count, 6);
  assert.equal(player.data.baitProducts['kw-aqua2'], before.baitProducts['kw-aqua2'] - 3);
  assert.equal(player.data.baitProducts['mq-wata'], before.baitProducts['mq-wata'] - 2);
  assert.equal(player.data.ingredients.bran, before.ingredients.bran - 1);
  assert.equal(player.data.baitProducts[blend.id], 6);
  assert.equal(player.genericBaitCount('pellet'), oldGeneric);
  assert.ok(blend.desc.includes(`${baitProduct('kw-aqua2').name} 50%`));
  assert.ok(blend.desc.includes(`${baitProduct('mq-wata').name} 33%`));

  // Failed attempts must leave all ingredients, brand totals, and batches untouched.
  for (const parts of [
    [], [part('product:mq-wata', 100)], [part('ingredient:bran', -1)],
    [part('ingredient:bran', 0.5)], [part('ingredient:bran', NaN)],
    [part('unknown', 1)], [part('ingredient:bran', 1001)],
    [part('product:kw-aqua2', 2), part('product:kw-aqua2', 2)],
    [part(`product:${blend.id}`, 1)],
  ]) {
    const snapshot = JSON.stringify(player.data);
    assert.equal(player.craftFeed({ ...draft, parts }).ok, false);
    assert.equal(JSON.stringify(player.data), snapshot);
  }

  player.data.rig.bait = blend.baseBait;
  player.data.rig.baitProductId = blend.id;
  player.save();
  let restored = new PlayerProgress(repository);
  assert.equal(restored.data.rig.baitProductId, blend.id);
  assert.deepEqual(restored.baitProduct(blend.id).parts, blend.parts);
  const game = new Fishing({ x: 0, z: -50 }, restored);
  game.setRig(restored.data.rig);
  assert.equal(game.baitName, draft.name);
  assert.equal(restored.consumeBait(blend.baseBait, blend.id), true);
  assert.equal(restored.data.baitProducts[blend.id], 5);
  assert.equal(restored.genericBaitCount('pellet'), oldGeneric);
  assert.equal(new PlayerProgress({ load: () => null, save() {} }).baitProduct(blend.id), undefined);

  // Ratios change the preference smoothly, rather than selecting a preset result.
  const mix = (a, b) => createFeedBlend('test', { name: '', use: 'hook', parts: [part('product:kw-aqua2', a), part('product:mq-wata', b)] });
  const fishHeavy = mix(8, 2), balanced = mix(5, 5), glutenHeavy = mix(2, 8);
  assert.ok(baitAffinity(SPECIES.mirror, fishHeavy.baseBait, fishHeavy) > baitAffinity(SPECIES.mirror, glutenHeavy.baseBait, glutenHeavy));
  assert.ok(glutenHeavy.holdingScale > fishHeavy.holdingScale);
  for (const sp of Object.values(SPECIES)) assert.ok(Math.abs(balanced.blendPreferences[sp.id] - (fishHeavy.blendPreferences[sp.id] + glutenHeavy.blendPreferences[sp.id]) / 2) < 1e-10);
  const single = key => createFeedBlend('test', { name: '', use: 'hook', parts: [part(key, 1)] });
  assert.notEqual(single('ingredient:barley').blendPreferences.crucian, single('ingredient:strawberry').blendPreferences.crucian);

  // Legacy profiles keep inventory; derived performance cannot be injected through storage.
  const legacy = structuredClone(before);
  delete legacy.baitBlends; delete legacy.ingredients.barley; delete legacy.ingredients.strawberry;
  const migrated = new PlayerProgress({ load: () => legacy, save() {} });
  assert.equal(migrated.data.ingredients.barley, 0);
  assert.equal(migrated.data.baitProducts['kw-aqua2'], before.baitProducts['kw-aqua2']);
  const tampered = structuredClone(saved);
  tampered.baitBlends[0].holdingScale = 999;
  tampered.baitBlends[0].blendPreferences = { carp: 999 };
  const sanitized = new PlayerProgress({ load: () => tampered, save() {} });
  assert.equal(sanitized.baitProduct(blend.id).holdingScale, blend.holdingScale);
  assert.equal(sanitized.baitProduct(blend.id).blendPreferences.carp, blend.blendPreferences.carp);
  console.log('PASS: free mixing, atomic inventory, ratio effects, bait use, reload, legacy saves and isolated profiles.');
} finally {
  await server.close();
}

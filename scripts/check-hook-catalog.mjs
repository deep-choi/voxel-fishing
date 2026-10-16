import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.location = { search: '' };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { HOOKS } = await server.ssrLoadModule('/src/game/data.ts');
  const { getHookTraits } = await server.ssrLoadModule('/src/game/hookTraits.ts');
  const { hookGap, hookLoad } = await server.ssrLoadModule('/src/game/rigMechanics.ts');
  const { productBrand } = await server.ssrLoadModule('/src/game/fictionalBrands.ts');
  const { PlayerProgress } = await server.ssrLoadModule('/src/game/profile.ts');
  const { shopPanel } = await server.ssrLoadModule('/src/ui/panels.ts');
  const legacyIds = ['small', 'medium', 'large', 'sharp', 'monster', 'ise5', 'ise9', 'owner7',
    ...['entry', 'fine', 'balance', 'forged', 'master'].map(id => `willow-${id}`),
    ...['silkhook', 'grainhook', 'cornhook', 'ironhook'].flatMap(id => [1, 2, 3, 4].map(stage => `willow-${id}-${stage}`)),
    ...['crucian', 'carp', 'catfish', 'allround'].flatMap(id => [1, 2, 3, 4].map(stage => `specialist-${id}-${stage}`))];
  const byId = new Map(HOOKS.map(hook => [hook.id, hook]));
  assert.equal(byId.size, HOOKS.length, 'purchase IDs must be unique');
  for (const id of legacyIds) assert.ok(byId.has(id), `saved hook ${id} must remain available`);

  const models = new Map();
  for (const hook of HOOKS) {
    assert.ok(hook.modelId && hook.modelName && hook.brandId && Number.isInteger(hook.size), hook.id);
    assert.equal(productBrand('hook', hook).id, hook.brandId, 'size must not change the brand');
    assert.equal(hook.name, `${hook.modelName} ${hook.size}호`);
    for (const n of [hookGap(hook), hookLoad(hook), hook.wireMm, hook.attraction, hook.sharpness]) assert.ok(Number.isFinite(n) && n > 0, hook.id);
    const variants = models.get(hook.modelId) ?? [];
    variants.push(hook);
    models.set(hook.modelId, variants);
  }
  const commonFields = ['brandId', 'modelName', 'rarity', 'price', 'level', 'sharpness', 'shape', 'barbed'];
  for (const [id, variants] of models) {
    assert.equal(new Set(variants.map(hook => hook.size)).size, variants.length, `${id} has duplicate sizes`);
    for (const field of commonFields) assert.equal(new Set(variants.map(hook => hook[field])).size, 1, `${id}: ${field} must belong to the product`);
    const ordered = variants.slice().sort((a, b) => a.size - b.size);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(hookGap(ordered[i]) > hookGap(ordered[i - 1]), `${id}: larger size must have a wider gap`);
      assert.ok(hookLoad(ordered[i]) > hookLoad(ordered[i - 1]), `${id}: larger size must support more load`);
      assert.ok(getHookTraits(ordered[i]).wireMm >= getHookTraits(ordered[i - 1]).wireMm, `${id}: larger size cannot have thinner wire`);
    }
  }

  let saved;
  const repository = { load: () => saved, save: data => { saved = structuredClone(data); } };
  const player = new PlayerProgress(repository);
  const ui = { shopTab: 'hook', shopModel: null, shopBrand: null };
  const context = { player, ui };
  const cardIds = html => [...html.matchAll(/data-act="shop-model" data-id="hook:([^"]+)"/g)].map(match => match[1]);
  const list = shopPanel(context);
  assert.deepEqual(new Set(cardIds(list)), new Set(models.keys()), 'shop must show separate product cards, not just broad hook types');
  assert.ok(!list.includes('원부터'), 'hook prices belong to models, not sizes');
  for (const [id, variants] of models) {
    ui.shopModel = `hook:${id}`;
    const html = shopPanel(context);
    const buyIds = [...html.matchAll(/data-act="buy" data-kind="hook" data-id="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(new Set(buyIds), new Set(variants.map(hook => hook.id)), `${id}: detail must only contain its sizes`);
    assert.ok(html.includes(`<h3>${variants[0].modelName}</h3>`));
    assert.equal([...html.matchAll(/class="item-quality quality-\d"/g)].length, 1, `${id}: quality should appear once at product level`);
  }
  ui.shopModel = null;
  for (const brandId of new Set(HOOKS.map(hook => hook.brandId))) {
    ui.shopBrand = brandId;
    const expected = [...models].filter(([, variants]) => variants[0].brandId === brandId).map(([id]) => id);
    assert.deepEqual(new Set(cardIds(shopPanel(context))), new Set(expected), 'brand filter must select models');
  }
  ui.shopBrand = null;
  // 품질은 필터가 아니라 카드의 별로 보여 준다: 모든 모델 카드에 별이 하나씩 있다
  assert.equal([...shopPanel(context).matchAll(/class="item-stars"/g)].length, models.size, 'every model card shows quality stars');

  // Buying sizes is independent, and both old and new IDs survive a save/reload with the rig intact.
  player.data.coins = 100000;
  const sizes = models.get('sodam-economy');
  const coins = player.data.coins;
  assert.ok(player.buy('hook', sizes[0].id).endsWith('구매 완료'));
  assert.equal(player.owns('hook', sizes[1].id), false);
  assert.ok(player.buy('hook', sizes[1].id).endsWith('구매 완료'));
  assert.equal(player.data.coins, coins - sizes[0].price - sizes[1].price);
  player.data.hooks = [...new Set([...legacyIds, ...player.data.hooks])];
  player.data.rig.hookId = sizes[1].id;
  player.save();
  const restored = new PlayerProgress(repository);
  for (const id of player.data.hooks) assert.equal(restored.owns('hook', id), true, `restore ${id}`);
  assert.equal(restored.data.rig.hookId, sizes[1].id);

  console.log(`PASS: ${models.size} hook models / ${HOOKS.length} sizes; product identity, size rules, shop rendering, filters, purchases and save compatibility`);
} finally {
  await server.close();
}

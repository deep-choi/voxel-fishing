import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.location = { search: '' };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { chooseSave, compactForServer, xpOf } = await server.ssrLoadModule('/src/game/saveChoice.ts');
  const { PlayerProgress } = await server.ssrLoadModule('/src/game/profile.ts');
  const save = (xp, savedAt, extra = {}) => ({ savedAt, data: { version: 1, xp, ...extra } });

  // ── 어떤 저장본을 쓸지 ──
  const none = chooseSave({ cache: null, server: null, legacy: null, legacyClaimed: false });
  assert.deepEqual([none.pick, none.source, none.pushToServer], [null, 'none', false], '저장이 없으면 새 진행');

  const serverOnly = chooseSave({ cache: null, server: save(10, 100), legacy: null, legacyClaimed: false });
  assert.deepEqual([serverOnly.source, serverOnly.pushToServer], ['server', false], '새 기기: 서버 저장을 쓰고 다시 올리지 않는다');

  const cacheNewer = chooseSave({ cache: save(20, 200), server: save(10, 100), legacy: null, legacyClaimed: false });
  assert.deepEqual([cacheNewer.source, cacheNewer.pushToServer], ['cache', true], '기기에 더 늦은 저장이 있으면(올리다 만 진행) 그걸 쓰고 서버에 올린다');

  const serverNewer = chooseSave({ cache: save(20, 100), server: save(30, 200), legacy: null, legacyClaimed: false });
  assert.deepEqual([serverNewer.source, serverNewer.pushToServer], ['server', false], '다른 기기에서 더 늦게 저장했으면 서버 저장');
  const tie = chooseSave({ cache: save(20, 100), server: save(30, 100), legacy: null, legacyClaimed: false });
  assert.equal(tie.source, 'server', '같은 시각이면 서버');

  const offlineCache = chooseSave({ cache: save(20, 100), server: null, legacy: null, legacyClaimed: false });
  assert.deepEqual([offlineCache.source, offlineCache.pushToServer], ['cache', true]);

  // 구버전(계정 구분 없던) 기기 저장 이전
  const legacy = { version: 1, xp: 500 };
  const firstLogin = chooseSave({ cache: null, server: null, legacy, legacyClaimed: false });
  assert.deepEqual([firstLogin.source, firstLogin.pushToServer, xpOf(firstLogin.pick.data)], ['legacy', true, 500], '업데이트 뒤 첫 로그인: 기존 진행을 이어받아 서버에 올린다');
  const claimed = chooseSave({ cache: null, server: null, legacy, legacyClaimed: true });
  assert.equal(claimed.source, 'none', '이미 다른 계정이 가져갔으면 물려받지 않는다');
  const legacyMore = chooseSave({ cache: null, server: save(100, 999), legacy, legacyClaimed: false });
  assert.equal(legacyMore.source, 'legacy', '서버보다 기기 진행이 더 많으면 기기 쪽');
  const serverMore = chooseSave({ cache: null, server: save(900, 1), legacy, legacyClaimed: false });
  assert.deepEqual([serverMore.source, serverMore.pushToServer], ['server', false], '서버가 더 많이 진행했으면 서버 쪽');
  assert.equal(chooseSave({ cache: null, server: null, legacy: { version: 2, xp: 9 }, legacyClaimed: false }).source, 'none', '깨진 기기 저장은 무시');

  // ── 서버용 압축 ──
  const rig = { rodId: 'starter', floatId: 'basic', hookId: 'small', bait: 'worm', lineIdx: 1, depthSet: 2.4 };
  const catches = Array.from({ length: 4000 }, (_, i) => ({ id: `c${i}`, species: i % 2 ? 'carp' : 'crucian', cm: 20 + (i % 37), kg: 1, at: i, platform: 1, kept: false, sold: true, value: 10, rig }));
  catches[5] = { ...catches[5], kept: true, sold: false, released: false };
  catches[7] = { ...catches[7], species: 'crucian', cm: 99 };
  const big = { version: 1, xp: 1, catches };
  const limit = 400_000;
  assert.ok(JSON.stringify(big).length > limit, '테스트 데이터가 한도를 넘어야 한다');
  const small = compactForServer(big, limit);
  assert.ok(JSON.stringify(small).length <= limit, '한도 안으로 줄어든다');
  assert.ok(small.catches.some(c => c.id === 'c5'), '살림망 속 물고기는 남는다');
  assert.ok(small.catches.some(c => c.id === 'c7' && c.cm === 99), '어종별 최대어는 남는다');
  assert.ok(small.catches.at(-1).id === 'c3999', '최근 기록은 남는다');
  assert.equal(big.catches.length, 4000, '원본(기기 저장)은 줄이지 않는다');
  const roomy = compactForServer({ version: 1, catches: catches.slice(0, 10) }, limit);
  assert.equal(roomy.catches.length, 10, '한도 안이면 그대로');
  assert.ok(roomy.catches[0].rig, '한도 안이면 채비 정보도 그대로');

  // ── 같은 인스턴스에 다른 계정의 진행 다시 불러오기 ──
  let stored;
  const player = new PlayerProgress({ load: () => null, save: data => { stored = structuredClone(data); } });
  assert.equal(player.data.coins, 500, '로그인 전에는 새 진행');
  const first = structuredClone(player.data);
  first.coins = 7777; first.xp = 4000; first.rods.starter = 2;
  first.catches = [{ id: 'a', species: 'carp', cm: 55, kg: 3, at: 1, platform: 1, kept: true, sold: false, value: 100 }];
  player.reload(first);
  assert.equal(player.data.coins, 7777);
  assert.equal(player.best.carp, 55);
  assert.equal(player.keepnet.length, 1, '살림망 물고기가 복원된다');

  const second = structuredClone(first);
  second.coins = 12; second.xp = 0; second.catches = [];
  player.reload(second);
  assert.equal(player.data.coins, 12);
  assert.equal(player.data.catches.length, 0);
  assert.equal(player.best.carp, undefined, '이전 계정의 최대어 기록이 남지 않는다');
  assert.equal(player.keepnet.length, 0, '이전 계정의 살림망이 남지 않는다');

  // 공유 맵: 지난 접속에서 설치한 낚싯대는 복원하지 않는다 (예전 저장에 placed가 있어도 가방으로)
  const withPlaced = structuredClone(first);
  withPlaced.placed = [{ slotId: '1-2-1', ownerId: 'x', rig: first.rig, fisheryId: 'willow' }];
  player.reload(withPlaced);
  assert.deepEqual(player.data.placed, [], '설치한 낚싯대는 불러오지 않는다');
  assert.equal(player.data.rods.starter, 2, '낚싯대는 가방에 그대로 있다');

  player.reload(null);
  assert.equal(player.data.coins, 500, '저장이 없으면 새 진행으로 돌아간다');
  assert.equal(player.data.xp, 0);
  player.save();
  assert.equal(stored.coins, 500, 'reload 뒤에도 같은 data를 저장한다');
  console.log('PASS: save choice (cache/server/legacy), server compaction, and account-safe reload.');
} finally {
  await server.close();
}

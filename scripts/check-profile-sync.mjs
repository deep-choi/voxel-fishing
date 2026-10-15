import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// 브라우저 환경 흉내: 기기 저장소, 타이머(프로세스를 붙잡지 않게), 페이지 이벤트
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { if (globalThis.__quotaFull) throw new Error('QuotaExceeded'); mem.set(k, String(v)); },
  removeItem: k => { mem.delete(k); },
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.document = { visibilityState: 'visible' };
const nativeSetTimeout = setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => { const t = nativeSetTimeout(fn, ms, ...args); t.unref?.(); return t; };
globalThis.location = { search: '' };

const dir = path.dirname(fileURLToPath(import.meta.url));
const server = await createServer({
  server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
  resolve: { alias: [
    { find: 'firebase/firestore', replacement: path.join(dir, 'fakes/firestore.mjs') },
    { find: /^\.\/firebase$/, replacement: path.join(dir, 'fakes/firebase-app.mjs') },
  ] },
});
try {
  const { ProfileSync } = await server.ssrLoadModule('/src/game/profileSync.ts');
  const { PlayerProgress } = await server.ssrLoadModule('/src/game/profile.ts');
  const fake = await server.ssrLoadModule('/scripts/fakes/firestore.mjs');
  const reset = () => { mem.clear(); fake.reset(); globalThis.__quotaFull = false; };
  const serverDoc = uid => fake.store.get(`saves/${uid}`);
  const serverData = uid => JSON.parse(serverDoc(uid).json);
  const sample = (xp, extra = {}) => ({ version: 1, xp, coins: 500, ...extra });

  // 1) 새 계정: 서버·기기·예전 저장 모두 없음 → 새 진행. 저장하면 기기에 즉시, flush하면 서버에도 간다
  reset();
  let sync = new ProfileSync();
  assert.equal(await sync.open('A'), null, '새 계정은 새 진행');
  assert.equal(sync.opened, true);
  sync.save(sample(1)); sync.save(sample(2));
  assert.equal(JSON.parse(mem.get('fishing-player-v2:A')).data.xp, 2, '기기에는 바로 저장');
  assert.equal(fake.control.writes, 0, '서버에는 모아서 올린다 (저장할 때마다 쓰지 않음)');
  await sync.flush();
  assert.equal(fake.control.writes, 1, '모인 저장은 한 번에');
  assert.deepEqual(Object.keys(serverDoc('A')).sort(), ['json', 'savedAt', 'updatedAt', 'version'], '규칙이 허용하는 필드만');
  assert.equal(serverData('A').xp, 2);

  // 2) 로그인 전·불러오기 전에는 저장하지 않는다 (새 진행이 서버 저장을 덮어쓰지 않게)
  reset();
  sync = new ProfileSync();
  sync.save(sample(9));
  await sync.flush();
  assert.equal(mem.size, 0, '불러오기 전 저장은 무시');
  assert.equal(fake.control.writes, 0);
  assert.equal(sync.opened, false);

  // 3) 서버를 못 읽고 기기 캐시도 없으면 시작하지 않는다
  reset(); fake.control.failReads = true;
  sync = new ProfileSync();
  await assert.rejects(() => sync.open('A'), '서버를 못 읽으면 입장 불가');
  assert.equal(sync.opened, false);
  sync.save(sample(3)); await sync.flush();
  assert.equal(fake.control.writes, 0, '불러오기 실패 상태에서는 서버에 아무것도 쓰지 않는다');

  // 4) 서버를 못 읽어도 이 계정의 기기 캐시가 있으면 이어서 하고, 연결되면 올린다
  reset();
  mem.set('fishing-player-v2:A', JSON.stringify({ savedAt: 50, data: sample(77) }));
  fake.control.failReads = true;
  sync = new ProfileSync();
  assert.equal((await sync.open('A')).xp, 77, '오프라인: 기기 캐시로 진행');
  fake.control.failReads = false;
  await sync.flush();
  assert.equal(serverData('A').xp, 77, '연결되면 서버에 올림');

  // 5) 새 기기: 서버 저장을 받고 되돌려 쓰지 않는다
  reset();
  fake.store.set('saves/A', { json: JSON.stringify(sample(300)), savedAt: 100, version: 1, updatedAt: {} });
  sync = new ProfileSync();
  assert.equal((await sync.open('A')).xp, 300, '다른 기기 진행을 받는다');
  await sync.flush();
  assert.equal(fake.control.writes, 0, '받기만 했으면 서버에 쓰지 않는다');
  assert.equal(JSON.parse(mem.get('fishing-player-v2:A')).data.xp, 300, '기기 캐시에도 보관');

  // 6) 계정 구분 없던 예전 기기 저장: 처음 로그인한 계정만 이어받는다
  reset();
  mem.set('fishing-player-v1', JSON.stringify(sample(500, { coins: 4242 })));
  sync = new ProfileSync();
  const migrated = await sync.open('A');
  assert.equal(migrated.coins, 4242, '업데이트 뒤 첫 로그인: 기존 진행 이어받기');
  await sync.flush();
  assert.equal(serverData('A').coins, 4242, '서버에 올라간다');
  assert.equal(mem.get('fishing-player-v1-claimed'), 'A');
  const other = new ProfileSync();
  assert.equal(await other.open('B'), null, '같은 폰의 다른 계정은 물려받지 않는다');
  const again = new ProfileSync();
  assert.equal((await again.open('A')).coins, 4242, '같은 계정은 다시 로그인해도 그대로');

  // 7) 서버 쓰기 실패: 진행은 기기에 남고, 다음 시도에 올라간다
  reset();
  sync = new ProfileSync();
  await sync.open('A');
  fake.control.failWrites = true;
  sync.save(sample(5));
  await sync.flush().catch(() => {});
  assert.equal(serverDoc('A'), undefined);
  assert.equal(JSON.parse(mem.get('fishing-player-v2:A')).data.xp, 5, '쓰기 실패해도 기기에는 남는다');
  fake.control.failWrites = false;
  await sync.flush();
  assert.equal(serverData('A').xp, 5, '다음에 다시 올라간다');

  // 8) 기기 저장 용량 부족은 그대로 알린다 (PlayerProgress.saveFailed)
  reset();
  sync = new ProfileSync();
  await sync.open('A');
  const player = new PlayerProgress(sync);
  player.save();
  assert.equal(player.saveFailed, false);
  globalThis.__quotaFull = true;
  player.save();
  assert.equal(player.saveFailed, true, '용량 부족을 화면에 알린다');

  // 9) 서버 문서가 커지면 줄여서 올리고, 기기에는 전부 남긴다
  reset();
  sync = new ProfileSync();
  await sync.open('A');
  const rig = { rodId: 'starter', floatId: 'basic', hookId: 'small', bait: 'worm', lineIdx: 1, depthSet: 2.4 };
  const catches = Array.from({ length: 9000 }, (_, i) => ({ id: `id-${i}-${'x'.repeat(30)}`, species: 'crucian', cm: 20 + (i % 30), kg: 1, at: i, platform: 1, kept: false, sold: true, value: 10, rig }));
  sync.save(sample(1, { catches }));
  await sync.flush();
  assert.ok(serverDoc('A').json.length <= 900_000, '서버 문서 한도 안');
  assert.equal(JSON.parse(mem.get('fishing-player-v2:A')).data.catches.length, 9000, '기기에는 전부');

  // 10) 진행 초기화: 서버·기기·예전 저장을 모두 지운다
  reset();
  mem.set('fishing-player-v1', JSON.stringify(sample(1)));
  mem.set('fishing-best', '{}');
  sync = new ProfileSync();
  await sync.open('A'); sync.save(sample(8)); await sync.flush();
  assert.ok(serverDoc('A'));
  await sync.wipe();
  assert.equal(serverDoc('A'), undefined);
  assert.equal([...mem.keys()].filter(k => k.startsWith('fishing-player-v2') || k === 'fishing-player-v1' || k === 'fishing-best').length, 0);
  assert.equal(await new ProfileSync().open('A'), null, '초기화 뒤 다시 로그인하면 새 진행');
  // 서버 삭제 실패 시 던지고, 기기 캐시는 남겨 둔다 (새로고침하면 서버 저장이 되살아나므로 화면에서 실패를 알린다)
  reset();
  sync = new ProfileSync();
  await sync.open('A'); sync.save(sample(8)); await sync.flush();
  fake.control.failWrites = true;
  await assert.rejects(() => sync.wipe(), '서버 삭제 실패는 알려야 한다');
  assert.ok(serverDoc('A'), '실패했으면 서버 저장은 그대로');

  console.log('PASS: ProfileSync open/save/flush, offline fallback, legacy claim, retry, compaction, wipe.');
} finally {
  await server.close();
}

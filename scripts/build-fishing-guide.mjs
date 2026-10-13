import { build } from 'vite';
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const site = path.join(workspace, 'sites', 'fishing-guide');
await mkdir(site, { recursive: true });
await build({
  configFile: false, root: workspace,
  build: { outDir: path.join(site, 'dist'), emptyOutDir: true, rolldownOptions: { input: path.join(workspace, 'fishing-guide.html') } },
});
await rename(path.join(site, 'dist', 'fishing-guide.html'), path.join(site, 'dist', 'index.html'));
const manifestPath = path.join(site, '.openai', 'hosting.json');
let manifest = {};
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
manifest.static = { directory: 'dist' };
await mkdir(path.dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(site, 'README.md'), '# 버들못 미끼·조과·상점 가이드\n\n현재 fishing 작업공간의 게임 계산 모듈과 상점 카탈로그 배열을 직접 사용하는 정적 안내 페이지입니다.\n\n미끼 선호·입질 확률과 상점 전체 미끼·떡밥 재료·낚시 장비의 게임 가격·해금 레벨·성능을 정리합니다. 상점 카탈로그는 #shop-catalog에서 검색과 분류를 제공합니다.\n\n원본: fishing-guide.html, src/dev/fishingGuide.ts, src/dev/fishingGuide.css, src/dev/shopCatalog.ts, src/dev/shopCatalog.css.\n갱신: 원본 작업공간에서 node scripts/build-fishing-guide.mjs 후 Sites 워크플로로 게시합니다.\n\n사이트에는 게임의 로그인 정보나 플레이어 저장 데이터를 포함하지 않습니다.\n');

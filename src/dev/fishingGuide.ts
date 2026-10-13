import { BAITS, BAIT_IDS, FLOATS, HOOKS, LINES, RODS, SPECIES_LIST, type BaitId, type SpeciesId } from '../game/data';
import { baitAffinity, biteProbability, encounterRates, type EncounterRate } from '../game/ecology';
import { Environment, WEATHER, type Weather } from '../game/environment';
import { ACTIVE_FISHERY } from '../game/fisheries';
import { SPECIES_RULES } from '../game/items';
import { BAIT_PRODUCTS, baitProduct } from '../game/realCatalog';
import { hookSetChance, rigSensitivity, selfHookChance, rodBreakLoad } from '../game/rigMechanics';
import { SHORE_Z, spotQuality, waterDepth } from '../world/lake';
import { fishIcon } from '../ui/pixelIcons';
import { connectShopCatalog, shopCatalogSection } from './shopCatalog';
import './fishingGuide.css';

const root = document.querySelector<HTMLElement>('#guide')!;
const esc = (s: string) => s.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const pct = (n: number) => n === 0 ? '0%' : n === 1 ? '100%' : n < 0.0001 ? '<0.01%' : `${(n * 100).toFixed(2)}%`;
const state = { bait: 'gluten', point: 0, hour: 6, weather: 'clear' as Weather, seconds: 300, line: 1, rod: 'starter', hook: 'small', float: 'basic', lift: 0, chum: 0, quality: 'perfect', species: null as SpeciesId | null };
const points = ACTIVE_FISHERY.platforms.names.map((name, i) => ({
  name: `${i + 1}번 ${name}`, x: (i % 2 ? 1 : -1) * ACTIVE_FISHERY.platforms.gap,
  z: SHORE_Z - 34 - Math.floor(i / 2) * ACTIVE_FISHERY.platforms.spacing,
}));
class GuideEnvironment extends Environment { get weather() { return state.weather; } }
const env = new GuideEnvironment();
const select = (id: string, label: string, values: { id: string | number; name: string }[], selected: string | number) => `<label>${label}<select id="${id}" data-control="${id}" aria-label="${esc(label)}">${values.map(v => `<option value="${esc(String(v.id))}" ${String(v.id) === String(selected) ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>`;
const activeName = { day: '낮', night: '밤', twilight: '새벽·저녁', any: '시간대 영향 없음' };
const fishName = (r: EncounterRate) => `<span class="fish-thumb">${fishIcon(r.sp.look)}</span><span><b>${r.sp.name}</b></span>`;

root.innerHTML = `<header class="masthead"><a href="#">버들못 <span>FIELD NOTES</span></a><nav><a href="#preferences">미끼 선호</a><a href="#probabilities">확률 비교</a><a href="#shop-catalog">상점 카탈로그</a><a href="#rules">계산 방식</a></nav></header>
  <section class="hero"><p class="eyebrow">게임 코드 기준 · 2026.10.13</p><h1>무엇을 달고,<br>무엇이 낚일까?</h1><p class="intro">15종의 미끼 취향과, 지금 조건에서 만날 확률.<br>미끼·포인트·채비를 바꾸며 비교해 보세요.</p><div class="hero-note"><span>15 어종·품종</span><span>6 기본 미끼</span><span>버들못 일반 모드</span></div></section>
  <section id="preferences" class="section"><div class="section-heading"><div><p class="eyebrow">01 / 미끼 취향</p><h2>어떤 미끼를 좋아할까</h2></div><p>표의 수치는 실제 입질 계산에 쓰이는 <b>미끼 배수</b>입니다.<br>미끼 이름을 누르면 아래 확률도 함께 바뀝니다.</p></div>
    <div class="table-scroll"><table class="preferences"><caption class="sr-only">어종별 기본 미끼 배수</caption><thead><tr><th scope="col">어종</th>${BAIT_IDS.map(id => `<th scope="col"><button data-bait="${id}">${BAITS[id].name}</button></th>`).join('')}<th scope="col">가장 좋아하는 미끼</th></tr></thead><tbody>${SPECIES_LIST.map(sp => {
      const sorted = BAIT_IDS.slice().sort((a, b) => sp.baits[b] - sp.baits[a]);
      return `<tr><th scope="row"><span class="fish-label"><span class="fish-thumb">${fishIcon(sp.look)}</span><b>${sp.name}</b></span></th>${BAIT_IDS.map(id => {
        const value = baitAffinity(sp, id);
        return `<td class="heat" style="--heat:${Math.min(1, value / 3).toFixed(3)}" title="선호값 ${sp.baits[id]} → 입질 배수 ${value.toFixed(3)}">${value === 0 ? '<span class="zero">—</span>' : `×${value.toFixed(2)}`}</td>`;
      }).join('')}<td class="favorite">${BAITS[sorted[0]].name}<small>${BAITS[sorted[1]].name}</small></td></tr>`;
    }).join('')}</tbody></table></div><p class="caption">선호값의 1.8제곱이 적용됩니다. 선호값 0.06 미만은 입질 배수 0(—). 예: 붕어 글루텐 1.4 → ×${baitAffinity(SPECIES_LIST.find(sp => sp.id === 'crucian')!, 'gluten').toFixed(2)}. 브랜드 제품은 여기에 제품별 보정이 추가됩니다.</p>
  </section>
  <section id="probabilities" class="section"><div class="section-heading"><div><p class="eyebrow">02 / 조건별 확률</p><h2>같은 미끼, 다른 조과</h2></div><p>입질 → 챔질 → 파이팅 → 랜딩<br><b>입질과 후킹</b>까지는 수치로 비교할 수 있습니다.</p></div>
    <div class="controls">
      <label>미끼<select id="bait" data-control="bait" aria-label="미끼"><optgroup label="기본 미끼">${BAIT_IDS.map(id => `<option value="${id}" ${id === state.bait ? 'selected' : ''}>${BAITS[id].name}</option>`).join('')}</optgroup><optgroup label="브랜드·상점 제품">${BAIT_PRODUCTS.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</optgroup></select></label>
      ${select('point', '포인트', points.map((p, i) => ({ id: i, name: p.name })), state.point)}
      ${select('hour', '게임 시간 · 1일차', Array.from({ length: 24 }, (_, i) => ({ id: i, name: `${String(i).padStart(2, '0')}:00` })), state.hour)}
      ${select('weather', '날씨', Object.entries(WEATHER).map(([id, w]) => ({ id, name: w.name })), state.weather)}
      ${select('seconds', '입질 대기 시간', [60, 300, 600].map(n => ({ id: n, name: `${n / 60}분` })), state.seconds)}
      ${select('quality', '챔질', [{ id: 'perfect', name: '정확한 구간에 챔질' }, { id: 'good', name: '일반 성공 구간에 챔질' }], state.quality)}
    </div>
    <details class="gear"><summary>채비와 바늘 미끼 축적</summary><div class="controls">
      ${select('line', '원줄 · 마모 없음', LINES.map((l, i) => ({ id: i, name: `${l.name} · ${l.strength}kgf` })), state.line)}
      ${select('hook', '바늘', HOOKS, state.hook)}${select('float', '찌', FLOATS, state.float)}${select('rod', '낚싯대', RODS, state.rod)}
      ${select('lift', '미끼 위치', [{ id: 0, name: '바닥 수심에 맞춤' }, { id: 0.3, name: '바닥에서 30cm 띄움' }, { id: 1, name: '바닥에서 1m 띄움' }], state.lift)}
      ${select('chum', '같은 자리의 미끼 풀림', [{ id: 0, name: '축적 없음' }, { id: 1, name: '중간 축적' }, { id: 2.2, name: '최대 축적' }], state.chum)}
    </div></details>
    <div id="condition" class="condition"></div><div id="stats" class="stats" aria-live="polite"></div>
    <div class="table-scroll"><table class="chances"><thead><tr><th scope="col">어종</th><th scope="col">첫 입질의 어종 비중</th><th scope="col" id="first-label"></th><th scope="col">챔질 성공률</th><th scope="col" id="hook-label"></th><th scope="col">선호 시간·수심</th></tr></thead><tbody id="chance-rows"></tbody></table></div>
    <p class="caption">어종 비중은 입질이 왔을 때의 조건부 확률입니다. 시간 내 확률은 <b>첫 입질 한 번</b>을 기준으로 하며, 반복 조과·캐스팅·찌 정착·입질 뒤 재대기 시간은 포함하지 않습니다. 후킹 확률은 선택한 구간에 반드시 직접 챔질한다는 조건이며 자연 입걸림은 제외합니다.</p>
    <div id="species-detail"></div>
  </section>
  ${shopCatalogSection()}
  <section id="rules" class="section rules"><div><p class="eyebrow">04 / 숫자를 읽는 법</p><h2>랜딩까지,<br>무엇이 달라질까</h2></div><div class="rule-body">
    <article><h3>1. 미끼와 포인트가 입질을 만듭니다</h3><p>어종의 기본 출현율 × 낚시터 개체군 × 미끼 선호 × 포인트·수심 × 원줄·바늘·찌 × 미끼 크기 × 집어 × 시간·날씨·수온·기압 × 제품 보정. 이 값을 분당 입질률 λ로 사용합니다.</p><p class="formula">대기 t초 안에 첫 입질: 1 − exp(−Σλ × t / 60)<br>첫 입질 어종 비중: 해당 어종 λ / 전체 Σλ</p></article>
    <article><h3>2. 챔질 구간에 따라 후킹이 달라집니다</h3><p>정확한 구간의 챔질은 100% 걸립니다. 일반 구간은 바늘 크기·날카로움·축·미늘과 미끼 크기로 판정합니다. 표의 일반 성공률은 해당 조건의 씨알 분포를 반영한 평균입니다. 챔질하지 않은 입질은 별도의 자연 입걸림 판정을 한 번 거칩니다.</p></article>
    <article><h3>3. 끝까지 잡는 확률은 조작에 달려 있습니다</h3><p>줄의 강도보다 큰 장력은 줄 터짐, 세운 낚싯대의 허용 하중 초과는 대 파손으로 이어집니다. 바늘 이탈은 심한 지속 과부하 또는 오래 느슨한 줄에서 드물게 발생합니다. 지친 고기를 가까이 끌어와 랜딩해야 실제 조과가 됩니다. 뜰채 한계를 넘는 고기는 랜딩 시 70% 확률로 놓칩니다.</p><p>따라서 최종 랜딩 성공률에는 고정 숫자를 붙이지 않았습니다. 정확한 조과 확률을 측정하려면 동일한 조작·장비·뜰채로 파이팅을 반복해야 합니다.</p></article>
    <article><h3>4. 자유 배합은 재료 비율을 따라갑니다</h3><p>배합 떡밥은 각 재료의 미끼 선호와 제품 보정을 넣은 값을 배합 비율대로 합산합니다. 글루텐 비율은 결합력에, 제품 구성은 집어 효과에 반영됩니다. 이 페이지의 제품 선택은 단일 제품 기준입니다.</p></article>
  </div></section><footer><b>버들못 게임 분석</b><p>현재 로컬 코드의 일반 모드 기준입니다. 배포된 게임과 버전이 다를 수 있습니다.<br>출처: data.ts · extraSpecies.ts · speciesExpansion.ts · ecology.ts · rigMechanics.ts · environment.ts · fishing.ts · feedMixing.ts</p><a href="https://voxel-fishing-choi.web.app/" target="_blank" rel="noopener noreferrer">게임 열기 ↗</a></footer>`;

function weighted(r: EncounterRate, fn: (cm: number) => number) {
  const total = r.sizes.reduce((n, s) => n + s.weight, 0);
  return r.sizes.reduce((n, s) => n + s.weight * fn(s.cm), 0) / total;
}

function render() {
  const point = points[state.point], depth = waterDepth(point.x, point.z);
  const rod = RODS.find(r => r.id === state.rod)!, hook = HOOKS.find(h => h.id === state.hook)!, float = FLOATS.find(f => f.id === state.float)!;
  const line = LINES[state.line], product = baitProduct(state.bait);
  const bait = (product?.baseBait ?? state.bait) as BaitId;
  const baitDepth = Math.max(0.3, Math.min(rod.line, depth - state.lift));
  env.minutes = state.hour * 60;
  const rates = encounterRates({
    waterDepth: depth, baitDepth, bait, product, spotQuality: seed => spotQuality(point.x, point.z, seed),
    line, hook, sensitivity: rigSensitivity(line, hook, float),
    chum: sp => Math.min(2.2, state.chum * Math.min(1.7, (sp.baits.paste + sp.baits.pellet) / 2)), environment: sp => env.biteMul(sp),
  });
  const total = rates.reduce((n, r) => n + r.perMin, 0), any = biteProbability(total, state.seconds);
  const sorted = rates.slice().sort((a, b) => b.perMin - a.perMin);
  root.querySelector('#condition')!.innerHTML = `<b>${product?.name ?? BAITS[bait].name}</b> · ${point.name} 중앙 앞쪽 · 수심 ${depth.toFixed(1)}m / 채비 ${baitDepth.toFixed(1)}m · 수온 ${env.waterTemp.toFixed(1)}℃ · 기압 ${env.pressure.toFixed(0)}hPa${depth - baitDepth > state.lift + 0.1 ? '<span>낚싯대 원줄 길이 때문에 바닥까지 닿지 않습니다.</span>' : ''}`;
  root.querySelector('#stats')!.innerHTML = `<article><small>${state.seconds / 60}분 내 첫 입질</small><strong>${pct(any)}</strong><span>전체 어종 합계</span></article><article><small>입질 대기 평균</small><strong>${total > 0 ? `${(60 / total).toFixed(0)}초` : '—'}</strong><span>입질이 가능한 대기 구간 기준</span></article><article><small>가장 많이 들어오는 어종</small><strong>${total > 0 ? sorted[0].sp.name : '없음'}</strong><span>${total > 0 ? `첫 입질 비중 ${pct(sorted[0].perMin / total)}` : '조건을 바꿔 보세요'}</span></article>`;
  root.querySelector('#first-label')!.textContent = `${state.seconds / 60}분 내 첫 입질`;
  root.querySelector('#hook-label')!.textContent = `${state.seconds / 60}분 내 첫 후킹`;
  root.querySelector('#chance-rows')!.innerHTML = sorted.map(r => {
    const share = total > 0 ? r.perMin / total : 0;
    const set = state.quality === 'perfect' ? 1 : weighted(r, cm => hookSetChance(r.sp, cm, hook, bait, false));
    return `<tr><th scope="row"><button class="fish-label species-button ${state.species === r.sp.id ? 'selected' : ''}" data-species="${r.sp.id}">${fishName(r)}</button></th>
      <td><div class="share"><i style="width:${share * 100}%"></i><b>${pct(share)}</b></div></td><td>${pct(any * share)}</td><td>${share ? pct(set) : '—'}</td><td class="hook-prob">${pct(any * share * set)}</td>
      <td class="habitat">${activeName[SPECIES_RULES[r.sp.id].active]}<small>${r.sp.depth[0]}–${r.sp.depth[2]}m · 적정 ${r.sp.depth[1]}m</small></td></tr>`;
  }).join('') + `<tr class="no-bite"><th scope="row">아직 입질 없음</th><td>—</td><td>${pct(1 - any)}</td><td>—</td><td>—</td><td>선택한 대기 시간 기준</td></tr>`;
  root.querySelectorAll<HTMLButtonElement>('[data-bait]').forEach(b => b.classList.toggle('selected', b.dataset.bait === bait));
  const detail = rates.find(r => r.sp.id === state.species);
  const labels: Record<string, string> = { population: '낚시터 개체군', bait: '미끼 선호', habitat: '포인트 수심', baitDepth: '미끼 위치', spot: '자리 선호', line: '원줄', chum: '집어', hook: '바늘 흡입', sensitivity: '찌 예민함', presentation: '미끼 크기', environment: '시간·기상', product: '제품 배수' };
  root.querySelector('#species-detail')!.innerHTML = detail ? `<aside class="detail"><div class="detail-heading"><h3>${detail.sp.name} · 계산 상세</h3><button data-close-detail aria-label="계산 상세 닫기">×</button></div><p>${esc(detail.sp.classificationText ?? detail.sp.name)} · 분당 입질률 ${detail.perMin.toFixed(5)} · 평균 씨알 ${detail.averageCm.toFixed(1)}cm</p><div class="factor-grid"><div><small>기본 출현율</small><b>×${detail.sp.abundance.toFixed(3)}</b></div>${Object.entries(detail.factors).map(([k, v]) => `<div><small>${labels[k]}</small><b>×${v.toFixed(3)}</b></div>`).join('')}</div><p>자연 입걸림: 입질 한 번당 평균 ${pct(weighted(detail, cm => selfHookChance(detail.sp, cm, hook, bait)))} · 현재 줄 강도 ${line.strength}kgf / 대 파손 기준 ${rodBreakLoad(rod).toFixed(2)}kgf</p></aside>` : '<p class="detail-hint">어종 이름을 누르면 입질률을 만드는 세부 배수를 볼 수 있습니다.</p>';
}
root.addEventListener('change', event => {
  const target = event.target as HTMLSelectElement;
  const key = target.dataset.control;
  if (!key) return;
  if (['point', 'hour', 'seconds', 'line', 'lift', 'chum'].includes(key)) Object.assign(state, { [key]: Number(target.value) });
  else Object.assign(state, { [key]: target.value });
  render();
});
root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!target) return;
  if (target.dataset.bait) { state.bait = target.dataset.bait; (root.querySelector('#bait') as HTMLSelectElement).value = state.bait; render(); }
  if (target.dataset.species) { state.species = state.species === target.dataset.species ? null : target.dataset.species as SpeciesId; render(); }
  if (target.hasAttribute('data-close-detail')) { state.species = null; render(); }
});
connectShopCatalog(root);
render();
if (location.hash === '#shop-catalog') requestAnimationFrame(() => root.querySelector('#shop-catalog')!.scrollIntoView());

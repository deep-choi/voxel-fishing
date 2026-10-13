import { BAITS, BAIT_PACKS, FLOATS, HOOKS, INGREDIENTS, LINES, RODS, type BaitId, type Rarity } from '../game/data';
import { KEEPNETS, NETS, RARITY } from '../game/items';
import { BAIT_PRODUCTS } from '../game/realCatalog';
import { GAME_BRANDS, productBrand } from '../game/fictionalBrands';
import { getHookTraits, hookPenetration, hookRetention } from '../game/hookTraits';
import { lineMaterial } from '../game/lineMaterials';
import { hookGap, hookLoad, hookSharpness, lineDiameter, rodBreakLoad } from '../game/rigMechanics';
import { FEED_MATERIALS } from '../game/feedMixing';
import { itemIcon } from '../ui/pixelIcons';
import './shopCatalog.css';

type Kind = 'bait' | 'ingredient' | 'rod' | 'line' | 'float' | 'hook' | 'net' | 'keepnet';
type Metric = [label: string, value: string];
interface Item { id: string; name: string; price: number; level?: number; desc?: string; purpose?: string; rarity?: Rarity }
interface Entry extends Item { kind: Kind; metrics: Metric[]; icon: string; variant?: string; label?: string; note?: string }
const labels: Record<Kind, string> = { bait: '미끼·떡밥', ingredient: '떡밥 재료', rod: '낚싯대', line: '원줄', float: '찌', hook: '바늘', net: '뜰채', keepnet: '살림망' };
const esc = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);
const amount = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`;
const multiplier = (n: number) => `×${n.toFixed(2)}`;
const baseName = (id: BaitId) => BAITS[id].name;
const entries: Entry[] = [];
const add = (kind: Kind, item: Item, metrics: Metric[], icon: string = kind, note?: string, label?: string, variant?: string) => entries.push({ ...item, kind, metrics, icon, note, label, variant });

for (const pack of BAIT_PACKS) {
  const base = pack.id;
  const mixable = FEED_MATERIALS.some(m => m.key === `generic:${base}`);
  add('bait', { ...pack, desc: BAITS[base].desc },
    [['포장 수량', `${pack.count}회분`], ['회당 가격', amount(pack.price / pack.count)], ['용도', '바늘용'], ['자유 배합', mixable ? '재료로 사용 가능' : '배합 재료 제외']], base, undefined, '기본 미끼');
}
for (const product of BAIT_PRODUCTS) {
  const mixable = FEED_MATERIALS.some(m => m.key === `product:${product.id}`);
  add('bait', product, [['포장 수량', `${product.count}회분`], ['회당 가격', amount(product.price / product.count)],
    ['미끼 계열', baseName(product.baseBait)], ['사용 용도', '바늘용'], ['입질 제품 보정', multiplier(product.biteScale)],
    ['미끼 풀림 효과 보정', multiplier(product.chumScale)], ['자유 배합', mixable ? '재료로 사용 가능' : '배합 재료 제외']], product.baseBait,
    '제품 보정은 어종·미끼·채비·환경에 추가로 적용되는 게임 계수입니다. 떡밥은 모두 바늘에 달아 사용합니다.',
    product.origin === 'house' ? '버들못 자체 상품' : '브랜드 상품');
}
for (const ingredient of INGREDIENTS) {
  const material = FEED_MATERIALS.find(m => m.key === `ingredient:${ingredient.id}`);
  add('ingredient', ingredient, [['포장 수량', `${ingredient.count}개`], ['개당 가격', amount(ingredient.price / ingredient.count)],
    ['사용 위치', '제작 → 떡밥'], ['재료 계열', ingredient.id === 'strawberry' ? '향 첨가' : material?.flavor === 'pellet' || material?.flavor === 'shrimp' ? '어분·새우분' : material?.flavor === 'gluten' ? '글루텐' : '곡물']], ingredient.id,
    '보유 재료를 원하는 양으로 넣어 바늘에 다는 떡밥을 자유 배합합니다.');
}
for (const rod of RODS) add('rod', rod, [['대 길이', `${rod.length.toFixed(2)}m`], ['원줄 길이', `${rod.line.toFixed(2)}m`],
  ['휨 기준 하중', `${rod.power.toFixed(1)}kgf`], ['대 파손 기준', `${rodBreakLoad(rod).toFixed(2)}kgf`], ['휨 여유', `${rod.flex.toFixed(2)}m`]], 'rod', undefined, undefined, rod.id);
for (const line of LINES) {
  const material = lineMaterial(line);
  add('line', line, [['재질', material.name], ['굵기', `${lineDiameter(line).toFixed(3)}mm`], ['줄 강도', `${line.strength.toFixed(1)}kgf`],
    ['늘어남 계수', `${(material.stretchRatio * 100).toFixed(1)}%`], ['수중 노출 계수', `${(line.visibility * material.visibilityScale * 100).toFixed(1)}%`]], 'line', material.description, undefined, line.id);
}
for (const float of FLOATS) add('float', float, [['예민함', multiplier(float.sensitivity)], ['찌톱', `${float.notches ?? 10}마디`],
  ['물결 흔들림', multiplier(float.sway ?? 1)], ['정착 속도 계수', float.sinkSpeed.toFixed(2)],
  ['야간 표시', float.light === 'electro' ? float.shift ? '변색 LED' : 'LED' : float.light === 'chemi' ? '케미' : '발광 없음']], 'float', undefined, undefined, float.id);
for (const hook of HOOKS) {
  const traits = getHookTraits(hook);
  add('hook', hook, [['형태', traits.shapeLabel], ['바늘 폭', `${hookGap(hook).toFixed(1)}mm`], ['축 굵기', `${traits.wireMm.toFixed(2)}mm`],
    ['미늘', traits.barbed ? '있음' : '무미늘'], ['기본 하중', `${hookLoad(hook).toFixed(2)}kgf`], ['날카로움', multiplier(hookSharpness(hook))],
    ['관통 계수', multiplier(hookPenetration(hook))], ['느슨한 줄 유지 계수', multiplier(hookRetention(hook))]], 'hook', '실제 걸림 하중에는 물고기 입과 바늘의 크기, 미끼, 챔질 정확도가 함께 반영됩니다.', undefined, hook.id);
}
for (const net of NETS) add('net', net, [['뜰채 한계', `${net.maxKg}kg`]], 'net', '뜰채 한계를 넘는 물고기는 랜딩할 때 70% 확률로 놓칩니다.');
for (const keepnet of KEEPNETS) add('keepnet', keepnet, [['보관 한도', `${keepnet.capacity}마리`]], 'keepnet', '보관 공간을 늘립니다. 입질 확률이나 물고기 크기는 바꾸지 않습니다.');

const filters: [string, string][] = [['all', '전체'], ['bait', labels.bait], ['ingredient', labels.ingredient], ['rod', labels.rod], ['line', labels.line], ['float', labels.float], ['hook', labels.hook], ['landing', '뜰채·살림망']];
const matchesKind = (entry: Entry, filter: string) => filter === 'all' || (filter === 'landing' ? entry.kind === 'net' || entry.kind === 'keepnet' : entry.kind === filter);

function card(entry: Entry) {
  const brand = productBrand(entry.kind, entry);
  const label = brand.name;
  const search = `${entry.name} ${labels[entry.kind]} ${entry.desc ?? ''} ${entry.purpose ?? ''} ${label} ${entry.metrics.map(m => m.join(' ')).join(' ')}`.toLocaleLowerCase('ko-KR');
  return `<article class="catalog-card" data-catalog-kind="${entry.kind}" data-catalog-brand="${brand.id}" data-catalog-search="${esc(search)}"><div class="catalog-card-head"><span class="catalog-art" aria-hidden="true">${itemIcon(entry.icon, entry.variant)}</span><div><small>${labels[entry.kind]} · ${esc(label)}</small><h3>${esc(entry.name)}</h3></div></div>
    <div class="catalog-price"><strong>${entry.price === 0 ? '기본 지급 · 0원' : amount(entry.price)}</strong><span>Lv.${entry.level ?? 1}${entry.rarity ? ` · ${RARITY[entry.rarity].name}` : ''}</span></div>
    <p class="catalog-signature">${esc(brand.signature)}</p>${entry.purpose ? `<p class="catalog-purpose">${esc(entry.purpose)}</p>` : ''}<p class="catalog-description">${esc(entry.desc ?? '')}</p>
    <dl class="catalog-metrics">${entry.metrics.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    ${entry.note ? `<p class="catalog-note">${esc(entry.note)}</p>` : ''}</article>`;
}

const brandCounts = () => GAME_BRANDS.map(brand => ({ ...brand, count: entries.filter(entry => productBrand(entry.kind, entry).id === brand.id).length }))
  .filter(brand => brand.count > 0);

export function shopCatalogSection() {
  return `<section id="shop-catalog" class="section catalog"><div class="section-heading"><div><p class="eyebrow">03 / 상점 전체 목록</p><h2>미끼부터 낚시 장비까지</h2></div><p>상점에 있는 <b>${entries.length}개 상품</b>을 모두 모았습니다.<br>가격·해금 레벨·성능 수치는 게임 기준입니다.</p></div>
    <div class="catalog-toolbar"><label class="catalog-search"><span>상품 검색</span><input id="catalog-search" type="search" placeholder="상품명, 브랜드, 어종, 용도로 검색" autocomplete="off" /></label><p id="catalog-count" aria-live="polite">전체 ${entries.length}개</p></div>
    <div class="catalog-brands" role="group" aria-label="브랜드별 상품 보기"><button type="button" data-catalog-brand="all" aria-pressed="true">전체 브랜드 <span>${entries.length}</span></button>${brandCounts().map(brand => `<button type="button" data-catalog-brand="${brand.id}" aria-pressed="false">${brand.name}<span>${brand.count}</span></button>`).join('')}</div>
    <aside id="catalog-brand-story" class="catalog-brand-story" hidden></aside>
    <div class="catalog-filters" role="group" aria-label="상점 상품 분류">${filters.map(([id, label]) => `<button type="button" data-catalog-filter="${id}" aria-pressed="${id === 'all'}">${label}<span>${entries.filter(e => matchesKind(e, id)).length}</span></button>`).join('')}</div>
    <div class="catalog-grid">${entries.map(card).join('')}</div><p class="catalog-empty" hidden>검색 결과가 없습니다. 상품명이나 분류를 바꿔 보세요.</p>
    <p class="caption">게임 속 가상 제조사 상품을 가격·해금 단계·성능으로 비교합니다. 원줄의 노출·늘어남과 바늘의 관통·유지 수치는 게임 계산 계수입니다. 자유 배합 떡밥은 <b>제작 → 떡밥</b>에서 만들며, 직접 만든 배합은 이 판매 목록에 포함되지 않습니다. 수리·새 줄 감기는 보유 장비의 마모에 따라 비용이 달라지는 상점 서비스입니다.</p></section>`;
}

export function connectShopCatalog(root: HTMLElement) {
  let filter = 'all';
  let brandFilter = 'all';
  const input = root.querySelector<HTMLInputElement>('#catalog-search')!;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('.catalog-card'));
  const update = () => {
    const words = input.value.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach((element, index) => {
      const visible = matchesKind(entries[index], filter)
        && (brandFilter === 'all' || element.dataset.catalogBrand === brandFilter)
        && words.every(word => element.dataset.catalogSearch!.includes(word));
      element.hidden = !visible;
      if (visible) count++;
    });
    root.querySelector('#catalog-count')!.textContent = `${filters.find(([id]) => id === filter)![1]} ${count}개 / 전체 ${entries.length}개`;
    root.querySelector<HTMLElement>('.catalog-empty')!.hidden = count > 0;
    root.querySelectorAll<HTMLButtonElement>('[data-catalog-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.catalogFilter === filter)));
    root.querySelectorAll<HTMLButtonElement>('[data-catalog-brand]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.catalogBrand === brandFilter)));
    const story = root.querySelector<HTMLElement>('#catalog-brand-story')!;
    const brand = brandFilter === 'all' ? undefined : GAME_BRANDS.find(item => item.id === brandFilter);
    story.hidden = !brand;
    story.innerHTML = brand ? `<b>${esc(brand.name)} · ${esc(brand.specialty)}</b><p>${esc(brand.signature)}</p><small>${esc(brand.story)}</small>` : '';
  };
  input.addEventListener('input', update);
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-catalog-filter]');
    const brand = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-catalog-brand]');
    if (button) { filter = button.dataset.catalogFilter!; update(); }
    if (brand) { brandFilter = brand.dataset.catalogBrand!; update(); }
  });
}

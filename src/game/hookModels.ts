import type { HookSpec } from './data';
import { getHookTraits } from './hookTraits';
import { hookGap } from './rigMechanics';
import { gameBrand } from './fictionalBrands';

interface HookModel {
  id: string;
  brandId: string;
  name: string;
  legacyIds: string[];
  sizes: number[];
  price?: number;
  purpose?: string;
  desc?: string;
  finish?: string;
}

// 제품은 설계와 가공으로 구분한다. 호수는 같은 제품의 규격이며 품질·가격·해금 단계를 바꾸지 않는다.
const MODELS: HookModel[] = [
  { id: 'sodam-first', brandId: 'sodam', name: '첫걸음 무미늘', legacyIds: ['small'], sizes: [5], purpose: '입문 · 작은 떡밥·지렁이' },
  { id: 'nalgeut-crucian', brandId: 'nalgeut', name: '붕어 무미늘', legacyIds: ['sharp', 'owner7'], sizes: [4, 5, 7], price: 90, purpose: '붕어 · 글루텐 · 무미늘', desc: '가는 축과 무미늘로 약한 챔질에도 잘 박히는 붕어용입니다. 작은 호수는 글루텐, 큰 호수는 지렁이와 큰 떡밥에 맞습니다. 줄이 느슨해지면 빠지기 쉽습니다' },
  { id: 'jeongho-round', brandId: 'jeongho', name: '균형 둥근축', legacyIds: ['ise5', 'medium', 'ise9', 'large', 'monster'], sizes: [5, 7, 9, 10, 13], price: 160, purpose: '붕어·잉어 · 떡밥·옥수수', desc: '둥근 굽과 미늘을 갖춘 범용 설계입니다. 작은 호수는 붕어와 떡밥, 큰 호수는 잉어와 큰 미끼에 맞습니다. 넓고 굵은 규격은 작은 입에 불리합니다' },
  { id: 'sodam-economy', brandId: 'sodam', name: '알뜰 미늘', legacyIds: ['willow-entry'], sizes: [4, 5, 6], purpose: '실속 · 지렁이·떡밥' },
  { id: 'nalgeut-fine', brandId: 'nalgeut', name: '세류 세축', legacyIds: ['willow-fine'], sizes: [2, 3, 4], purpose: '작은 붕어 · 가벼운 떡밥' },
  { id: 'jeongho-balance', brandId: 'jeongho', name: '균형 광폭 정밀', legacyIds: ['willow-balance'], sizes: [5, 7, 9], purpose: '중형어 · 떡밥·옥수수', finish: '바늘 끝을 추가 연마해 기본형보다 날카롭게 만든 광폭 설계입니다.' },
  { id: 'gangteok-forged', brandId: 'gangteok', name: '대물 단조', legacyIds: ['willow-forged'], sizes: [8, 10, 12], purpose: '대물 잉어·메기 · 큰 미끼', finish: '강한 축과 정밀 연마를 함께 적용해 높은 하중과 박힘을 확보합니다.' },
  { id: 'baekun-fine', brandId: 'baekun', name: '백로 세축 수제', legacyIds: ['willow-master'], sizes: [3, 4, 5], purpose: '정밀 붕어 · 작은 글루텐', finish: '가느다란 축의 강도를 보강하고 끝을 수제 연마한 고급 붕어용입니다.' },
];

const FINISHES = [
  ['기본', '규격 생산과 기본 연마로 가격 부담을 낮춘 모델입니다.'],
  ['단조', '축의 강도를 보강하고 끝을 추가 연마해 기본 모델보다 하중과 날카로움을 높였습니다.'],
  ['정밀', '추가 열처리와 정밀 연마로 같은 폭에서도 더 큰 하중을 버티고 잘 박히도록 만들었습니다.'],
  ['수제', '강도를 보강한 소재와 수제 끝 연마를 적용한 최상위 모델입니다. 작은 바늘의 대물 적합성에는 한계가 있습니다.'],
] as const;
const FAMILIES = [
  { id: 'silkhook', prefix: 'willow', brandId: 'nalgeut', name: '실결 세축', sizes: [2, 3, 4] },
  { id: 'grainhook', prefix: 'willow', brandId: 'jeongho', name: '곡향 붕어', sizes: [4, 5, 6] },
  { id: 'cornhook', prefix: 'willow', brandId: 'gangteok', name: '황금알 둥근축', sizes: [6, 8, 10] },
  { id: 'ironhook', prefix: 'willow', brandId: 'gangteok', name: '철각 강축', sizes: [8, 10, 12] },
  { id: 'crucian', prefix: 'specialist', brandId: 'nalgeut', name: '솜결 무미늘', sizes: [3, 4, 5] },
  { id: 'carp', prefix: 'specialist', brandId: 'gangteok', name: '잉어 둥근강축', sizes: [8, 10, 12] },
  { id: 'catfish', prefix: 'specialist', brandId: 'gangteok', name: '메기 긴축', sizes: [9, 11, 13] },
  { id: 'allround', prefix: 'specialist', brandId: 'jeongho', name: '범용 광폭', sizes: [4, 6, 8] },
];
for (const family of FAMILIES) for (let i = 0; i < FINISHES.length; i++) {
  const [finish, description] = FINISHES[i];
  MODELS.push({
    id: `${family.prefix}-${family.id}-${i + 1}`,
    brandId: i === 3 && (family.prefix === 'specialist' || family.id === 'ironhook') ? 'baekun' : family.brandId,
    name: `${family.name} ${finish}`, legacyIds: [`${family.prefix}-${family.id}-${i + 1}`], sizes: family.sizes,
    finish: description,
  });
}

const round = (n: number, digits: number) => Number(n.toFixed(digits));
const sizeOf = (hook: HookSpec) => hook.size ?? Number(hook.name.match(/(\d+)호/)?.[1]);

/** 기존 ID와 성능을 보존하고, 제품별 메타데이터와 추가 호수만 붙인다. */
export function configureHookModels(hooks: HookSpec[]) {
  for (const model of MODELS) {
    const existing = model.legacyIds.map(id => hooks.find(hook => hook.id === id)!);
    const anchor = existing[0];
    const traits = getHookTraits(anchor);
    const modelName = `${gameBrand(model.brandId).name} ${model.name} 바늘`;
    const description = (model.desc ?? anchor.desc).replace(/\.? 게임 규격:.*$/, '').replace(/정밀·명장 단계/g, '정밀·수제 모델').replace(/\.+$/, '');
    const common = {
      modelId: model.id, modelName, brandId: model.brandId,
      price: model.price ?? anchor.price, level: anchor.level, rarity: anchor.rarity,
      sharpness: anchor.sharpness ?? 1, shape: traits.shape, barbed: traits.barbed,
      purpose: model.purpose ?? anchor.purpose,
      desc: `${description}${model.finish ? `. ${model.finish}` : ''}`,
    };
    for (const hook of existing) {
      // 구 모델의 호수별 굵기·폭·하중은 그대로 사용한다.
      const size = sizeOf(hook), wireMm = getHookTraits(hook).wireMm, gapMm = hookGap(hook);
      Object.assign(hook, common, { size, wireMm, gapMm });
    }
    for (const size of model.sizes) {
      if (existing.some(hook => hook.size === size)) continue;
      const samples = existing.slice().sort((a, b) => a.size! - b.size!);
      const lower = samples.filter(hook => hook.size! < size).at(-1);
      const upper = samples.find(hook => hook.size! > size);
      const ratio = size / anchor.size!;
      const blend = (a: number, b: number) => a + (b - a) * (size - lower!.size!) / (upper!.size! - lower!.size!);
      const wireMm = lower && upper ? blend(lower.wireMm!, upper.wireMm!) : traits.wireMm * Math.sqrt(ratio);
      const gapMm = lower && upper ? blend(lower.gapMm!, upper.gapMm!) : anchor.gapMm! * ratio;
      const hold = lower && upper ? blend(lower.hold, upper.hold) : anchor.hold * (wireMm / traits.wireMm) ** 2;
      const attraction = lower && upper ? blend(lower.attraction, upper.attraction) : Math.max(0.6, Math.min(1.4, anchor.attraction + (anchor.size! - size) * 0.025));
      hooks.push({ ...anchor, ...common, id: `${anchor.id}-size-${size}`, name: `${modelName} ${size}호`, size,
        wireMm: round(wireMm, 2), gapMm: round(gapMm, 1), hold: round(hold, 3), attraction: round(attraction, 3) });
    }
  }
}

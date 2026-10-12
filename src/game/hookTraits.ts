import type { HookSpec } from './data';

export type HookShape = NonNullable<HookSpec['shape']>;
const LABELS: Record<HookShape, string> = { fine: '가는축형', round: '둥근강축형', long: '긴축형', wide: '광폭형' };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** 구버전 바늘의 값도 게임용 분류다. 실존 제품의 측정치나 제조사 규격이 아니다. */
export function getHookTraits(hook: HookSpec): { shapeLabel: string; wireMm: number; barbed: boolean; shape: HookShape } {
  const fine = ['small', 'sharp', 'owner7'].includes(hook.id) || /silkhook|grainhook/.test(hook.id);
  const round = ['medium', 'large', 'monster', 'ise5', 'ise9'].includes(hook.id) || /cornhook|ironhook/.test(hook.id);
  const shape: HookShape = hook.shape ?? (fine ? 'fine' : round ? 'round' : 'wide');
  const defaultWire = shape === 'fine' ? 0.28 : shape === 'long' ? 0.75
    : shape === 'round' ? (hook.id === 'monster' || hook.id.includes('ironhook') ? 0.9 : 0.62) : 0.5;
  return { shapeLabel: LABELS[shape], shape, wireMm: hook.wireMm ?? defaultWire, barbed: hook.barbed ?? shape !== 'fine' };
}

/** 굵은 축은 관통하기 어렵고 무미늘은 박힘이 쉽다. 챔질 확률에 곱한다. */
export function hookPenetration(hook: HookSpec) {
  const { wireMm, barbed } = getHookTraits(hook);
  return clamp((1 - Math.max(0, wireMm - 0.3) * 0.34) * (barbed ? 1 : 1.08), 0.72, 1.1);
}

/** 줄이 느슨할 때의 유지 배수. 탈출 위험은 이 값으로 나눈다. */
export const hookRetention = (hook: HookSpec) => getHookTraits(hook).barbed ? 1.12 : 0.78;

/** 입에 넣을 때의 형태 부담. 게임 폭에 곱한 값으로 입 크기와 비교한다. */
export const hookMouthFactor = (hook: HookSpec) => ({ fine: 0.95, round: 1, long: 1.04, wide: 1.1 })[getHookTraits(hook).shape];

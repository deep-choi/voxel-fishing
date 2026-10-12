import type { BaitId, FloatSpec, HookSpec, LineSpec, Species, SpeciesId } from './data';

// 제품의 실측 규격이 아니라 조과를 구분하기 위한 게임 환산값이다.
const DIAMETERS: Record<string, number> = { '1.5': 0.205, '2': 0.235, '3': 0.285, '4': 0.33, c2: 0.235, c3: 0.285, n1: 0.165, n25: 0.26, herabito: 0.235, fc15: 0.205, fc4: 0.33 };
const GAPS: Record<string, number> = { small: 4.2, sharp: 3.6, medium: 6.5, large: 9.2, monster: 12.5, ise5: 4.8, ise9: 8.2, owner7: 5.4 };
const MOUTHS: Record<SpeciesId, number> = { crucian: 0.45, carp: 0.5, mirror: 0.55, bluegill: 0.4, catfish: 0.75, yellowcat: 0.65, snakehead: 0.85, mandarin: 0.8, bass: 0.85 };
const BAIT_GAPS: Record<BaitId, number> = { worm: 4.5, paste: 5, corn: 6.8, gluten: 4.2, pellet: 7, shrimp: 8.5 };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const lineDiameter = (line: LineSpec) => DIAMETERS[line.id] ?? 0.235;
export const hookGap = (hook: HookSpec) => GAPS[hook.id] ?? 6.5;
export const hookSizeLabel = (hook: HookSpec) => `${hook.name.match(/(\d+)호/)?.[1] ?? '?'}호 · 게임 폭 ${hookGap(hook).toFixed(1)}mm`;

/** 굵은 줄·무거운 바늘은 같은 찌의 움직임 전달과 흡입 반응을 둔하게 만든다. */
export function rigSensitivity(line: LineSpec, hook: HookSpec, float: FloatSpec) {
  const stiffness = line.id.startsWith('c') || line.id.startsWith('fc') ? 1.2 : 1;
  const drag = Math.max(0, lineDiameter(line) - 0.18) * 2.7 * stiffness;
  const hookLoad = Math.max(0, hookGap(hook) - 4.2) * 0.035;
  return clamp(float.sensitivity / (1 + drag + hookLoad), 0.4, 1.7);
}
export function lineAcceptance(sp: Species, cm: number, line: LineSpec) {
  const caution = sp.shy * clamp(cm / sp.len.median, 0.7, 1.7);
  return clamp(Math.exp(-caution * (line.visibility * 1.2 + Math.max(0, lineDiameter(line) - 0.16) * 8.2)), 0.08, 1);
}
export function sensitivityAcceptance(sp: Species, cm: number, sensitivity: number) {
  const caution = sp.shy * clamp(cm / sp.len.median, 0.7, 1.7);
  return Math.exp(-caution * 0.8 * Math.max(0, 1 / sensitivity - 0.8));
}
/** 입에 비해 큰 바늘은 삼키기 어렵다. 작은 바늘은 먹더라도 큰 입에 얕게 걸린다. */
export function hookAcceptance(sp: Species, cm: number, hook: HookSpec) {
  const ratio = hookGap(hook) / Math.max(2, cm * MOUTHS[sp.id]);
  return clamp(Math.exp(-Math.max(0, ratio - 0.65) * 3.8), 0.015, 1);
}
export function hookFit(sp: Species, cm: number, hook: HookSpec) {
  const ratio = hookGap(hook) / Math.max(2, cm * MOUTHS[sp.id]);
  return clamp((0.3 + 0.7 * clamp((ratio - 0.08) / 0.22, 0, 1)) * Math.sqrt(hookAcceptance(sp, cm, hook)), 0.12, 1);
}
export function baitPresentation(hook: HookSpec, bait: BaitId) {
  return 0.3 + 0.7 * Math.min(1, hookGap(hook) / BAIT_GAPS[bait]) ** 1.7;
}
export function hookSetChance(sp: Species, cm: number, hook: HookSpec, bait: BaitId, perfect: boolean) {
  const sharpness = clamp(hook.attraction, 0.8, 1.2);
  return clamp((0.5 + 0.42 * hookFit(sp, cm, hook)) * baitPresentation(hook, bait) * sharpness * (perfect ? 1.08 : 0.94), 0.12, 0.97);
}
export function hookHoldingPower(sp: Species, cm: number, hook: HookSpec, bait: BaitId, quality: 'perfect' | 'good' | 'poor') {
  const timing = quality === 'perfect' ? 1.65 : quality === 'good' ? 1.1 : 0.6;
  return (2.2 + hookGap(hook) * 0.3) * hook.hold * hookFit(sp, cm, hook) * (0.7 + 0.3 * baitPresentation(hook, bait)) * timing;
}

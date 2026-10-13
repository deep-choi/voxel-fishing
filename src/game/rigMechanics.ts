import type { BaitId, FloatSpec, HookSpec, LineSpec, RodSpec, Species, SpeciesId } from './data';
import { lineMaterial } from './lineMaterials';
import { hookMouthFactor, hookPenetration, hookRetention } from './hookTraits';

// 제품의 실측 규격이 아니라 조과를 구분하기 위한 게임 환산값이다.
const DIAMETERS: Record<string, number> = { '1.5': 0.205, '2': 0.235, '3': 0.285, '4': 0.33, c2: 0.235, c3: 0.285, n1: 0.165, n25: 0.26, herabito: 0.235, fc15: 0.205, fc4: 0.33 };
const GAPS: Record<string, number> = { small: 4.2, sharp: 3.6, medium: 6.5, large: 9.2, monster: 12.5, ise5: 4.8, ise9: 8.2, owner7: 5.4 };
const MOUTHS: Record<SpeciesId, number> = { crucian: 0.45, carp: 0.5, mirror: 0.55, bluegill: 0.4, catfish: 0.75, yellowcat: 0.65, snakehead: 0.85, mandarin: 0.8, bass: 0.85,
  hera: 0.43, nuchi: 0.42, koi: 0.5, leather: 0.55, bredmirror: 0.55, grasscarp: 0.5 };
const BAIT_GAPS: Record<BaitId, number> = { worm: 4.5, paste: 5, corn: 6.8, gluten: 4.2, pellet: 7, shrimp: 8.5 };
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const lineDiameter = (line: LineSpec) => line.diameterMm ?? DIAMETERS[line.id] ?? 0.235;
export const hookGap = (hook: HookSpec) => hook.gapMm ?? GAPS[hook.id] ?? 6.5;
export const hookSizeLabel = (hook: HookSpec) => `${hook.size ?? hook.name.match(/(\d+)호/)?.[1] ?? '?'}호 · 게임 폭 ${hookGap(hook).toFixed(1)}mm`;
/** 원줄 호수: 이름에 있으면 그대로, 없으면 굵기로 가장 가까운 표준 호수 */
const LINE_GO: [number, string][] = [[0.165, '1'], [0.205, '1.5'], [0.235, '2'], [0.26, '2.5'], [0.285, '3'], [0.33, '4']];
export const lineGo = (line: LineSpec) => line.name.match(/([\d.]+)호/)?.[1]
  ?? LINE_GO.reduce((a, b) => Math.abs(b[0] - lineDiameter(line)) < Math.abs(a[0] - lineDiameter(line)) ? b : a)[1];
/** 낚싯대 기준 하중과 파손 하중을 같은 계산으로 표시하고 판정한다. */
export const rodBreakLoad = (rod: RodSpec) => rod.power * 1.25;
/** 바늘이 버티는 기본 하중 (kgf). 실제로는 입에 맞는 정도·미끼·챔질 정확도에 따라 달라진다 */
export const hookLoad = (hook: HookSpec) => (2.2 + hookGap(hook) * 0.3) * hook.hold;
/** 날카로움: 바늘 박힘 확률 배수 */
export const hookSharpness = (hook: HookSpec) => hook.sharpness ?? 1;

/** 굵은 줄·무거운 바늘은 같은 찌의 움직임 전달과 흡입 반응을 둔하게 만든다. */
export function rigSensitivity(line: LineSpec, hook: HookSpec, float: FloatSpec) {
  const stiffness = lineMaterial(line).stiffness;
  const drag = Math.max(0, lineDiameter(line) - 0.18) * 2.7 * stiffness;
  const hookLoad = Math.max(0, hookGap(hook) - 4.2) * 0.035;
  return clamp(float.sensitivity / (1 + drag + hookLoad), 0.4, 1.7);
}
export function lineAcceptance(sp: Species, cm: number, line: LineSpec) {
  const caution = sp.shy * clamp(cm / sp.len.median, 0.7, 1.7);
  return clamp(Math.exp(-caution * (line.visibility * lineMaterial(line).visibilityScale * 1.2 + Math.max(0, lineDiameter(line) - 0.16) * 8.2)), 0.08, 1);
}
export function sensitivityAcceptance(sp: Species, cm: number, sensitivity: number) {
  const caution = sp.shy * clamp(cm / sp.len.median, 0.7, 1.7);
  return Math.exp(-caution * 0.8 * Math.max(0, 1 / sensitivity - 0.8));
}
/** 입에 비해 큰 바늘은 삼키기 어렵다. 작은 바늘은 먹더라도 큰 입에 얕게 걸린다. */
export function hookAcceptance(sp: Species, cm: number, hook: HookSpec) {
  const ratio = hookGap(hook) * hookMouthFactor(hook) / Math.max(2, cm * MOUTHS[sp.id]);
  return clamp(Math.exp(-Math.max(0, ratio - 0.65) * 3.8), 0.015, 1);
}
export function hookFit(sp: Species, cm: number, hook: HookSpec) {
  const ratio = hookGap(hook) * hookMouthFactor(hook) / Math.max(2, cm * MOUTHS[sp.id]);
  return clamp((0.3 + 0.7 * clamp((ratio - 0.08) / 0.22, 0, 1)) * Math.sqrt(hookAcceptance(sp, cm, hook)), 0.12, 1);
}
export function baitPresentation(hook: HookSpec, bait: BaitId) {
  return 0.3 + 0.7 * Math.min(1, hookGap(hook) / BAIT_GAPS[bait]) ** 1.7;
}
export function hookSetChance(sp: Species, cm: number, hook: HookSpec, bait: BaitId, perfect: boolean) {
  return clamp((0.5 + 0.42 * hookFit(sp, cm, hook)) * baitPresentation(hook, bait) * hookSharpness(hook) * hookPenetration(hook) * (perfect ? 1.08 : 0.94), 0.12, 0.97);
}
/** 본신 한 번당 자연 입걸림 확률. 직접 챔질보다 낮고, 끌고 가는 입질에 유리하다. */
export function selfHookChance(sp: Species, cm: number, hook: HookSpec, bait: BaitId) {
  const take = { rise: 0.14, sink: 0.34, drag: 0.42, dart: 0.3, jitter: 0.12 }[sp.bite];
  return clamp(take * hookSetChance(sp, cm, hook, bait, false), 0.02, 0.4);
}
export type HooksetQuality = 'perfect' | 'good' | 'self' | 'poor';
export function hookHoldingPower(sp: Species, cm: number, hook: HookSpec, bait: BaitId, quality: HooksetQuality) {
  const timing = quality === 'perfect' ? 1.65 : quality === 'good' ? 1.1 : quality === 'self' ? 0.9 : 0.6;
  return hookLoad(hook) * hookFit(sp, cm, hook) * (0.7 + 0.3 * baitPresentation(hook, bait)) * timing * hookRetention(hook);
}

import { HOOKS, LINES, type HookSpec, type LineSpec } from '../game/data';
import { hookGap, hookLoad, hookSharpness, lineDiameter } from '../game/rigMechanics';
import { getHookTraits, hookPenetration, hookRetention } from '../game/hookTraits';
import { lineMaterial } from '../game/lineMaterials';

export interface TackleValue { reference?: string; changes: string[]; tradeoff: string }
const series = (id: string) => /-\d+$/.test(id) ? id.replace(/-\d+$/, '') : undefined;
const change = (label: string, before: number, after: number, unit: string, digits = 1) =>
  Math.abs(before - after) < 0.0001 ? [] : [`${label} ${before.toFixed(digits)} → ${after.toFixed(digits)}${unit}`];

// 가격·등급 자체에 성능을 부여하지 않는다. 실제 판정에 쓰는 값으로만 비교한다.
export function lineValue(line: LineSpec): TackleValue {
  const family = series(line.id);
  const cheaper = LINES.filter(x => x.id !== line.id && x.price < line.price && x.material === line.material);
  const previous = cheaper.filter(x => family && series(x.id) === family).sort((a, b) => b.price - a.price)[0]
    ?? cheaper.filter(x => Math.abs(lineDiameter(x) - lineDiameter(line)) < 0.001).sort((a, b) => b.price - a.price)[0];
  const visibility = (x: LineSpec) => x.visibility * lineMaterial(x).visibilityScale * 100;
  return {
    reference: previous?.name,
    changes: previous ? [
      ...change('강도', previous.strength, line.strength, 'kgf'),
      ...change('굵기', lineDiameter(previous), lineDiameter(line), 'mm', 3),
      ...change('눈에 띔', visibility(previous), visibility(line), '%'),
    ] : [],
    tradeoff: line.material === 'braid' ? '적은 늘어남으로 힘을 직접 전달하지만 돌진 충격을 적게 흡수해요.'
      : line.material === 'fluorocarbon' ? '수중 노출이 낮지만 같은 굵기의 모노보다 채비가 뻣뻣해요.'
      : '늘어나는 줄이 돌진 충격을 흡수해요. 굵어질수록 작은 입질에는 둔해져요.',
  };
}

export function hookValue(hook: HookSpec): TackleValue {
  const traits = getHookTraits(hook), family = series(hook.id);
  const cheaper = HOOKS.filter(x => x.id !== hook.id && x.price < hook.price);
  const previous = cheaper.filter(x => family && series(x.id) === family).sort((a, b) => b.price - a.price)[0]
    ?? cheaper.filter(x => Math.abs(hookGap(x) - hookGap(hook)) < 0.01 && getHookTraits(x).shape === traits.shape
      && getHookTraits(x).barbed === traits.barbed).sort((a, b) => b.price - a.price)[0];
  return {
    reference: previous?.name,
    changes: previous ? [
      ...change('하중', hookLoad(previous), hookLoad(hook), 'kgf'),
      ...change('날카로움', hookSharpness(previous), hookSharpness(hook), '배', 2),
      ...change('관통 계수', hookPenetration(previous), hookPenetration(hook), '배', 2),
      ...change('유지 계수', hookRetention(previous), hookRetention(hook), '배', 2),
    ] : [],
    tradeoff: traits.barbed ? '미늘이 걸림 유지를 도와요. 넓고 굵은 바늘은 작은 입에 불리해요.'
      : '무미늘은 잘 박히지만 줄이 느슨해지면 빠지기 쉬워요.',
  };
}

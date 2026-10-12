import type { Species } from './data';

/**
 * 낚시 규칙에 끼어드는 보정값. 시간·날씨·기술·장비 마모를 main.ts가 매 프레임 채우고
 * fishing.ts가 읽는다. 서버를 붙이면 이 값을 서버가 계산해 내려 준다.
 */
export const mods = {
  /** 어종별 입질 배수 (시간대·날씨) */
  bite: (_sp: Species) => 1,
  /** 원줄 강도 배수 (마모·기술) */
  lineStrength: (_lineId: string) => 1,
  /** 낚싯대 힘 배수 (마모) */
  rodPower: (_rodId: string) => 1,
  /** 챔질 판정 여유 (초). 밤에 안 보이는 찌는 음수 */
  hookWindow: 0,
  chum: 1,
  /** 앞치기 최대 힘 */
  castCap: 1,
  /** 수면 물결 배수 (날씨: 비·바람이면 찌가 더 흔들려 읽기 어렵다) */
  wave: 1,
  /** 장착한 뜰채가 안전하게 떠내는 무게 */
  netMaxKg: Infinity,
};

import type { LineMaterial, LineSpec } from './data';

// 재질의 차이를 표현하는 게임 계수. 제조사 실측 신율이나 제품 보증 수치가 아니다.
const MATERIALS = {
  nylon: { name: '모노(나일론)', stretchRatio: 0.24, stiffness: 1, visibilityScale: 1, description: '늘어남 큼 · 돌진 충격 완충' },
  fluorocarbon: { name: '카본', stretchRatio: 0.14, stiffness: 1.2, visibilityScale: 0.75, description: '늘어남 중간 · 낮은 수중 노출' },
  braid: { name: '합사(PE)', stretchRatio: 0.045, stiffness: 0.85, visibilityScale: 1.3, description: '늘어남 적음 · 직접적인 힘 전달 · 충격 주의' },
} satisfies Record<LineMaterial, object>;
export const lineMaterial = (line: LineSpec) => MATERIALS[line.material ?? 'nylon'];

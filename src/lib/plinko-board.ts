/** Static Plinko board layout — visual only until drop mechanics ship. */

export const PLINKO_ROW_COUNT = 12;
export const PLINKO_SLOT_COUNT = 13;

/** Medium-risk multipliers (left → right). */
export const PLINKO_MULTIPLIERS: number[] = [
  5, 3, 2, 1, 0.5, 0.2, 0.1, 0.2, 0.5, 1, 2, 3, 5,
];

export const PLINKO_STAKE_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export type PlinkoRisk = "low" | "medium" | "high";

export function clampPlinkoStake(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(10, Math.min(5000, Math.floor(value)));
}

export function slotColor(multiplier: number): string {
  if (multiplier >= 5) return "#f43f5e";
  if (multiplier >= 2) return "#f97316";
  if (multiplier >= 1) return "#eab308";
  if (multiplier >= 0.5) return "#84cc16";
  if (multiplier >= 0.2) return "#22d3ee";
  return "#a855f7";
}

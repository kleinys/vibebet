/** Plinko constants — multipliers match `play_plinko` RPC weights. */

export const PLINKO_ROW_COUNT = 12;
export const PLINKO_SLOT_COUNT = 13;

export const PLINKO_STAKE_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export type PlinkoRisk = "low" | "medium" | "high";

/** Same values as `play_plinko` in Supabase. */
export const PLINKO_MULTIPLIERS_BY_RISK: Record<PlinkoRisk, number[]> = {
  low: [3, 2, 1.5, 1.2, 1, 0.3, 0.5, 0.3, 1, 1.2, 1.5, 2, 3],
  medium: [5, 3, 2, 1, 0.5, 0.2, 0.1, 0.2, 0.5, 1, 2, 3, 5],
  high: [10, 5, 3, 2, 0.5, 0.2, 0.1, 0.2, 0.5, 2, 3, 5, 10],
};

export function multipliersForRisk(risk: PlinkoRisk): number[] {
  return PLINKO_MULTIPLIERS_BY_RISK[risk];
}

export function clampPlinkoStake(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(10, Math.min(5000, Math.floor(value)));
}

/** Client-side hypnotic UX state — momentum, cinema phases, recommended stakes. */

export type HypnoticMode = "case" | "wheel";
export type HypnoticReaction = "idle" | "watch-wheel" | "approve" | "super" | "leash" | "afterglow";
export type HypnoticCinema = "idle" | "wheel-spin" | "vibe-absorb" | "case-open" | "confetti";

export const CRATE_STAKES = [100, 250, 500, 1000] as const;
export const PAID_SPIN_COST = 100;
export const SUPER_MODE_MS = 30_000;

export function nearestCrateStake(amount: number): (typeof CRATE_STAKES)[number] {
  let best: (typeof CRATE_STAKES)[number] = CRATE_STAKES[0];
  let bestDiff = Math.abs(amount - best);
  for (const stake of CRATE_STAKES) {
    const diff = Math.abs(amount - stake);
    if (diff < bestDiff) {
      best = stake;
      bestDiff = diff;
    }
  }
  return best;
}

export function momentumDelta(event: "wheel-win" | "case-win" | "case-lose"): number {
  switch (event) {
    case "wheel-win":
      return 20;
    case "case-win":
      return 30;
    case "case-lose":
      return -10;
  }
}

export function clampMomentum(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export interface HypnoticSession {
  momentum: number;
  superUntil: number | null;
  recommendedStake: number | null;
  lastWinAmount: number | null;
  lastAnimal: string | null;
}

export function createSession(): HypnoticSession {
  return {
    momentum: 0,
    superUntil: null,
    recommendedStake: null,
    lastWinAmount: null,
    lastAnimal: null,
  };
}

export function isSuperActive(superUntil: number | null, now = Date.now()): boolean {
  return superUntil !== null && superUntil > now;
}

export function parseMomentumFromRpc(row: Record<string, unknown>): {
  momentum: number;
  momentumDelta: number;
  superActive: boolean;
  superSecondsLeft: number;
  superUntil: number | null;
  payoutMultiplier: number;
  affinityLabel: string | null;
  isJackpot: boolean;
} {
  const superActive = Boolean(row.super_active);
  const superSecondsLeft = Number(row.super_seconds_left ?? 0);

  return {
    momentum: Number(row.momentum ?? 0),
    momentumDelta: Number(row.momentum_delta ?? 0),
    superActive,
    superSecondsLeft,
    superUntil: superActive ? Date.now() + superSecondsLeft * 1000 : null,
    payoutMultiplier: Number(row.payout_multiplier ?? 1),
    affinityLabel: (row.affinity_label as string) ?? null,
    isJackpot: Boolean(row.is_jackpot),
  };
}

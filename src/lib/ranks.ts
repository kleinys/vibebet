export interface RankTier {
  id: string;
  title: string;
  emoji: string;
  minProfit: number;
  colorClass: string;
}

/** Lifetime profit thresholds for trader rank tiers. */
export const RANK_TIERS: RankTier[] = [
  {
    id: "rookie",
    title: "Rookie",
    emoji: "🌱",
    minProfit: Number.NEGATIVE_INFINITY,
    colorClass: "text-zinc-400",
  },
  {
    id: "bronze",
    title: "Bronze",
    emoji: "🥉",
    minProfit: 0,
    colorClass: "text-amber-600",
  },
  {
    id: "silver",
    title: "Silver",
    emoji: "🥈",
    minProfit: 200,
    colorClass: "text-zinc-300",
  },
  {
    id: "gold",
    title: "Gold",
    emoji: "🥇",
    minProfit: 1_000,
    colorClass: "text-amber-300",
  },
  {
    id: "diamond",
    title: "Diamond",
    emoji: "💎",
    minProfit: 5_000,
    colorClass: "text-cyan-300",
  },
  {
    id: "legend",
    title: "Legend",
    emoji: "👑",
    minProfit: 20_000,
    colorClass: "text-fuchsia-300",
  },
];

export function tierFromProfit(profit: number): RankTier {
  let tier = RANK_TIERS[0]!;
  for (const t of RANK_TIERS) {
    if (profit >= t.minProfit) tier = t;
  }
  return tier;
}

export function nextTier(current: RankTier): RankTier | null {
  const idx = RANK_TIERS.findIndex((t) => t.id === current.id);
  if (idx < 0 || idx >= RANK_TIERS.length - 1) return null;
  return RANK_TIERS[idx + 1] ?? null;
}

export function progressToNextTier(profit: number): {
  current: RankTier;
  next: RankTier | null;
  progress: number;
} {
  const current = tierFromProfit(profit);
  const next = nextTier(current);
  if (!next) {
    return { current, next: null, progress: 1 };
  }
  const span = next.minProfit - current.minProfit;
  const progress =
    span <= 0 ? 1 : Math.min(1, Math.max(0, (profit - current.minProfit) / span));
  return { current, next, progress };
}

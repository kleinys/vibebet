export interface AccuracyTier {
  id: string;
  title: string;
  emoji: string;
  minPredictions: number;
  minAccuracy: number;
  colorClass: string;
}

/** Accuracy-based predictor tiers (blueprint Oracle → Prophet → God-Tier). */
export const ACCURACY_TIERS: AccuracyTier[] = [
  {
    id: "learning",
    title: "Learning",
    emoji: "📚",
    minPredictions: 0,
    minAccuracy: 0,
    colorClass: "text-zinc-400",
  },
  {
    id: "oracle",
    title: "Oracle",
    emoji: "🔮",
    minPredictions: 10,
    minAccuracy: 0.55,
    colorClass: "text-violet-300",
  },
  {
    id: "prophet",
    title: "Prophet",
    emoji: "✨",
    minPredictions: 50,
    minAccuracy: 0.65,
    colorClass: "text-cyan-300",
  },
  {
    id: "sharp",
    title: "Sharp Mind",
    emoji: "🎯",
    minPredictions: 100,
    minAccuracy: 0.75,
    colorClass: "text-amber-300",
  },
];

export function tierFromAccuracy(
  predictionsScored: number,
  accuracyPct: number | null,
): AccuracyTier {
  let tier = ACCURACY_TIERS[0]!;
  if (accuracyPct == null) return tier;
  const accuracy = accuracyPct / 100;
  for (const t of ACCURACY_TIERS) {
    if (
      predictionsScored >= t.minPredictions &&
      accuracy >= t.minAccuracy
    ) {
      tier = t;
    }
  }
  return tier;
}

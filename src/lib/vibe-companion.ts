import type { Rarity } from "@/lib/supabase/types";

export interface CompanionInput {
  currentStreak: number;
  streakShields: number;
  inventoryCount: number;
  equippedSkinSlug?: string;
  equippedBadgeSlug?: string;
  skinRarity?: Rarity;
  badgeRarity?: Rarity;
  lastActiveDate?: string | null;
}

export interface CompanionState {
  stage: 1 | 2 | 3 | 4 | 5;
  name: string;
  glyph: string;
  tagline: string;
  score: number;
  progress: number;
  nextName: string | null;
}

const STAGES: { name: string; glyph: string; tagline: string; minScore: number }[] =
  [
    { name: "Vibelet", glyph: "🥚", tagline: "Your spirit animal awakens.", minScore: 0 },
    { name: "Kindle", glyph: "🐣", tagline: "A human silhouette appears beside your companion.", minScore: 8 },
    { name: "Wisp", glyph: "🦊", tagline: "Trainer and companion fight as a pair.", minScore: 20 },
    { name: "Seer", glyph: "🐲", tagline: "Rare gear reshapes your human form.", minScore: 45 },
    { name: "Archon", glyph: "👾", tagline: "Legend tier — max evolution.", minScore: 90 },
  ];

function rarityBonus(r?: Rarity): number {
  if (r === "legendary") return 20;
  if (r === "epic") return 12;
  if (r === "rare") return 5;
  return 0;
}

export function companionScore(input: CompanionInput): number {
  return (
    input.currentStreak * 3 +
    input.inventoryCount * 8 +
    input.streakShields * 5 +
    rarityBonus(input.skinRarity) +
    rarityBonus(input.badgeRarity) +
    (input.equippedBadgeSlug ? 4 : 0)
  );
}

export function computeCompanion(input: CompanionInput): CompanionState {
  const score = companionScore(input);
  let stageIdx = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (score >= STAGES[i]!.minScore) {
      stageIdx = i;
      break;
    }
  }

  const stage = STAGES[stageIdx]!;
  const next = STAGES[stageIdx + 1];
  const progress = next
    ? Math.min(
        1,
        (score - stage.minScore) / Math.max(1, next.minScore - stage.minScore),
      )
    : 1;

  return {
    stage: (stageIdx + 1) as 1 | 2 | 3 | 4 | 5,
    name: stage.name,
    glyph: stage.glyph,
    tagline: stage.tagline,
    score,
    progress,
    nextName: next?.name ?? null,
  };
}

"use client";

import { ShareCard } from "@/components/share-card";
import type { CompanionState } from "@/lib/vibe-companion";

export function CompanionEvolutionShare({
  displayName,
  username,
  companion,
  humanTitle,
  animalTitle,
}: {
  displayName: string;
  username?: string | null;
  companion: CompanionState;
  humanTitle: string;
  animalTitle: string;
}) {
  const nearEvolve =
    companion.nextName != null && companion.progress >= 0.85;
  const maxed = companion.stage === 5;

  return (
    <div className="mt-4 space-y-3">
      <ShareCard
        kind="companion"
        displayName={displayName}
        username={username}
        subline={`${humanTitle} & ${animalTitle} · Stage ${companion.stage}/5 ${companion.name}`}
      />
      {nearEvolve && (
        <ShareCard
          kind="win"
          displayName={displayName}
          username={username}
          headline={`Evolving to ${companion.nextName} on Vibebet (${Math.round(companion.progress * 100)}%)`}
          subline="Share your companion progress — invite friends to duel."
        />
      )}
      {maxed && (
        <ShareCard
          kind="win"
          displayName={displayName}
          username={username}
          headline="Max companion evolution — Archon tier unlocked!"
          subline="Legend status on Vibebet."
        />
      )}
    </div>
  );
}

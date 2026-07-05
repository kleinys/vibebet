"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseTier } from "@/components/locker-tier-case";

const TIER_ORDER: CaseTier[] = ["common", "uncommon", "rare", "epic", "legendary"];

const TIER_COLORS: Record<CaseTier, { bg: string; border: string; label: string }> = {
  common: { bg: "#3f3f46", border: "#71717a", label: "Common" },
  uncommon: { bg: "#166534", border: "#4ade80", label: "Uncommon" },
  rare: { bg: "#1d4ed8", border: "#60a5fa", label: "Rare" },
  epic: { bg: "#6b21a8", border: "#c084fc", label: "Epic" },
  legendary: { bg: "#b45309", border: "#fbbf24", label: "Jackpot" },
};

const CARD_W = 72;
const GAP = 8;

function buildReel(target: CaseTier, targetIndex: number): CaseTier[] {
  const items: CaseTier[] = [];
  for (let i = 0; i < 40; i++) {
    items.push(TIER_ORDER[i % TIER_ORDER.length]);
  }
  const landAt = 28 + targetIndex;
  items[landAt] = target;
  return items;
}

export function LockerCaseRoulette({
  active,
  targetTier,
  onDone,
}: {
  active: boolean;
  targetTier: CaseTier;
  onDone?: () => void;
}) {
  const targetIndex = TIER_ORDER.indexOf(targetTier);
  const reel = useMemo(() => buildReel(targetTier, targetIndex), [targetTier, targetIndex]);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!active) {
      setOffset(0);
      return;
    }
    const landIndex = 28 + targetIndex;
    const targetOffset = landIndex * (CARD_W + GAP) - 140;
    const id = requestAnimationFrame(() => setOffset(targetOffset));
    const done = window.setTimeout(() => onDone?.(), 2600);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(done);
    };
  }, [active, targetIndex, onDone]);

  if (!active) return null;

  return (
    <div className="locker-case-roulette" aria-hidden>
      <div className="locker-case-roulette__window">
        <div className="locker-case-roulette__marker" />
        <div
          className="locker-case-roulette__track"
          style={{ transform: `translateX(-${offset}px)` }}
        >
          {reel.map((tier, i) => {
            const c = TIER_COLORS[tier];
            return (
              <div
                key={`${tier}-${i}`}
                className="locker-case-roulette__card"
                style={{
                  background: c.bg,
                  borderColor: c.border,
                }}
              >
                <span>{c.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

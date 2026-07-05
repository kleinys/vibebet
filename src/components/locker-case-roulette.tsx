"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseTier } from "@/components/locker-tier-case";
import { CASE_IMAGES } from "@/lib/locker-assets";
import { CASE_ROULETTE_MS } from "@/lib/hypnotic-flow";

const TIER_ORDER: CaseTier[] = ["common", "uncommon", "rare", "epic", "legendary"];

const TIER_WEIGHT: Record<CaseTier, number> = {
  common: 46,
  uncommon: 30,
  rare: 15,
  epic: 7,
  legendary: 2,
};

function caseImageForTier(tier: CaseTier): string {
  if (tier === "common") return CASE_IMAGES.uncommon;
  return CASE_IMAGES[tier];
}

const CARD_W = 96;
const GAP = 12;

function pickWeightedTier(): CaseTier {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const tier of TIER_ORDER) {
    acc += TIER_WEIGHT[tier];
    if (roll <= acc) return tier;
  }
  return "common";
}

function buildReel(target: CaseTier, targetIndex: number): { items: CaseTier[]; landAt: number } {
  const items: CaseTier[] = [];
  for (let i = 0; i < 54; i++) {
    items.push(pickWeightedTier());
  }

  const landAt = 36 + targetIndex;
  items[landAt] = target;

  const nearMiss = target === "legendary" ? "epic" : target === "epic" ? "rare" : "uncommon";
  if (landAt - 1 >= 0) items[landAt - 1] = nearMiss;
  if (landAt + 1 < items.length) items[landAt + 1] = nearMiss;

  return { items, landAt };
}

export function LockerCaseRoulette({
  active,
  targetTier,
  onDone,
  durationMs = CASE_ROULETTE_MS,
  size = "panel",
}: {
  active: boolean;
  targetTier: CaseTier;
  onDone?: () => void;
  durationMs?: number;
  size?: "panel" | "cinema";
}) {
  const targetIndex = TIER_ORDER.indexOf(targetTier);
  const { items: reel, landAt } = useMemo(
    () => buildReel(targetTier, targetIndex),
    [targetTier, targetIndex],
  );
  const [offset, setOffset] = useState(0);
  const cardW = size === "cinema" ? 120 : CARD_W;
  const gap = size === "cinema" ? 16 : GAP;
  const centerOffset = size === "cinema" ? 200 : 150;

  useEffect(() => {
    if (!active) {
      setOffset(0);
      return;
    }
    const targetOffset = landAt * (cardW + gap) - centerOffset;
    const id = requestAnimationFrame(() => setOffset(targetOffset));
    const done = window.setTimeout(() => onDone?.(), durationMs);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(done);
    };
  }, [active, landAt, onDone, durationMs, cardW, gap, centerOffset]);

  if (!active) return null;

  return (
    <div className={`locker-case-roulette locker-case-roulette--${size}`} aria-hidden>
      <div className="locker-case-roulette__window">
        <div className="locker-case-roulette__marker" />
        <div
          className="locker-case-roulette__track"
          style={{
            transform: `translateX(-${offset}px)`,
            transitionDuration: `${durationMs}ms`,
            gap: `${gap}px`,
          }}
        >
          {reel.map((tier, i) => (
            <div
              key={`${tier}-${i}`}
              className={`locker-case-roulette__card locker-case-roulette__card--${tier}`}
              style={{ flex: `0 0 ${cardW}px`, height: size === "cinema" ? 108 : 76 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={caseImageForTier(tier)}
                alt=""
                draggable={false}
                className="locker-case-roulette__img"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

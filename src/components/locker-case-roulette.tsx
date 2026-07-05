"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseTier } from "@/components/locker-tier-case";
import { CASE_IMAGES } from "@/lib/locker-assets";

const TIER_ORDER: CaseTier[] = ["common", "uncommon", "rare", "epic", "legendary"];

function caseImageForTier(tier: CaseTier): string {
  if (tier === "common") return CASE_IMAGES.uncommon;
  return CASE_IMAGES[tier];
}

const CARD_W = 80;
const GAP = 10;

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
    const targetOffset = landIndex * (CARD_W + GAP) - 150;
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
          {reel.map((tier, i) => (
            <div key={`${tier}-${i}`} className="locker-case-roulette__card">
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

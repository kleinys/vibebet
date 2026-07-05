"use client";

import { CASE_IMAGES } from "@/lib/locker-assets";

export type CaseTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

const TIER_LABEL: Record<CaseTier, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function stakeToTier(stake: number): CaseTier {
  if (stake >= 1000) return "legendary";
  if (stake >= 500) return "epic";
  if (stake >= 250) return "rare";
  if (stake >= 100) return "uncommon";
  return "common";
}

export function resultLabelToTier(label: string): CaseTier {
  const l = label.toLowerCase();
  if (l.includes("legendary") || l.includes("jackpot")) return "legendary";
  if (l.includes("epic")) return "epic";
  if (l.includes("rare")) return "rare";
  if (l.includes("uncommon")) return "uncommon";
  return "common";
}

export function LockerTierCase({
  tier,
  open = false,
  dockedStake,
  shaking = false,
}: {
  tier: CaseTier;
  open?: boolean;
  dockedStake?: number | null;
  shaking?: boolean;
}) {
  const closedSrc = CASE_IMAGES[tier === "common" ? "uncommon" : tier];
  const src = open ? CASE_IMAGES.open : closedSrc;

  return (
    <div
      className={`locker-tier-case locker-tier-case--raster locker-tier-case--${tier} ${open ? "locker-tier-case--open" : ""} ${shaking ? "locker-tier-case--shake" : ""}`}
      aria-hidden
    >
      <span className="locker-tier-case__badge">{TIER_LABEL[tier]}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="locker-tier-case__img"
      />
      {dockedStake != null && !open && (
        <span className="locker-tier-case__docked tabular-nums">{dockedStake}</span>
      )}
      {(open || shaking) && <div className="locker-tier-case__glow-ring" aria-hidden />}
    </div>
  );
}

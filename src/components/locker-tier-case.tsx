"use client";

export type CaseTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

const TIER_STYLES: Record<
  CaseTier,
  { label: string; body: string; stripe: string; glow: string; lock: string }
> = {
  common: {
    label: "Common",
    body: "linear-gradient(165deg, #52525b 0%, #27272a 45%, #18181b 100%)",
    stripe: "linear-gradient(90deg, #71717a, #a1a1aa)",
    glow: "rgba(161, 161, 170, 0.35)",
    lock: "#a1a1aa",
  },
  uncommon: {
    label: "Uncommon",
    body: "linear-gradient(165deg, #166534 0%, #14532d 45%, #052e16 100%)",
    stripe: "linear-gradient(90deg, #22c55e, #4ade80, #16a34a)",
    glow: "rgba(34, 197, 94, 0.4)",
    lock: "#4ade80",
  },
  rare: {
    label: "Rare",
    body: "linear-gradient(165deg, #1d4ed8 0%, #1e3a8a 45%, #172554 100%)",
    stripe: "linear-gradient(90deg, #3b82f6, #60a5fa, #2563eb)",
    glow: "rgba(59, 130, 246, 0.45)",
    lock: "#60a5fa",
  },
  epic: {
    label: "Epic",
    body: "linear-gradient(165deg, #7e22ce 0%, #581c87 45%, #3b0764 100%)",
    stripe: "linear-gradient(90deg, #a855f7, #ec4899, #8b5cf6)",
    glow: "rgba(168, 85, 247, 0.5)",
    lock: "#c084fc",
  },
  legendary: {
    label: "Legendary",
    body: "linear-gradient(165deg, #b45309 0%, #92400e 45%, #451a03 100%)",
    stripe: "linear-gradient(90deg, #fbbf24, #f59e0b, #ef4444, #fbbf24)",
    glow: "rgba(251, 191, 36, 0.55)",
    lock: "#fde047",
  },
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
  const s = TIER_STYLES[tier];

  return (
    <div
      className={`locker-tier-case locker-tier-case--${tier} ${open ? "locker-tier-case--open" : ""} ${shaking ? "locker-tier-case--shake" : ""}`}
      style={{ "--case-glow": s.glow } as React.CSSProperties}
      aria-hidden
    >
      <div className="locker-tier-case__glow" />
      <span className="locker-tier-case__badge">{s.label}</span>
      <div className="locker-tier-case__body" style={{ background: s.body }}>
        <div className="locker-tier-case__stripe" style={{ background: s.stripe }} />
        <div className="locker-tier-case__stripe locker-tier-case__stripe--2" style={{ background: s.stripe }} />
        <div className="locker-tier-case__lock" style={{ borderColor: s.lock, boxShadow: `0 0 12px ${s.glow}` }} />
        {dockedStake != null && (
          <span className="locker-tier-case__docked tabular-nums">{dockedStake}</span>
        )}
        {open && <div className="locker-tier-case__loot-beam" />}
      </div>
      <div className="locker-tier-case__lid">
        <div className="locker-tier-case__lid-inner" style={{ background: s.body }} />
      </div>
      {open && <div className="locker-tier-case__burst" />}
    </div>
  );
}

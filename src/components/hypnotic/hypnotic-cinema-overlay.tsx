"use client";

import { LockerCasinoWheel } from "@/components/locker-casino-wheel";
import { LockerCaseRoulette } from "@/components/locker-case-roulette";
import { LockerTierCase, type CaseTier } from "@/components/locker-tier-case";

const TIER_DISPLAY: Record<CaseTier, string> = {
  common: "Industrial",
  uncommon: "Mil-Spec",
  rare: "Restricted",
  epic: "Classified",
  legendary: "Covert",
};

export function HypnoticCinemaOverlay({
  visible,
  mode,
  wheelRotation,
  wheelSpinning,
  superActive,
  caseRouletteActive,
  caseRouletteTier,
  caseTier,
  crateOpen,
  onCaseRouletteDone,
}: {
  visible: boolean;
  mode: "wheel" | "case" | null;
  wheelRotation: number;
  wheelSpinning: boolean;
  superActive: boolean;
  caseRouletteActive: boolean;
  caseRouletteTier: CaseTier;
  caseTier: CaseTier;
  crateOpen: boolean;
  onCaseRouletteDone?: () => void;
}) {
  if (!visible || !mode) return null;

  return (
    <div className="hypnotic-cinema-overlay" role="presentation" aria-hidden={!visible}>
      <div className="hypnotic-cinema-overlay__backdrop" />
      <div className="hypnotic-cinema-overlay__content">
        {mode === "wheel" && (
          <>
            <p className="hypnotic-cinema-overlay__title">Daily wheel</p>
            <LockerCasinoWheel
              size="cinema"
              rotation={wheelRotation}
              spinning={wheelSpinning}
              glowing={wheelSpinning || superActive}
            />
            <p className="hypnotic-cinema-overlay__hint">
              {wheelSpinning ? "Spinning…" : "Result"}
            </p>
          </>
        )}
        {mode === "case" && (
          <>
            <p className="hypnotic-cinema-overlay__title">Unlocking container</p>
            <LockerCaseRoulette
              size="cinema"
              active={caseRouletteActive}
              targetTier={caseRouletteTier}
              onDone={onCaseRouletteDone}
            />
            <div className="hypnotic-cinema-overlay__case-wrap">
              <div className="hypnotic-cinema-overlay__case">
                <LockerTierCase
                  tier={caseTier}
                  open={crateOpen}
                  shaking={crateOpen && caseRouletteActive}
                />
              </div>
              <div className={`hypnotic-cinema-overlay__reward hypnotic-cinema-overlay__reward--${caseTier}`}>
                <span className="hypnotic-cinema-overlay__reward-tier">{TIER_DISPLAY[caseTier]}</span>
                <span className="hypnotic-cinema-overlay__reward-label">{caseTier.toUpperCase()}</span>
              </div>
            </div>
            <p className="hypnotic-cinema-overlay__hint">
              {caseRouletteActive ? "Inspecting weapon finish…" : "Revealed"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

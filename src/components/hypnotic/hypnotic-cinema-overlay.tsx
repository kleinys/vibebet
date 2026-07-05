"use client";

import { LockerCasinoWheel } from "@/components/locker-casino-wheel";
import { LockerCaseRoulette } from "@/components/locker-case-roulette";
import { LockerTierCase, type CaseTier } from "@/components/locker-tier-case";

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
            <p className="hypnotic-cinema-overlay__title">VIBE case</p>
            <LockerCaseRoulette
              size="cinema"
              active={caseRouletteActive}
              targetTier={caseRouletteTier}
              onDone={onCaseRouletteDone}
            />
            <div className="hypnotic-cinema-overlay__case">
              <LockerTierCase
                tier={caseTier}
                open={crateOpen}
                shaking={crateOpen && caseRouletteActive}
              />
            </div>
            <p className="hypnotic-cinema-overlay__hint">
              {caseRouletteActive ? "Rolling tier…" : "Opening…"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

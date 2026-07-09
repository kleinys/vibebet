"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LockerCasinoWheel } from "@/components/locker-casino-wheel";
import { LockerCaseRoulette } from "@/components/locker-case-roulette";
import { LockerTierCase, type CaseTier } from "@/components/locker-tier-case";
import { HypnoticPlinkoBoard } from "@/components/hypnotic/hypnotic-plinko-board";

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
  onExit,
  queueHint,
  onWheelSpin,
  onCaseOpen,
  wheelSpinDisabled,
  caseOpenDisabled,
  wheelSpinLabel,
  caseOpenLabel,
  plinkoBalance,
  onPlinkoBalanceChange,
}: {
  visible: boolean;
  mode: "wheel" | "case" | "plinko" | null;
  wheelRotation: number;
  wheelSpinning: boolean;
  superActive: boolean;
  caseRouletteActive: boolean;
  caseRouletteTier: CaseTier;
  caseTier: CaseTier;
  crateOpen: boolean;
  onCaseRouletteDone?: () => void;
  onExit?: () => void;
  queueHint?: string | null;
  onWheelSpin?: () => void;
  onCaseOpen?: () => void;
  wheelSpinDisabled?: boolean;
  caseOpenDisabled?: boolean;
  wheelSpinLabel?: string;
  caseOpenLabel?: string;
  plinkoBalance?: number;
  onPlinkoBalanceChange?: (balance: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible || !mode || !mounted) return null;

  return createPortal(
    <div
      className="hypnotic-cinema-overlay hypnotic-cinema-overlay--interactive"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "wheel"
          ? "Daily wheel full screen"
          : mode === "case"
            ? "VIBE case full screen"
            : "Plinko full screen"
      }
    >
      <div className="hypnotic-cinema-overlay__backdrop" />
      {onExit && (
        <button
          type="button"
          className="hypnotic-cinema-overlay__exit"
          onClick={onExit}
          aria-label="Exit full screen"
        >
          ← Back
        </button>
      )}
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
              {wheelSpinning ? "Spinning…" : queueHint ?? "Tap spin again to queue more"}
            </p>
            {onWheelSpin && (
              <button
                type="button"
                disabled={wheelSpinDisabled}
                onClick={onWheelSpin}
                className="hypnotic-cinema-overlay__cta hypnotic-cinema-overlay__cta--wheel"
              >
                {wheelSpinLabel ?? "Spin"}
              </button>
            )}
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
              {caseRouletteActive ? "Inspecting weapon finish…" : queueHint ?? "Tap open again to queue more"}
            </p>
            {onCaseOpen && (
              <button
                type="button"
                disabled={caseOpenDisabled}
                onClick={onCaseOpen}
                className="hypnotic-cinema-overlay__cta hypnotic-cinema-overlay__cta--case"
              >
                {caseOpenLabel ?? "Open case"}
              </button>
            )}
          </>
        )}
        {mode === "plinko" && plinkoBalance != null && (
          <>
            <p className="hypnotic-cinema-overlay__title">Plinko</p>
            <div className="hypnotic-cinema-overlay__plinko">
              <HypnoticPlinkoBoard
                balance={plinkoBalance}
                onBalanceChange={onPlinkoBalanceChange}
                variant="cinema"
              />
            </div>
            <p className="hypnotic-cinema-overlay__hint">
              Set stake and risk, then tap Bet to drop the ball.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

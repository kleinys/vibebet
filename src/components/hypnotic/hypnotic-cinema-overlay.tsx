"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LockerCasinoWheel } from "@/components/locker-casino-wheel";
import { LockerCaseRoulette } from "@/components/locker-case-roulette";
import { LockerTierCase, type CaseTier } from "@/components/locker-tier-case";
import { HypnoticPlinkoBoard } from "@/components/hypnotic/hypnotic-plinko-board";
import { CRATE_STAKES } from "@/lib/hypnotic-flow";
import { formatVibe } from "@/lib/utils";

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
  crateStake,
  stakeDocked,
  recommendedStake,
  caseStakeLocked,
  chipSliding,
  onSelectStake,
  caseBalance,
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
  crateStake?: (typeof CRATE_STAKES)[number];
  stakeDocked?: boolean;
  recommendedStake?: (typeof CRATE_STAKES)[number];
  caseStakeLocked?: boolean;
  chipSliding?: number | null;
  onSelectStake?: (stake: (typeof CRATE_STAKES)[number]) => void;
  caseBalance?: number;
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
        <button type="button" className="hypnotic-cinema-overlay__exit" onClick={onExit}>
          Exit full screen
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
            {onSelectStake && crateStake != null && (
              <div className="hypnotic-cinema-overlay__stakes">
                <p className="hypnotic-cinema-overlay__stakes-label">Stake (VIBE)</p>
                <div className="hypnotic-cinema-overlay__stakes-row">
                  {CRATE_STAKES.map((stake) => {
                    const isRec = recommendedStake === stake;
                    const isActive = crateStake === stake;
                    return (
                      <button
                        key={stake}
                        type="button"
                        disabled={caseStakeLocked}
                        onClick={() => onSelectStake(stake)}
                        className={`hypnotic-stake-chip min-w-[4.5rem] rounded-lg border px-4 py-2.5 text-sm font-bold tabular-nums transition ${
                          chipSliding === stake ? "hypnotic-stake-chip--slide" : ""
                        } ${
                          isActive
                            ? "hypnotic-stake-chip--recommended border-amber-400/70 bg-amber-500/30 text-amber-50 shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                            : isRec
                              ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
                              : "border-white/15 bg-zinc-900/70 text-zinc-200 hover:border-amber-400/35 hover:bg-zinc-800"
                        }`}
                      >
                        {formatVibe(stake)}
                      </button>
                    );
                  })}
                </div>
                {caseBalance != null && (
                  <p className="hypnotic-cinema-overlay__stakes-balance tabular-nums">
                    Balance {formatVibe(caseBalance)} VIBE
                    {!stakeDocked && " · pick a stake to dock on crate"}
                  </p>
                )}
              </div>
            )}
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
                onExit={onExit}
                variant="cinema"
              />
            </div>
            <p className="hypnotic-cinema-overlay__hint">
              Set stake and risk, then tap Bet — queue multiple drops without waiting.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { orbitModifierSummary } from "@/lib/orbit-affinity";
import { parseMomentumFromRpc } from "@/lib/hypnotic-flow";
import { useHypnoticFlow } from "@/components/hypnotic/hypnotic-flow-provider";
import {
  CRATE_STAKES,
  PAID_SPIN_COST,
} from "@/lib/hypnotic-flow";
import { WHEEL_SEGMENTS } from "@/components/companion-locker-rewards";
import { LockerCasinoWheel, WHEEL_ART_POINTER_INDEX } from "@/components/locker-casino-wheel";
import {
  LockerTierCase,
  resultLabelToTier,
  stakeToTier,
  type CaseTier,
} from "@/components/locker-tier-case";
import { LockerCaseRoulette } from "@/components/locker-case-roulette";

const BTN =
  "rounded-sm border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

type CrateResult = {
  label: string;
  payout: number;
  net: number;
  newBalance: number;
};

type WheelResult = {
  segmentIndex: number;
  label: string;
  payout: number;
  cost: number;
  net: number;
  newBalance: number;
  freeSpin: boolean;
};

const WHEEL_SPIN_MS = 5000;

export function HypnoticMorphFloor({
  vibeBalance,
  spinsUsedToday,
  equippedSkinSlug,
}: {
  vibeBalance: number;
  spinsUsedToday: number;
  equippedSkinSlug?: string | null;
}) {
  const router = useRouter();
  const modifier = orbitModifierSummary(equippedSkinSlug ?? null);
  const {
    mode,
    setMode,
    recommendedStake,
    stakeDocked,
    setStakeDocked,
    onWheelWin,
    onCaseResult,
    setCinema,
    setReaction,
    morphing,
    superActive,
  } = useHypnoticFlow();

  const [balance, setBalance] = useState(vibeBalance);
  const [spinsUsed, setSpinsUsed] = useState(spinsUsedToday);
  const [crateStake, setCrateStake] = useState<(typeof CRATE_STAKES)[number]>(250);
  const [crateOpen, setCrateOpen] = useState(false);
  const [crateResult, setCrateResult] = useState<CrateResult | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<WheelResult | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chipSliding, setChipSliding] = useState<number | null>(null);
  const [caseRouletteTier, setCaseRouletteTier] = useState<CaseTier | null>(null);
  const [pendingCrate, setPendingCrate] = useState<CrateResult | null>(null);
  const crateSyncRef = useRef<Record<string, unknown> | null>(null);

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;
  const freeSpinAvailable = spinsUsed === 0;

  const caseTier = crateResult
    ? resultLabelToTier(crateResult.label)
    : stakeToTier(crateStake);

  function parseError(err: unknown): string {
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: string }).message);
    }
    return "Something went wrong. Try again.";
  }

  function finishCrateOpen() {
    setPendingCrate((pending) => {
      if (!pending) return null;
      setCrateResult(pending);
      setBalance(pending.newBalance);
      setCaseRouletteTier(null);
      setBusy(false);
      setCinema("idle");
      setReaction("idle");
      const sync = crateSyncRef.current;
      if (sync) {
        onCaseResult(pending.net, parseMomentumFromRpc(sync));
      }
      crateSyncRef.current = null;
      router.refresh();
      return null;
    });
  }

  function selectStake(stake: (typeof CRATE_STAKES)[number]) {
    if (busy || crateOpen) return;
    setChipSliding(stake);
    window.setTimeout(() => {
      setCrateStake(stake);
      setStakeDocked(true);
      setChipSliding(null);
    }, 420);
  }

  async function openCrate() {
    if (crateOpen || busy) return;
    setError(null);
    setBusy(true);
    setCrateOpen(true);
    setCrateResult(null);
    setCinema("case-open");
    setReaction("watch-wheel");

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("open_locker_crate", {
        p_stake: crateStake,
      });
      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No crate result returned");

      const result: CrateResult = {
        label: row.label as string,
        payout: Number(row.payout),
        net: Number(row.net),
        newBalance: Number(row.new_balance),
      };
      const tier = resultLabelToTier(result.label);
      setPendingCrate(result);
      setCaseRouletteTier(tier);
      crateSyncRef.current = row as Record<string, unknown>;
    } catch (e) {
      setCrateOpen(false);
      setBusy(false);
      setCinema("idle");
      setReaction("idle");
      setError(parseError(e));
    }
  }

  function resetCrate() {
    setCrateOpen(false);
    setCrateResult(null);
    setPendingCrate(null);
    setCaseRouletteTier(null);
    crateSyncRef.current = null;
    setError(null);
    setStakeDocked(false);
  }

  async function spinWheel() {
    if (wheelSpinning || busy) return;
    setError(null);
    setBusy(true);
    setWheelSpinning(true);
    setWheelResult(null);
    setCinema("wheel-spin");
    setReaction("watch-wheel");

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("spin_locker_wheel", {
        p_paid_stake: PAID_SPIN_COST,
      });
      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No spin result returned");

      const segmentIndex = Number(row.segment_index);
      const spins = 5 + Math.floor(Math.random() * 2);
      const nextRotation =
        wheelRotation +
        spins * 360 +
        (WHEEL_ART_POINTER_INDEX - segmentIndex) * segmentAngle;

      setWheelRotation(nextRotation);

      window.setTimeout(() => {
        const result: WheelResult = {
          segmentIndex,
          label: row.label as string,
          payout: Number(row.payout),
          cost: Number(row.cost),
          net: Number(row.net),
          newBalance: Number(row.new_balance),
          freeSpin: Boolean(row.free_spin),
        };
        setWheelResult(result);
        setBalance(result.newBalance);
        setSpinsUsed((n) => n + 1);
        setWheelSpinning(false);
        setBusy(false);
        onWheelWin(result.payout, parseMomentumFromRpc(row as Record<string, unknown>));
        router.refresh();
      }, WHEEL_SPIN_MS);
    } catch (e) {
      setWheelSpinning(false);
      setBusy(false);
      setCinema("idle");
      setReaction("idle");
      setError(parseError(e));
    }
  }

  return (
    <div className="hypnotic-morph-floor">
      <div className="hypnotic-morph-floor__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "wheel"}
          className={`hypnotic-morph-floor__tab ${mode === "wheel" ? "hypnotic-morph-floor__tab--active" : ""}`}
          onClick={() => {
            setMode("wheel");
            document.getElementById("vibe-wheel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        >
          Daily wheel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "case"}
          className={`hypnotic-morph-floor__tab ${mode === "case" ? "hypnotic-morph-floor__tab--active" : ""}`}
          onClick={() => {
            setMode("case");
            document.getElementById("vibe-case")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        >
          VIBE case
        </button>
        <div className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200">
          <CurrencyIconVibe className="h-4 w-4" />
          <span className="tabular-nums font-medium">{formatVibe(balance)} VIBE</span>
        </div>
      </div>

      {modifier && (
        <p className="hypnotic-morph-floor__modifier text-center text-[10px] text-zinc-500">
          {modifier.affinity.icon} {modifier.morphLabel} — {modifier.affinity.crateEffect}
          {superActive && (
            <span className="ml-2 text-amber-300">· SUPER mode — chase the jackpot</span>
          )}
        </p>
      )}

      {error && (
        <p className="mx-4 mt-2 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="hypnotic-morph-floor__grid">
        {/* VIBE case — always visible beside wheel on md+ */}
        <section
          className={`hypnotic-morph-panel hypnotic-morph-panel--case ${mode === "case" ? "hypnotic-morph-panel--focused" : ""}`}
          id="vibe-case"
        >
          <p className="hypnotic-morph-panel__title text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            VIBE case
          </p>
          <LockerCaseRoulette
            active={crateOpen && caseRouletteTier != null && !crateResult}
            targetTier={caseRouletteTier ?? "common"}
            onDone={finishCrateOpen}
          />
          <LockerTierCase
            tier={caseTier}
            open={crateOpen}
            dockedStake={stakeDocked ? crateStake : null}
            shaking={crateOpen && !crateResult}
          />

          {crateResult ? (
            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-amber-200">{crateResult.label}</p>
              {superActive && (
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  SUPER 2× applied
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                Payout{" "}
                <span className="font-medium text-emerald-300">
                  +{formatVibe(crateResult.payout)} VIBE
                </span>
                {" · "}
                Net{" "}
                <span
                  className={
                    crateResult.net >= 0 ? "font-medium text-emerald-300" : "font-medium text-rose-300"
                  }
                >
                  {crateResult.net >= 0 ? "+" : ""}
                  {formatVibe(crateResult.net)} VIBE
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-center text-[11px] text-zinc-500">
              {caseRouletteTier
                ? "Roulette spinning…"
                : crateOpen
                  ? "Case vibrating…"
                  : stakeDocked
                    ? "Tap OPEN CASE"
                    : "Pick stake — chip docks on crate"}
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {CRATE_STAKES.map((stake) => {
              const isRec = recommendedStake === stake;
              const isActive = crateStake === stake;
              return (
                <button
                  key={stake}
                  type="button"
                  disabled={busy || crateOpen}
                  onClick={() => selectStake(stake)}
                  className={`hypnotic-stake-chip rounded-sm border px-3 py-1.5 text-[11px] font-semibold tabular-nums transition ${
                    chipSliding === stake ? "hypnotic-stake-chip--slide" : ""
                  } ${
                    isActive
                      ? "hypnotic-stake-chip--recommended border-amber-400/60 bg-amber-500/25 text-amber-50"
                      : isRec
                        ? "border-amber-300/35 bg-amber-500/10 text-amber-100/90"
                        : "border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-amber-400/30"
                  }`}
                >
                  {formatVibe(stake)}
                  {isRec && !isActive && !stakeDocked && (
                    <span className="ml-1 text-[9px] text-amber-200/80">use winnings</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {!crateResult ? (
              <button
                type="button"
                disabled={crateOpen || busy || balance < crateStake || !stakeDocked}
                onClick={openCrate}
                className={`hypnotic-cta hypnotic-cta--case ${BTN} border-amber-400/45 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30`}
              >
                {crateOpen ? "Opening…" : `Open case · ${formatVibe(crateStake)} VIBE`}
              </button>
            ) : (
              <button
                type="button"
                onClick={resetCrate}
                className={`${BTN} border-white/15 bg-zinc-900 text-zinc-300 hover:bg-zinc-800`}
              >
                Open another
              </button>
            )}
          </div>
        </section>

        {/* Daily wheel */}
        <section
          className={`hypnotic-morph-panel hypnotic-morph-panel--wheel ${mode === "wheel" ? "hypnotic-morph-panel--focused" : ""}`}
          id="vibe-wheel"
        >
          <p className="hypnotic-morph-panel__title text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Daily wheel
          </p>
          <LockerCasinoWheel
            rotation={wheelRotation}
            spinning={wheelSpinning}
            glowing={wheelSpinning || superActive}
          />

          {wheelResult ? (
            <div className="mt-4 text-center">
              <p className="text-sm font-semibold text-violet-100">Won: {wheelResult.label}</p>
              {superActive && (
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  SUPER 2× jackpot
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                {wheelResult.freeSpin ? "Free spin · " : `Cost ${formatVibe(wheelResult.cost)} VIBE · `}
                Net{" "}
                <span
                  className={
                    wheelResult.net >= 0 ? "font-medium text-emerald-300" : "font-medium text-rose-300"
                  }
                >
                  {wheelResult.net >= 0 ? "+" : ""}
                  {formatVibe(wheelResult.net)} VIBE
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-center text-[11px] text-zinc-500">
              {wheelSpinning
                ? "Wheel slowing…"
                : freeSpinAvailable
                  ? "1 free spin today"
                  : `Extra spins · ${PAID_SPIN_COST} VIBE`}
            </p>
          )}

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={wheelSpinning || busy || (!freeSpinAvailable && balance < PAID_SPIN_COST)}
              onClick={spinWheel}
              className={`hypnotic-cta hypnotic-cta--wheel ${freeSpinAvailable ? "hypnotic-cta--magnet" : ""} ${BTN} border-violet-400/45 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`}
            >
              {wheelSpinning
                ? "Spinning…"
                : freeSpinAvailable
                  ? "Free daily spin"
                  : `Spin · ${PAID_SPIN_COST} VIBE`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

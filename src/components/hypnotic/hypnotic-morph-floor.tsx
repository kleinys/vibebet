"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { parseMomentumFromRpc } from "@/lib/hypnotic-flow";
import { useHypnoticFlow } from "@/components/hypnotic/hypnotic-flow-provider";
import {
  CRATE_STAKES,
  PAID_SPIN_COST,
  WHEEL_SPIN_MS,
} from "@/lib/hypnotic-flow";
import { wheelRotationToSegment } from "@/lib/wheel-segments";
import { HypnoticModifierBanner } from "@/components/hypnotic/hypnotic-modifier-banner";
import { HypnoticCinemaOverlay } from "@/components/hypnotic/hypnotic-cinema-overlay";
import { LockerCasinoWheel } from "@/components/locker-casino-wheel";
import {
  LockerTierCase,
  resultLabelToTier,
  stakeToTier,
  type CaseTier,
} from "@/components/locker-tier-case";
import { LockerCaseRoulette } from "@/components/locker-case-roulette";
import { HypnoticPlinkoBoard } from "@/components/hypnotic/hypnotic-plinko-board";

const BTN =
  "rounded-sm border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

const MAX_WHEEL_QUEUE = 8;
const MAX_CASE_QUEUE = 5;

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

type WheelSpinJob = {
  segmentIndex: number;
  result: WheelResult;
  syncRow: Record<string, unknown>;
};

type CaseOpenJob = {
  result: CrateResult;
  tier: CaseTier;
  syncRow: Record<string, unknown>;
};

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
  const {
    mode,
    setMode,
    recommendedStake,
    stakeDocked,
    setStakeDocked,
    onWheelWin,
    onCaseResult,
    cinema,
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
  const [chipSliding, setChipSliding] = useState<number | null>(null);
  const [caseRouletteTier, setCaseRouletteTier] = useState<CaseTier | null>(null);
  const [pendingCrate, setPendingCrate] = useState<CrateResult | null>(null);
  const [cinemaPortal, setCinemaPortal] = useState<"wheel" | "case" | "plinko" | null>(null);
  const [pendingSpins, setPendingSpins] = useState(0);
  const [pendingCases, setPendingCases] = useState(0);
  const [wheelQueueLen, setWheelQueueLen] = useState(0);
  const [caseQueueLen, setCaseQueueLen] = useState(0);
  const crateSyncRef = useRef<Record<string, unknown> | null>(null);
  const wheelQueueRef = useRef<WheelSpinJob[]>([]);
  const caseQueueRef = useRef<CaseOpenJob[]>([]);
  const wheelDrainingRef = useRef(false);
  const caseDrainingRef = useRef(false);
  const wheelRotationRef = useRef(0);

  const freeSpinAvailable = spinsUsed === 0;
  const cinemaActive = cinema === "wheel-spin" || cinema === "case-open";
  const cinemaVisible = cinemaPortal != null;
  const cinemaMode = cinemaPortal;

  const caseTier = crateResult
    ? resultLabelToTier(crateResult.label)
    : stakeToTier(crateStake);

  const wheelQueued =
    pendingSpins + wheelQueueLen + (wheelDrainingRef.current ? 1 : 0);
  const caseQueued =
    pendingCases + caseQueueLen + (caseDrainingRef.current ? 1 : 0);
  const wheelQueueFull = wheelQueued >= MAX_WHEEL_QUEUE;
  const caseQueueFull = caseQueued >= MAX_CASE_QUEUE;
  const caseStakeLocked = caseQueued > 0;

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
      setCinema("idle");
      setReaction("idle");
      const sync = crateSyncRef.current;
      if (sync) {
        onCaseResult(pending.net, parseMomentumFromRpc(sync));
      }
      crateSyncRef.current = null;
      router.refresh();

      window.setTimeout(() => {
        setCrateOpen(false);
        setCrateResult(null);
        caseDrainingRef.current = false;
        void drainCaseQueue();
      }, 900);

      return null;
    });
  }

  async function drainCaseQueue() {
    if (caseDrainingRef.current || caseQueueRef.current.length === 0) return;
    const job = caseQueueRef.current.shift() ?? null;
    if (!job) return;
    setCaseQueueLen(caseQueueRef.current.length);

    caseDrainingRef.current = true;
    setError(null);
    setCrateOpen(true);
    setCrateResult(null);
    setCinema("case-open");
    setReaction("watch-wheel");
    setPendingCrate(job.result);
    setCaseRouletteTier(job.tier);
    crateSyncRef.current = job.syncRow;
  }

  async function drainWheelQueue() {
    if (wheelDrainingRef.current || wheelQueueRef.current.length === 0) return;
    const job = wheelQueueRef.current.shift() ?? null;
    if (!job) return;
    setWheelQueueLen(wheelQueueRef.current.length);

    wheelDrainingRef.current = true;
    setWheelSpinning(true);
    setWheelResult(null);
    setCinema("wheel-spin");
    setReaction("watch-wheel");

    const spins = 5 + Math.floor(Math.random() * 2);
    const targetRotation = wheelRotationToSegment(
      job.segmentIndex,
      wheelRotationRef.current,
      spins,
    );
    wheelRotationRef.current = targetRotation;
    setWheelRotation(targetRotation);

    window.setTimeout(() => {
      setWheelResult(job.result);
      setBalance(job.result.newBalance);
      setSpinsUsed((n) => n + 1);
      setWheelSpinning(false);
      wheelDrainingRef.current = false;
      onWheelWin(job.result.payout, parseMomentumFromRpc(job.syncRow));
      router.refresh();
      void drainWheelQueue();
    }, WHEEL_SPIN_MS);
  }

  function selectStake(stake: (typeof CRATE_STAKES)[number]) {
    if (caseStakeLocked) return;
    setChipSliding(stake);
    window.setTimeout(() => {
      setCrateStake(stake);
      setStakeDocked(true);
      setChipSliding(null);
    }, 420);
  }

  async function openCrate() {
    if (!stakeDocked || balance < crateStake) return;
    if (caseQueueFull) {
      setError(`Max ${MAX_CASE_QUEUE} cases queued.`);
      return;
    }

    setError(null);
    setPendingCases((n) => n + 1);
    const stake = crateStake;

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("open_locker_crate", {
        p_stake: stake,
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
      caseQueueRef.current.push({
        result,
        tier,
        syncRow: row as Record<string, unknown>,
      });
      setCaseQueueLen(caseQueueRef.current.length);
      void drainCaseQueue();
    } catch (e) {
      setError(parseError(e));
    } finally {
      setPendingCases((n) => Math.max(0, n - 1));
    }
  }

  function resetCrate() {
    setCrateOpen(false);
    setCrateResult(null);
    setPendingCrate(null);
    setCaseRouletteTier(null);
    crateSyncRef.current = null;
    caseQueueRef.current = [];
    caseDrainingRef.current = false;
    setCaseQueueLen(0);
    setError(null);
    setStakeDocked(false);
  }

  function spinWheel() {
    if (wheelQueueFull) {
      setError(`Max ${MAX_WHEEL_QUEUE} spins queued.`);
      return;
    }
    if (!freeSpinAvailable && balance < PAID_SPIN_COST) return;

    setError(null);
    setPendingSpins((n) => n + 1);

    void (async () => {
      try {
        const supabase = createClient();
        const { data, error: rpcError } = await supabase.rpc("spin_locker_wheel", {
          p_paid_stake: PAID_SPIN_COST,
        });
        if (rpcError) throw rpcError;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error("No spin result returned");

        const segmentIndex = Number(row.segment_index);
        const result: WheelResult = {
          segmentIndex,
          label: row.label as string,
          payout: Number(row.payout),
          cost: Number(row.cost),
          net: Number(row.net),
          newBalance: Number(row.new_balance),
          freeSpin: Boolean(row.free_spin),
        };

        wheelQueueRef.current.push({
          segmentIndex,
          result,
          syncRow: row as Record<string, unknown>,
        });
        setWheelQueueLen(wheelQueueRef.current.length);
        void drainWheelQueue();
      } catch (e) {
        setError(parseError(e));
      } finally {
        setPendingSpins((n) => Math.max(0, n - 1));
      }
    })();
  }

  function closeCinemaPortal() {
    setCinemaPortal(null);
    if (!wheelDrainingRef.current && !caseDrainingRef.current) {
      setCinema("idle");
      setReaction("idle");
    }
  }

  const wheelSpinLabel = freeSpinAvailable
    ? "Free daily spin"
    : `Spin · ${PAID_SPIN_COST} VIBE`;
  const caseOpenLabel = `Open case · ${formatVibe(crateStake)} VIBE`;
  const wheelQueueHint =
    wheelQueueLen > 0 || pendingSpins > 0
      ? `${wheelQueued} in queue`
      : null;
  const caseQueueHint =
    caseQueueLen > 0 || pendingCases > 0 ? `${caseQueued} in queue` : null;

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
        <button
          type="button"
          role="tab"
          aria-selected={mode === "plinko"}
          className={`hypnotic-morph-floor__tab ${mode === "plinko" ? "hypnotic-morph-floor__tab--active" : ""}`}
          onClick={() => {
            setMode("plinko");
            document.getElementById("vibe-plinko")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
        >
          Plinko
        </button>
        <div className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200">
          <CurrencyIconVibe className="h-4 w-4" />
          <span className="tabular-nums font-medium">{formatVibe(balance)} VIBE</span>
        </div>
      </div>

      <HypnoticModifierBanner equippedSkinSlug={equippedSkinSlug} />
      {superActive && (
        <p className="mx-4 mt-2 text-center text-xs font-semibold text-amber-300">
          SUPER mode — chase the jackpot
        </p>
      )}

      {error && (
        <p className="mx-4 mt-2 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div
        className={`hypnotic-morph-floor__grid ${cinemaVisible ? "hypnotic-morph-floor__grid--cinema-dim" : ""}`}
      >
        {/* VIBE case — always visible beside wheel on md+ */}
        <section
          className={`hypnotic-morph-panel hypnotic-morph-panel--case ${mode === "case" ? "hypnotic-morph-panel--focused" : ""}`}
          id="vibe-case"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="hypnotic-morph-panel__title text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
              VIBE case
            </p>
            {cinemaPortal !== "case" && (
              <button
                type="button"
                onClick={() => setCinemaPortal("case")}
                className="rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200 hover:bg-amber-500/25"
              >
                Full screen
              </button>
            )}
          </div>
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

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {CRATE_STAKES.map((stake) => {
              const isRec = recommendedStake === stake;
              const isActive = crateStake === stake;
              return (
                <button
                  key={stake}
                  type="button"
                  disabled={caseStakeLocked}
                  onClick={() => selectStake(stake)}
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
                disabled={caseQueueFull || balance < crateStake || !stakeDocked}
                onClick={openCrate}
                className={`hypnotic-cta hypnotic-cta--case ${BTN} border-amber-400/45 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30`}
              >
                {caseQueued > 0 ? `Open case (${caseQueued} queued)` : caseOpenLabel}
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
          <div className="flex items-center justify-between gap-2">
            <p className="hypnotic-morph-panel__title text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
              Daily wheel
            </p>
            {cinemaPortal !== "wheel" && (
              <button
                type="button"
                onClick={() => setCinemaPortal("wheel")}
                className="rounded-md border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200 hover:bg-violet-500/25"
              >
                Full screen
              </button>
            )}
          </div>
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
              disabled={wheelQueueFull || (!freeSpinAvailable && balance < PAID_SPIN_COST)}
              onClick={spinWheel}
              className={`hypnotic-cta hypnotic-cta--wheel ${freeSpinAvailable ? "hypnotic-cta--magnet" : ""} ${BTN} border-violet-400/45 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`}
            >
              {wheelQueued > 0
                ? `Spin (${wheelQueued} queued)`
                : wheelSpinning
                  ? "Spinning…"
                  : wheelSpinLabel}
            </button>
          </div>
        </section>

        <section
          className={`hypnotic-morph-panel hypnotic-morph-panel--plinko ${mode === "plinko" ? "hypnotic-morph-panel--focused" : ""}`}
          id="vibe-plinko"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <p className="hypnotic-morph-panel__title text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
              Plinko
            </p>
            {cinemaPortal !== "plinko" && (
              <button
                type="button"
                onClick={() => setCinemaPortal("plinko")}
                className="rounded-md border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200 hover:bg-violet-500/25"
              >
                Full screen
              </button>
            )}
          </div>
          <HypnoticPlinkoBoard balance={balance} onBalanceChange={setBalance} />
        </section>

      </div>

      <HypnoticCinemaOverlay
        visible={cinemaVisible}
        mode={cinemaMode}
        wheelRotation={wheelRotation}
        wheelSpinning={wheelSpinning}
        superActive={superActive}
        caseRouletteActive={crateOpen && caseRouletteTier != null && !crateResult}
        caseRouletteTier={caseRouletteTier ?? "common"}
        caseTier={caseTier}
        crateOpen={crateOpen}
        onCaseRouletteDone={finishCrateOpen}
        onExit={closeCinemaPortal}
        queueHint={cinemaMode === "wheel" ? wheelQueueHint : caseQueueHint}
        onWheelSpin={cinemaMode === "wheel" ? spinWheel : undefined}
        onCaseOpen={cinemaMode === "case" ? openCrate : undefined}
        wheelSpinDisabled={wheelQueueFull || (!freeSpinAvailable && balance < PAID_SPIN_COST)}
        caseOpenDisabled={caseQueueFull || balance < crateStake || !stakeDocked}
        wheelSpinLabel={wheelSpinLabel}
        caseOpenLabel={caseOpenLabel}
        plinkoBalance={balance}
        onPlinkoBalanceChange={setBalance}
      />
    </div>
  );
}

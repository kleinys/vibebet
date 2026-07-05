"use client";

import { useMemo, useState } from "react";
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

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;
  const freeSpinAvailable = spinsUsed === 0;

  const wheelGradient = useMemo(
    () =>
      `conic-gradient(${WHEEL_SEGMENTS.map(
        (seg, i) =>
          `${seg.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`,
      ).join(", ")})`,
    [segmentAngle],
  );

  function parseError(err: unknown): string {
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: string }).message);
    }
    return "Something went wrong. Try again.";
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

      window.setTimeout(() => {
        const result: CrateResult = {
          label: row.label as string,
          payout: Number(row.payout),
          net: Number(row.net),
          newBalance: Number(row.new_balance),
        };
        setCrateResult(result);
        setBalance(result.newBalance);
        setBusy(false);
        setCinema("idle");
        setReaction("idle");
        onCaseResult(result.net, parseMomentumFromRpc(row as Record<string, unknown>));
        router.refresh();
      }, 1100);
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
        (WHEEL_SEGMENTS.length - segmentIndex) * segmentAngle -
        segmentAngle / 2;

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
          onClick={() => setMode("wheel")}
        >
          Daily wheel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "case"}
          className={`hypnotic-morph-floor__tab ${mode === "case" ? "hypnotic-morph-floor__tab--active" : ""}`}
          onClick={() => setMode("case")}
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

      <div
        className={`hypnotic-morph-viewport hypnotic-morph-viewport--${mode} ${morphing ? "hypnotic-morph-viewport--morphing" : ""}`}
        data-mode={mode}
      >
        {/* Case layer */}
        <div className="hypnotic-morph-viewport__case" id="vibe-case">
          <div
            className={`locker-case relative mx-auto h-44 w-36 ${crateOpen ? "locker-case--open" : ""} ${stakeDocked ? "locker-case--docked" : ""}`}
            aria-hidden
          >
            <div className="locker-case__glow" />
            <div className="locker-case__body">
              <div className="locker-case__stripe locker-case__stripe--1" />
              <div className="locker-case__stripe locker-case__stripe--2" />
              <div className="locker-case__stripe locker-case__stripe--3" />
              <div className="locker-case__lock" />
              {stakeDocked && (
                <span className="locker-case__docked-chip tabular-nums">{formatVibe(crateStake)}</span>
              )}
            </div>
            <div className="locker-case__lid">
              <div className="locker-case__lid-inner" />
            </div>
            {crateOpen && <div className="locker-case__burst" />}
          </div>

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
              {crateOpen ? "Case vibrating…" : stakeDocked ? "Tap OPEN CASE" : "Pick stake — chip docks on crate"}
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
                    isRec
                      ? "hypnotic-stake-chip--recommended border-amber-300/70 bg-amber-500/25 text-amber-50"
                      : isActive
                        ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                        : "border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-amber-400/30"
                  }`}
                >
                  {formatVibe(stake)}
                  {isRec && !stakeDocked && (
                    <span className="ml-1 text-[9px] text-amber-200/90">use winnings</span>
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
        </div>

        {/* Wheel layer */}
        <div className="hypnotic-morph-viewport__wheel" id="vibe-wheel">
          <div className="relative mx-auto w-fit">
            <div className="absolute -top-3 left-1/2 z-20 h-0 w-0 -translate-x-1/2 border-x-[10px] border-x-transparent border-t-[16px] border-t-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            <div
              className={`locker-wheel relative h-56 w-56 rounded-full border-[3px] border-white/20 shadow-[0_0_40px_rgba(139,92,246,0.45)] transition-transform ease-out ${
                wheelSpinning ? "duration-[5000ms]" : "duration-300"
              } ${wheelSpinning ? "hypnotic-wheel--spin-blur" : ""}`}
              style={{
                background: wheelGradient,
                transform: `rotate(${wheelRotation}deg)`,
              }}
            >
              {WHEEL_SEGMENTS.map((seg, i) => {
                const angle = i * segmentAngle + segmentAngle / 2;
                return (
                  <span
                    key={seg.label}
                    className="locker-wheel__label pointer-events-none absolute left-1/2 top-1/2 w-14 -translate-x-1/2 text-center text-[7px] font-bold uppercase leading-tight tracking-wide"
                    style={{
                      color: seg.text,
                      transform: `rotate(${angle}deg) translateY(-88px)`,
                      transformOrigin: "50% 88px",
                    }}
                  >
                    {seg.label.replace(" VIBE", "").replace(" JACKPOT", " JP")}
                  </span>
                );
              })}
              <div className="absolute inset-[22%] rounded-full border-2 border-white/15 bg-zinc-950/95 shadow-inner">
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-violet-200">
                  {wheelSpinning ? "…" : "Spin"}
                </div>
              </div>
            </div>
          </div>

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
                ? "Wheel slowing… trainer watches"
                : freeSpinAvailable
                  ? "1 tap — free daily spin, auto-cinema"
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
        </div>

        <div className="hypnotic-morph-viewport__sparks" aria-hidden />
      </div>
    </div>
  );
}

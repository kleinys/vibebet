"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { orbitModifierSummary } from "@/lib/orbit-affinity";

/** Must match `spin_locker_wheel` segment order in migration 202602306. */
export const WHEEL_SEGMENTS = [
  { label: "25 VIBE", color: "#6366f1", text: "#e0e7ff" },
  { label: "100 VIBE", color: "#ec4899", text: "#fce7f3" },
  { label: "50 VIBE", color: "#14b8a6", text: "#ccfbf1" },
  { label: "500 VIBE", color: "#f59e0b", text: "#fef3c7" },
  { label: "10 VIBE", color: "#8b5cf6", text: "#ede9fe" },
  { label: "250 VIBE", color: "#06b6d4", text: "#cffafe" },
  { label: "75 VIBE", color: "#22c55e", text: "#dcfce7" },
  { label: "1000 VIBE", color: "#ef4444", text: "#fee2e2" },
  { label: "15 VIBE", color: "#a855f7", text: "#f3e8ff" },
  { label: "200 VIBE", color: "#3b82f6", text: "#dbeafe" },
  { label: "30 VIBE", color: "#10b981", text: "#d1fae5" },
  { label: "2500 JACKPOT", color: "#fbbf24", text: "#451a03" },
] as const;

const CRATE_STAKES = [100, 250, 500, 1000] as const;
const PAID_SPIN_COST = 100;

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

export function CompanionLockerRewards({
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

  async function openCrate() {
    if (crateOpen || busy) return;
    setError(null);
    setBusy(true);
    setCrateOpen(true);
    setCrateResult(null);

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
        router.refresh();
      }, 1100);
    } catch (e) {
      setCrateOpen(false);
      setBusy(false);
      setError(parseError(e));
    }
  }

  function resetCrate() {
    setCrateOpen(false);
    setCrateResult(null);
    setError(null);
  }

  async function spinWheel() {
    if (wheelSpinning || busy) return;
    setError(null);
    setBusy(true);
    setWheelSpinning(true);
    setWheelResult(null);

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
        router.refresh();
      }, 3400);
    } catch (e) {
      setWheelSpinning(false);
      setBusy(false);
      setError(parseError(e));
    }
  }

  return (
    <section
      id="locker-rewards"
      className={`mt-4 scroll-mt-24 rounded-sm border border-white/10 bg-gradient-to-b p-4 ring-1 ring-white/5 ${
        modifier ? modifier.affinity.caseTheme : "from-zinc-950/80 to-zinc-950"
      }`}
    >
      {modifier && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-sm border border-violet-400/30 bg-violet-950/50 px-3 py-1.5 text-[11px] font-semibold text-violet-100">
            <span aria-hidden>{modifier.affinity.icon}</span>
            Active modifier: {modifier.morphLabel} — {modifier.affinity.shortLabel}
          </span>
          <span className="text-[10px] text-zinc-500">{modifier.affinity.crateEffect}</span>
          {modifier.synergy && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-emerald-500/25 bg-emerald-950/30 px-2 py-1 text-[10px] text-emerald-200">
              {modifier.synergy.label}: {modifier.synergy.effect}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Locker rewards
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Stake VIBE on crates and the wheel — real play-money payouts from your wallet.
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[10px] text-zinc-500">
            <li>Pick a case stake (100–1,000 VIBE) or spin the wheel (1 free/day, then 100 VIBE).</li>
            <li>VIBE is deducted instantly; payout lands in the same wallet.</li>
            <li>Check net profit on the result line — negative net means you lost the stake.</li>
          </ol>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-sm border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200">
          <CurrencyIconVibe className="h-4 w-4" />
          <span className="tabular-nums font-medium">{formatVibe(balance)} VIBE</span>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-sm border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* CS2-style case */}
        <div className={`rounded-sm border border-amber-500/25 bg-gradient-to-b p-4 ${modifier ? modifier.affinity.caseTheme : "from-amber-950/25 via-zinc-950 to-zinc-950"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            VIBE case
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Pay VIBE to open — weighted payout from common to legendary jackpot.
          </p>

          <div className="mt-4 flex flex-col items-center gap-4">
            <div
              className={`locker-case relative h-40 w-36 ${crateOpen ? "locker-case--open" : ""}`}
              aria-hidden
            >
              <div className="locker-case__glow" />
              <div className="locker-case__body">
                <div className="locker-case__stripe locker-case__stripe--1" />
                <div className="locker-case__stripe locker-case__stripe--2" />
                <div className="locker-case__stripe locker-case__stripe--3" />
                <div className="locker-case__lock" />
              </div>
              <div className="locker-case__lid">
                <div className="locker-case__lid-inner" />
              </div>
              {crateOpen && <div className="locker-case__burst" />}
            </div>

            {crateResult ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-amber-200">{crateResult.label}</p>
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
              <p className="text-[11px] text-zinc-500">
                {crateOpen ? "Opening case…" : "Choose stake, then crack it open"}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-1.5">
              {CRATE_STAKES.map((stake) => (
                <button
                  key={stake}
                  type="button"
                  disabled={busy || crateOpen}
                  onClick={() => setCrateStake(stake)}
                  className={`rounded-sm border px-2 py-1 text-[10px] font-semibold tabular-nums transition ${
                    crateStake === stake
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                      : "border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-amber-400/30"
                  }`}
                >
                  {formatVibe(stake)}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              {!crateResult ? (
                <button
                  type="button"
                  disabled={crateOpen || busy || balance < crateStake}
                  onClick={openCrate}
                  className={`${BTN} border-amber-400/45 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30`}
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
        </div>

        {/* Color wheel */}
        <div className={`rounded-sm border border-violet-500/25 bg-gradient-to-b p-4 ${modifier ? modifier.affinity.wheelTheme : "from-violet-950/30 to-zinc-950"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            VIBE wheel
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {freeSpinAvailable
              ? "First spin today is free — extra spins cost 100 VIBE."
              : `Extra spins cost ${PAID_SPIN_COST} VIBE each.`}
          </p>

          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute -top-3 left-1/2 z-20 h-0 w-0 -translate-x-1/2 border-x-[10px] border-x-transparent border-t-[16px] border-t-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <div
                className="locker-wheel relative h-56 w-56 rounded-full border-[3px] border-white/20 shadow-[0_0_40px_rgba(139,92,246,0.45)] transition-transform duration-[3400ms] ease-out"
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
                    Spin
                  </div>
                </div>
              </div>
            </div>

            {wheelResult ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-violet-100">Won: {wheelResult.label}</p>
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
              <p className="text-[11px] text-zinc-500">
                {wheelSpinning ? "Spinning…" : "12 segments · up to 2,500 VIBE jackpot"}
              </p>
            )}

            <button
              type="button"
              disabled={wheelSpinning || busy || (!freeSpinAvailable && balance < PAID_SPIN_COST)}
              onClick={spinWheel}
              className={`${BTN} border-violet-400/45 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`}
            >
              {wheelSpinning
                ? "Spinning…"
                : freeSpinAvailable
                  ? "Free daily spin"
                  : `Spin · ${PAID_SPIN_COST} VIBE`}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

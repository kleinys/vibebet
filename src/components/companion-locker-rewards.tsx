"use client";

import { useMemo, useState } from "react";

const CRATE_LOOT = [
  { label: "Aura Shard", tone: "text-fuchsia-300" },
  { label: "Gem Dust", tone: "text-violet-300" },
  { label: "Skin Fragment", tone: "text-amber-300" },
  { label: "Badge Core", tone: "text-teal-300" },
  { label: "Spirit Echo", tone: "text-indigo-300" },
];

const WHEEL_SEGMENTS = [
  "10 Gems",
  "Skin Shard",
  "25 Gems",
  "Badge Token",
  "50 Gems",
  "Mystery Skin",
  "5 Gems",
  "Jackpot Aura",
];

const BTN =
  "rounded-sm border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

export function CompanionLockerRewards() {
  const [crateOpen, setCrateOpen] = useState(false);
  const [crateLoot, setCrateLoot] = useState<(typeof CRATE_LOOT)[number] | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  const wheelGradient = useMemo(
    () =>
      `conic-gradient(${WHEEL_SEGMENTS.map(
        (_, i) =>
          `${i % 2 === 0 ? "rgba(139,92,246,0.55)" : "rgba(30,27,75,0.9)"} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`,
      ).join(", ")})`,
    [segmentAngle],
  );

  function openCrate() {
    if (crateOpen) return;
    setCrateOpen(true);
    setCrateLoot(null);
    window.setTimeout(() => {
      setCrateLoot(CRATE_LOOT[Math.floor(Math.random() * CRATE_LOOT.length)]!);
    }, 900);
  }

  function resetCrate() {
    setCrateOpen(false);
    setCrateLoot(null);
  }

  function spinWheel() {
    if (wheelSpinning) return;
    setWheelSpinning(true);
    setWheelResult(null);
    const targetIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const spins = 4 + Math.floor(Math.random() * 2);
    const nextRotation =
      wheelRotation +
      spins * 360 +
      (WHEEL_SEGMENTS.length - targetIndex) * segmentAngle -
      segmentAngle / 2;
    setWheelRotation(nextRotation);
    window.setTimeout(() => {
      setWheelResult(WHEEL_SEGMENTS[targetIndex]!);
      setWheelSpinning(false);
    }, 3200);
  }

  return (
    <section className="mt-4 rounded-lg border border-white/10 bg-zinc-950/80 p-4 ring-1 ring-white/5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Locker rewards
          </h3>
          <p className="mt-1 text-[11px] text-zinc-500">
            Mystery crates and daily spin — play-money rewards for now.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-fuchsia-500/20 bg-gradient-to-b from-fuchsia-950/30 to-zinc-950 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/90">
            Mystery crate
          </p>
          <div className="mt-3 flex flex-col items-center gap-3">
            <div
              className={`relative h-28 w-28 ${crateOpen ? "locker-crate-open" : ""}`}
              aria-hidden
            >
              <div className="absolute inset-x-2 bottom-0 top-8 rounded-sm border border-fuchsia-400/40 bg-gradient-to-b from-violet-900/80 to-fuchsia-950 shadow-[0_0_24px_rgba(168,85,247,0.25)]" />
              <div className="locker-crate-lid absolute inset-x-0 top-0 h-10 rounded-sm border border-fuchsia-300/50 bg-gradient-to-b from-fuchsia-400/40 to-violet-800/90" />
              <div className="absolute inset-x-6 top-[38%] h-1 rounded-sm bg-fuchsia-300/60" />
            </div>
            {crateLoot ? (
              <p className={`text-sm font-semibold ${crateLoot.tone}`}>{crateLoot.label}</p>
            ) : (
              <p className="text-[11px] text-zinc-500">
                {crateOpen ? "Unpacking…" : "Tap open to reveal loot"}
              </p>
            )}
            <div className="flex gap-2">
              {!crateLoot ? (
                <button
                  type="button"
                  disabled={crateOpen}
                  onClick={openCrate}
                  className={`${BTN} border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30`}
                >
                  {crateOpen ? "Opening…" : "Open crate · 50 gems"}
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

        <div className="rounded-sm border border-violet-500/20 bg-gradient-to-b from-violet-950/30 to-zinc-950 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Daily spin
          </p>
          <div className="mt-3 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[7px] border-x-transparent border-t-[12px] border-t-amber-300" />
              <div
                className="locker-wheel relative h-36 w-36 rounded-full border-2 border-violet-400/40 shadow-[0_0_28px_rgba(139,92,246,0.35)] transition-transform duration-[3200ms] ease-out"
                style={{
                  background: wheelGradient,
                  transform: `rotate(${wheelRotation}deg)`,
                }}
              >
                <div className="absolute inset-[28%] rounded-full border border-white/10 bg-zinc-950/90" />
              </div>
            </div>
            {wheelResult ? (
              <p className="text-sm font-semibold text-amber-200">Won: {wheelResult}</p>
            ) : (
              <p className="text-[11px] text-zinc-500">One free spin per day (demo)</p>
            )}
            <button
              type="button"
              disabled={wheelSpinning}
              onClick={spinWheel}
              className={`${BTN} border-violet-400/40 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30`}
            >
              {wheelSpinning ? "Spinning…" : "Spin wheel"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

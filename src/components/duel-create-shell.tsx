"use client";

import { useState, type ReactNode } from "react";
import { formatVibe } from "@/lib/utils";

const STAKE_MIN = 10;
const STAKE_MAX = 10000;
const STAKE_ANCHOR = 10000;

export function DuelCreateShell({
  gameTitle,
  accentClass,
  defaultStake = 100,
  children,
}: {
  gameTitle: string;
  accentClass: string;
  defaultStake?: number;
  children: ReactNode;
}) {
  const [stake, setStake] = useState(defaultStake);
  const clamped = Math.min(STAKE_MAX, Math.max(STAKE_MIN, stake || STAKE_MIN));
  const sliderPct = ((clamped - STAKE_MIN) / (STAKE_MAX - STAKE_MIN)) * 100;

  return (
    <div className={`rounded-xl border p-5 ${accentClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
            You
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            VS
          </span>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
            ?
          </div>
        </div>
        <p className="text-right text-[10px] uppercase tracking-wider text-zinc-500">
          {gameTitle}
        </p>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="text-xs text-zinc-400">
            Stake (VIBE)
            <input
              name="stake"
              type="number"
              min={STAKE_MIN}
              max={STAKE_MAX}
              value={clamped}
              onChange={(e) => setStake(parseInt(e.target.value, 10) || STAKE_MIN)}
              className="mt-1 w-28 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm tabular-nums"
            />
          </label>
          <p className="text-xs text-rose-300/90">
            Risk: lose {formatVibe(clamped)} VIBE if defeated
          </p>
        </div>

        <div className="relative mt-3">
          <input
            type="range"
            min={STAKE_MIN}
            max={STAKE_MAX}
            step={10}
            value={clamped}
            onChange={(e) => setStake(parseInt(e.target.value, 10))}
            className="duel-stake-slider w-full"
            style={
              {
                "--slider-pct": `${sliderPct}%`,
              } as React.CSSProperties
            }
            aria-label="Stake amount"
          />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
            <span>{STAKE_MIN}</span>
            <span className="text-zinc-500">{formatVibe(STAKE_ANCHOR)} max</span>
          </div>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

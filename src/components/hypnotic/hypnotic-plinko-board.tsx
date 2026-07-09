"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { formatVibe } from "@/lib/utils";
import {
  PLINKO_MULTIPLIERS,
  PLINKO_ROW_COUNT,
  PLINKO_STAKE_PRESETS,
  clampPlinkoStake,
  drawPlinkoBoard,
  type PlinkoRisk,
} from "@/lib/plinko-board";

const BTN =
  "rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

export function HypnoticPlinkoBoard({
  balance,
  variant = "panel",
}: {
  balance: number;
  variant?: "panel" | "cinema";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");

  const clampedStake = useMemo(() => clampPlinkoStake(stake), [stake]);
  const isCinema = variant === "cinema";

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function paint() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawPlinkoBoard(ctx, width, height);
    }

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [variant]);

  return (
    <div
      className={`hypnotic-plinko-board w-full ${isCinema ? "hypnotic-plinko-board--cinema" : ""}`}
    >
      <div className="hypnotic-plinko-board__layout">
        <div ref={wrapRef} className="hypnotic-plinko-board__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="hypnotic-plinko-board__canvas"
            aria-label="Plinko board with peg triangle and multiplier slots"
          />
        </div>

        <div className="hypnotic-plinko-board__controls space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
              Stake (VIBE)
            </p>
            <div className="mt-2 flex items-center gap-2">
              <CurrencyIconVibe className="h-4 w-4 shrink-0 text-amber-300" />
              <input
                type="number"
                min={10}
                max={5000}
                step={10}
                value={clampedStake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm font-semibold tabular-nums text-zinc-100 outline-none focus:border-violet-400/50"
              />
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Balance: {formatVibe(balance)} VIBE
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
              Risk
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["low", "medium", "high"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setRisk(level)}
                  className={`${BTN} ${
                    risk === level
                      ? "border-violet-400/50 bg-violet-500/25 text-violet-100"
                      : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
              Quick stakes
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLINKO_STAKE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={balance < preset}
                  onClick={() => setStake(preset)}
                  className={`${BTN} min-w-[3rem] tabular-nums ${
                    clampedStake === preset
                      ? "border-amber-400/45 bg-amber-500/20 text-amber-100"
                      : "border-white/10 bg-black/30 text-zinc-300 hover:border-white/20"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled
            className={`${BTN} w-full border-violet-400/35 bg-violet-500/15 py-2.5 text-violet-200`}
            title="Ball drop coming soon"
          >
            Drop ball — coming soon
          </button>

          {!isCinema && (
            <p className="text-center text-[10px] leading-relaxed text-zinc-500">
              {PLINKO_ROW_COUNT}-row pyramid · {PLINKO_MULTIPLIERS.length} slots · {risk} risk
              shown. Physics and payouts are not wired yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

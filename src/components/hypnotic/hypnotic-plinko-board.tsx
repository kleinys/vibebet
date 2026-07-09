"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { formatVibe } from "@/lib/utils";
import {
  PLINKO_ROW_COUNT,
  PLINKO_STAKE_PRESETS,
  clampPlinkoStake,
  drawPlinkoBoard,
  type PlinkoRisk,
} from "@/lib/plinko-board";

const BTN =
  "rounded-sm border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

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
      drawPlinkoBoard(ctx, width, height, risk);
    }

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [variant, risk]);

  function adjustStake(delta: number) {
    setStake((prev) => clampPlinkoStake(prev + delta));
  }

  return (
    <div
      className={`hypnotic-plinko-board w-full ${isCinema ? "hypnotic-plinko-board--cinema" : ""}`}
    >
      <div ref={wrapRef} className="hypnotic-plinko-board__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="hypnotic-plinko-board__canvas"
          aria-label="Plinko board with peg triangle and multiplier slots"
        />
      </div>

      <div className="hypnotic-plinko-board__controls">
        <div className="hypnotic-plinko-board__control">
          <span className="hypnotic-plinko-board__label">Bet (VIBE)</span>
          <div className="hypnotic-plinko-board__stepper">
            <button type="button" onClick={() => adjustStake(-10)} aria-label="Decrease bet">
              −
            </button>
            <div className="hypnotic-plinko-board__bet-value">
              <CurrencyIconVibe className="h-3.5 w-3.5 text-amber-300" />
              <span className="tabular-nums">{formatVibe(clampedStake)}</span>
            </div>
            <button type="button" onClick={() => adjustStake(10)} aria-label="Increase bet">
              +
            </button>
          </div>
        </div>

        <div className="hypnotic-plinko-board__control">
          <span className="hypnotic-plinko-board__label">Rows</span>
          <div className="hypnotic-plinko-board__static-value">{PLINKO_ROW_COUNT}</div>
        </div>

        <div className="hypnotic-plinko-board__control">
          <span className="hypnotic-plinko-board__label">Risk</span>
          <div className="hypnotic-plinko-board__risk-toggle">
            {(["low", "medium", "high"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setRisk(level)}
                className={risk === level ? "is-active" : ""}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="hypnotic-plinko-board__bet-cta"
          title="Ball drop coming soon"
        >
          Bet — coming soon
        </button>
      </div>

      <div className="hypnotic-plinko-board__quick-row">
        {PLINKO_STAKE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={balance < preset}
            onClick={() => setStake(preset)}
            className={`${BTN} tabular-nums ${
              clampedStake === preset
                ? "border-amber-400/45 bg-amber-500/20 text-amber-100"
                : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20"
            }`}
          >
            {preset}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-zinc-500 tabular-nums">
          Balance {formatVibe(balance)}
        </span>
      </div>
    </div>
  );
}

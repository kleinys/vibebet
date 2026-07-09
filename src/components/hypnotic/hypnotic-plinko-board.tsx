"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { formatVibe } from "@/lib/utils";
import {
  PLINKO_ROW_COUNT,
  PLINKO_STAKE_PRESETS,
  clampPlinkoStake,
  computePlinkoLayout,
  drawPlinkoBoard,
  type PlinkoBallState,
  type PlinkoBoardLayout,
  type PlinkoRisk,
} from "@/lib/plinko-board";
import { pathForSlot, waypointsForPath } from "@/lib/plinko-path";

const BTN =
  "rounded-sm border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

const DROP_MS = 2800;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function pointAlongWaypoints(
  waypoints: { x: number; y: number }[],
  progress: number,
): { x: number; y: number } {
  if (waypoints.length <= 1) return waypoints[0] ?? { x: 0, y: 0 };
  const segments = waypoints.length - 1;
  const scaled = progress * segments;
  const idx = Math.min(Math.floor(scaled), segments - 1);
  const localT = easeOutCubic(scaled - idx);
  const a = waypoints[idx];
  const b = waypoints[idx + 1];
  return {
    x: a.x + (b.x - a.x) * localT,
    y: a.y + (b.y - a.y) * localT,
  };
}

export type PlinkoPlayResult = {
  slotIndex: number;
  multiplier: number;
  payout: number;
  net: number;
  newBalance: number;
};

export function HypnoticPlinkoBoard({
  balance,
  onBalanceChange,
  onExit,
  variant = "panel",
}: {
  balance: number;
  onBalanceChange?: (balance: number) => void;
  onExit?: () => void;
  variant?: "panel" | "cinema";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<PlinkoBoardLayout | null>(null);
  const rafRef = useRef<number | null>(null);

  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [dropping, setDropping] = useState(false);
  const [ball, setBall] = useState<PlinkoBallState | null>(null);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<PlinkoPlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clampedStake = useMemo(() => clampPlinkoStake(stake), [stake]);
  const isCinema = variant === "cinema";
  const controlsLocked = dropping;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const layout = computePlinkoLayout(width, height);
    layoutRef.current = layout;
    drawPlinkoBoard(ctx, layout, risk, ball, highlightSlot);
  }, [risk, ball, highlightSlot]);

  useEffect(() => {
    paint();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(paint);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint, variant]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  async function dropBall() {
    if (dropping || balance < clampedStake) return;

    setDropping(true);
    setLastResult(null);
    setHighlightSlot(null);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("play_plinko", {
        p_stake: clampedStake,
        p_risk: risk,
      });
      if (rpcError) throw rpcError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No plinko result returned");

      const result: PlinkoPlayResult = {
        slotIndex: Number(row.slot_index),
        multiplier: Number(row.multiplier),
        payout: Number(row.payout),
        net: Number(row.net),
        newBalance: Number(row.new_balance),
      };

      const layout = layoutRef.current ?? computePlinkoLayout(
        canvasRef.current?.clientWidth ?? 400,
        canvasRef.current?.clientHeight ?? 340,
      );

      const path = pathForSlot(result.slotIndex, PLINKO_ROW_COUNT, layout.startCol);
      const waypoints = waypointsForPath(path, layout, result.slotIndex);
      const ballRadius = Math.max(5, layout.pegRadius * 1.6);
      const started = performance.now();

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const progress = Math.min(1, (now - started) / DROP_MS);
          const pos = pointAlongWaypoints(waypoints, progress);
          setBall({ x: pos.x, y: pos.y, radius: ballRadius });

          if (progress < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            setHighlightSlot(result.slotIndex);
            resolve();
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });

      onBalanceChange?.(result.newBalance);
      setLastResult(result);

      const netLabel =
        result.net >= 0
          ? `+${formatVibe(result.net)} VIBE`
          : `${formatVibe(result.net)} VIBE`;
      toast.success(
        `Landed ${result.multiplier}× · ${formatVibe(result.payout)} VIBE (${netLabel})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Plinko bet failed";
      setError(message);
      toast.error(message);
      setBall(null);
    } finally {
      setDropping(false);
    }
  }

  function adjustStake(delta: number) {
    if (controlsLocked) return;
    setStake((prev) => clampPlinkoStake(prev + delta));
  }

  return (
    <div
      className={`hypnotic-plinko-board w-full ${isCinema ? "hypnotic-plinko-board--cinema" : ""}`}
    >
      {isCinema && onExit && (
        <button type="button" className="hypnotic-plinko-board__back" onClick={onExit}>
          ← Back to arena
        </button>
      )}
      <div ref={wrapRef} className="hypnotic-plinko-board__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="hypnotic-plinko-board__canvas"
          aria-label="Plinko board with peg triangle and multiplier slots"
        />
      </div>

      {error && (
        <p className="rounded-sm border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
          {error}
        </p>
      )}

      {lastResult && !dropping && (
        <p className="text-center text-[11px] text-zinc-400">
          Last drop:{" "}
          <span className="font-semibold text-violet-200">{lastResult.multiplier}×</span>
          {" · "}
          Payout{" "}
          <span className={lastResult.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
            {lastResult.net >= 0 ? "+" : ""}
            {formatVibe(lastResult.net)} VIBE
          </span>
        </p>
      )}

      <div className="hypnotic-plinko-board__controls">
        <div className="hypnotic-plinko-board__control">
          <span className="hypnotic-plinko-board__label">Bet (VIBE)</span>
          <div className="hypnotic-plinko-board__stepper">
            <button
              type="button"
              disabled={controlsLocked}
              onClick={() => adjustStake(-10)}
              aria-label="Decrease bet"
            >
              −
            </button>
            <div className="hypnotic-plinko-board__bet-value">
              <CurrencyIconVibe className="h-3.5 w-3.5 text-amber-300" />
              <span className="tabular-nums">{formatVibe(clampedStake)}</span>
            </div>
            <button
              type="button"
              disabled={controlsLocked}
              onClick={() => adjustStake(10)}
              aria-label="Increase bet"
            >
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
                disabled={controlsLocked}
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
          disabled={controlsLocked || balance < clampedStake}
          onClick={() => void dropBall()}
          className="hypnotic-plinko-board__bet-cta"
        >
          {dropping ? "Dropping…" : "Bet"}
        </button>
      </div>

      <div className="hypnotic-plinko-board__quick-row">
        {PLINKO_STAKE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={controlsLocked || balance < preset}
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

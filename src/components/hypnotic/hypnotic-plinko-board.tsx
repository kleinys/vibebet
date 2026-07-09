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
import {
  pathForSlot,
  pointAlongWaypoints,
  type PlinkoWaypoint,
  waypointsForPath,
} from "@/lib/plinko-path";

const BTN =
  "rounded-sm border px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

const DROP_MS = 5200;
const MAX_ACTIVE_BALLS = 24;

export type PlinkoPlayResult = {
  slotIndex: number;
  multiplier: number;
  payout: number;
  net: number;
  newBalance: number;
};

type ActivePlinkoBall = {
  id: number;
  waypoints: PlinkoWaypoint[];
  startedAt: number;
  ballRadius: number;
  targetSlot: number;
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
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const animLoopRef = useRef(false);
  const nextBallIdRef = useRef(0);
  const activeBallsRef = useRef<ActivePlinkoBall[]>([]);
  const riskRef = useRef<PlinkoRisk>("medium");
  const balanceRef = useRef(balance);
  const pendingRpcRef = useRef(0);

  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [pendingRpc, setPendingRpc] = useState(0);
  const [activeDrops, setActiveDrops] = useState(0);
  const [lastResult, setLastResult] = useState<PlinkoPlayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clampedStake = useMemo(() => clampPlinkoStake(stake), [stake]);
  const isCinema = variant === "cinema";
  const queueCount = pendingRpc + activeDrops;

  riskRef.current = risk;

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  const paintFrame = useCallback(() => {
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
    const now = performance.now();

    const ballsOnCanvas: PlinkoBallState[] = [];
    const highlightSlots: number[] = [];

    for (const ball of activeBallsRef.current) {
      const progress = Math.min(1, (now - ball.startedAt) / DROP_MS);
      const pos = pointAlongWaypoints(ball.waypoints, progress);
      ballsOnCanvas.push({ x: pos.x, y: pos.y, radius: ball.ballRadius });
      if (progress >= 0.98) highlightSlots.push(ball.targetSlot);
    }

    drawPlinkoBoard(ctx, layout, riskRef.current, ballsOnCanvas, highlightSlots);
  }, []);

  const ensureAnimLoop = useCallback(() => {
    if (animLoopRef.current || !mountedRef.current) return;
    animLoopRef.current = true;

    const tick = (now: number) => {
      if (!mountedRef.current) {
        animLoopRef.current = false;
        return;
      }

      activeBallsRef.current = activeBallsRef.current.filter(
        (ball) => (now - ball.startedAt) / DROP_MS < 1,
      );
      setActiveDrops(activeBallsRef.current.length);
      paintFrame();

      if (activeBallsRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        animLoopRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [paintFrame]);

  useEffect(() => {
    paintFrame();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paintFrame());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paintFrame, variant, risk]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function snapshotLayout(): PlinkoBoardLayout {
    const canvas = canvasRef.current;
    const width = canvas?.clientWidth ?? 400;
    const height = canvas?.clientHeight ?? 340;
    return computePlinkoLayout(width, height);
  }

  async function runDrop(stakeAmount: number, riskLevel: PlinkoRisk) {
    pendingRpcRef.current += 1;
    setPendingRpc(pendingRpcRef.current);

    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("play_plinko", {
        p_stake: stakeAmount,
        p_risk: riskLevel,
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

      if (!mountedRef.current) return;

      const layout = snapshotLayout();
      const path = pathForSlot(result.slotIndex, PLINKO_ROW_COUNT);
      const waypoints = waypointsForPath(path, layout, result.slotIndex);
      const ballRadius = Math.max(5, layout.pegRadius * 1.6);
      const spawnJitter = ((activeBallsRef.current.length % 7) - 3) * 2.5;
      const adjustedWaypoints =
        spawnJitter === 0
          ? waypoints
          : waypoints.map((point, index) =>
              index === 0 ? { ...point, x: point.x + spawnJitter } : point,
            );

      activeBallsRef.current.push({
        id: nextBallIdRef.current++,
        waypoints: adjustedWaypoints,
        startedAt: performance.now(),
        ballRadius,
        targetSlot: result.slotIndex,
      });
      if (activeBallsRef.current.length > MAX_ACTIVE_BALLS) {
        activeBallsRef.current = activeBallsRef.current.slice(-MAX_ACTIVE_BALLS);
      }
      setActiveDrops(activeBallsRef.current.length);

      balanceRef.current = result.newBalance;
      onBalanceChange?.(result.newBalance);
      setLastResult(result);
      ensureAnimLoop();

      if (pendingRpcRef.current <= 1 && activeBallsRef.current.length <= 1) {
        const netLabel =
          result.net >= 0
            ? `+${formatVibe(result.net)} VIBE`
            : `${formatVibe(result.net)} VIBE`;
        toast.success(
          `Landed ${result.multiplier}× · ${formatVibe(result.payout)} VIBE (${netLabel})`,
        );
      }
    } catch (err) {
      if (!mountedRef.current) return;
      balanceRef.current += stakeAmount;
      onBalanceChange?.(balanceRef.current);
      const message = err instanceof Error ? err.message : "Plinko bet failed";
      setError(message);
      toast.error(message);
      paintFrame();
    } finally {
      pendingRpcRef.current = Math.max(0, pendingRpcRef.current - 1);
      setPendingRpc(pendingRpcRef.current);
    }
  }

  function dropBall() {
    const stakeAmount = clampPlinkoStake(stake);
    const riskLevel = riskRef.current;
    if (balanceRef.current < stakeAmount) return;

    balanceRef.current -= stakeAmount;
    onBalanceChange?.(balanceRef.current);
    setError(null);
    void runDrop(stakeAmount, riskLevel);
  }

  function adjustStake(delta: number) {
    setStake((prev) => clampPlinkoStake(prev + delta));
  }

  const queueLabel = queueCount > 0 ? `${queueCount} dropping` : null;

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
          tabIndex={0}
          aria-label="Plinko board with peg triangle and multiplier slots"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              dropBall();
            }
          }}
        />
      </div>

      {error && (
        <p className="rounded-sm border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
          {error}
        </p>
      )}

      {lastResult && (
        <p className="text-center text-[11px] text-zinc-400">
          Last drop:{" "}
          <span className="font-semibold text-violet-200">{lastResult.multiplier}×</span>
          {" · "}
          Payout{" "}
          <span className={lastResult.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
            {lastResult.net >= 0 ? "+" : ""}
            {formatVibe(lastResult.net)} VIBE
          </span>
          {queueLabel && (
            <span className="text-zinc-500"> · {queueLabel}</span>
          )}
        </p>
      )}

      <div className="hypnotic-plinko-board__controls">
        <div className="hypnotic-plinko-board__control">
          <span className="hypnotic-plinko-board__label">Bet (VIBE)</span>
          <div className="hypnotic-plinko-board__stepper">
            <button
              type="button"
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
          disabled={balance < clampedStake}
          onClick={dropBall}
          className="hypnotic-plinko-board__bet-cta"
        >
          Bet{queueCount > 0 ? ` · ${queueCount} live` : ""}
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
                : "border-white/10 bg-black/30 text-zinc-400 hover:border-white/20 disabled:hover:border-white/10"
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

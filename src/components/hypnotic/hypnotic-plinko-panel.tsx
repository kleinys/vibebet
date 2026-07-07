"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { playPlinko } from "@/app/games/arcade/actions";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import {
  buildPlinkoDropPath,
  buildPlinkoPegs,
  formatPlinkoMultiplier,
  plinkoSlotsForRisk,
  samplePlinkoPath,
  type PlinkoPoint,
  type PlinkoRisk,
} from "@/lib/plinko-board";
import { formatVibe } from "@/lib/utils";

const DROP_DURATION_MS = 3200;
const PEGS = buildPlinkoPegs();

type Ball = {
  id: number;
  path: PlinkoPoint[];
  startTime: number;
  targetSlot: number;
  active: boolean;
  x: number;
  y: number;
};

export function HypnoticPlinkoPanel({ balance }: { balance?: number }) {
  const [pending, startTransition] = useTransition();
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [balls, setBalls] = useState<Ball[]>([]);
  const [ballId, setBallId] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const ballsRef = useRef<Ball[]>([]);
  const rafRef = useRef<number>(0);
  const pendingResultRef = useRef<{ slot: number; message: string } | null>(null);

  const slots = useMemo(() => plinkoSlotsForRisk(risk), [risk]);

  const clampedStake = useMemo(() => {
    const n = Number(stake);
    if (!Number.isFinite(n)) return 50;
    return Math.max(10, Math.min(5000, Math.floor(n)));
  }, [stake]);

  const syncBalls = useCallback((next: Ball[]) => {
    ballsRef.current = next;
    setBalls(next);
  }, []);

  const finishDrop = useCallback(() => {
    const pendingResult = pendingResultRef.current;
    if (pendingResult) {
      setLastSlot(pendingResult.slot);
      setLastMessage(pendingResult.message);
      toast.success(pendingResult.message);
      pendingResultRef.current = null;
    }
    setAnimating(false);
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      const current = ballsRef.current;
      let anyActive = false;

      const next = current.map((ball) => {
        if (!ball.active) return ball;

        const elapsed = now - ball.startTime;
        const progress = elapsed / DROP_DURATION_MS;

        if (progress >= 1) {
          const end = ball.path[ball.path.length - 1];
          return {
            ...ball,
            active: false,
            x: end?.x ?? ball.x,
            y: end?.y ?? ball.y,
          };
        }

        const pos = samplePlinkoPath(ball.path, progress);
        anyActive = true;
        return { ...ball, x: pos.x, y: pos.y };
      });

      if (next !== current) {
        ballsRef.current = next;
        setBalls(next);
      }

      if (!anyActive && current.some((b) => b.active)) {
        finishDrop();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [finishDrop]);

  function adjustStake(mult: number) {
    setStake((s) => {
      const n = Math.floor(Number(s) || 50);
      return Math.max(10, Math.min(5000, Math.floor(n * mult)));
    });
  }

  function sendBall() {
    if (animating || pending) return;
    if (balance != null && balance < clampedStake) {
      toast.error(`Need ${formatVibe(clampedStake)} VIBE.`);
      return;
    }

    setLastMessage(null);
    setLastSlot(null);
    pendingResultRef.current = null;

    startTransition(async () => {
      const result = await playPlinko(clampedStake, risk);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const slot = result.slot ?? 5;
      const message = result.ok ?? "Ball dropped!";
      pendingResultRef.current = { slot, message };

      const id = ballId;
      const path = buildPlinkoDropPath(slot);
      setAnimating(true);
      syncBalls([
        ...ballsRef.current.filter((b) => b.active),
        {
          id,
          path,
          startTime: performance.now(),
          targetSlot: slot,
          active: true,
          x: 50,
          y: 3,
        },
      ]);
      setBallId((n) => n + 1);
    });
  }

  const buttonLabel = pending
    ? "Sending…"
    : animating
      ? "Dropping…"
      : "Send Ball";

  return (
    <div className="hypnotic-plinko-panel w-full">
      <div className="hypnotic-plinko-panel__layout">
        <div className="hypnotic-plinko-panel__board-wrap">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200/80">
              Plinko · Ball Falling
            </span>
            {balance != null && (
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-amber-200">
                <CurrencyIconVibe className="h-3.5 w-3.5" />
                {formatVibe(balance)}
              </span>
            )}
          </div>

          <div className="hypnotic-plinko-panel__board hypnotic-plinko-panel__board--pyramid">
            <div
              className="pointer-events-none absolute inset-0 opacity-35"
              style={{
                background:
                  "radial-gradient(ellipse 65% 45% at 50% 88%, rgba(34,211,238,0.18), transparent 72%)",
              }}
            />

            {PEGS.map((peg) => (
              <div
                key={`${peg.row}-${peg.col}`}
                className="hypnotic-plinko-panel__peg"
                style={{
                  left: `${peg.x}%`,
                  top: `${peg.y}%`,
                }}
              />
            ))}

            {balls.map((ball) => (
              <div
                key={ball.id}
                className={`hypnotic-plinko-panel__ball ${ball.active ? "hypnotic-plinko-panel__ball--active" : ""}`}
                style={{
                  left: `${ball.x}%`,
                  top: `${ball.y}%`,
                }}
              />
            ))}

            <div className="hypnotic-plinko-panel__slots">
              {slots.map((slot, index) => (
                <div
                  key={`${risk}-${index}`}
                  className={`hypnotic-plinko-panel__slot ${
                    lastSlot === index
                      ? `${slot.color} ${slot.glow} hypnotic-plinko-panel__slot--hit`
                      : ""
                  }`}
                >
                  {formatPlinkoMultiplier(slot.multiplier)}
                </div>
              ))}
            </div>

            {lastMessage && !animating && (
              <div className="absolute left-1/2 top-2 max-w-[92%] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-black/70 px-3 py-1.5 text-center text-[10px] font-medium text-emerald-200">
                {lastMessage}
              </div>
            )}
          </div>
        </div>

        <div className="hypnotic-plinko-panel__controls">
          <p className="text-center text-sm font-bold text-sky-200">Plinko Ball Falling</p>

          <div className="mt-4">
            <label className="text-[11px] font-semibold text-zinc-300">Ball Price</label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-2">
                <CurrencyIconVibe className="h-4 w-4 shrink-0" />
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  className="w-full bg-transparent text-sm font-bold tabular-nums text-white outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => adjustStake(0.5)}
                className="rounded-lg border border-rose-500/40 bg-rose-600/80 px-2.5 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                ½
              </button>
              <button
                type="button"
                onClick={() => adjustStake(2)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-600/80 px-2.5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                2×
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[11px] font-semibold text-zinc-300">Risk</label>
            <div className="mt-1.5 grid grid-cols-3 overflow-hidden rounded-lg border border-white/10">
              {(["low", "medium", "high"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  className={`py-2.5 text-xs font-bold capitalize transition ${
                    risk === r
                      ? r === "low"
                        ? "bg-emerald-500 text-white"
                        : r === "medium"
                          ? "bg-amber-400 text-zinc-900"
                          : "bg-rose-500 text-white"
                      : "bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-500">
              {risk === "low"
                ? "Safer curve — edges up to 3×, center 0.5×"
                : risk === "high"
                  ? "Volatile — edges 10×, center 0.1×"
                  : "Classic — edges 5×, center 0.1×"}
            </p>
          </div>

          <button
            type="button"
            disabled={pending || animating}
            onClick={sendBall}
            className="mt-5 w-full rounded-xl border border-emerald-400/50 bg-gradient-to-b from-lime-400 to-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_4px_0_rgba(21,128,61,0.8)] transition hover:brightness-110 disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

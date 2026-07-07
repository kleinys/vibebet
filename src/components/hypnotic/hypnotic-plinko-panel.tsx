"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { playPlinko } from "@/app/games/arcade/actions";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { formatVibe } from "@/lib/utils";

const PLINKO_SLOTS = [
  { multiplier: 0.2, color: "bg-rose-600", glow: "shadow-rose-500/50" },
  { multiplier: 0.5, color: "bg-orange-500", glow: "shadow-orange-500/50" },
  { multiplier: 1, color: "bg-amber-500", glow: "shadow-amber-500/50" },
  { multiplier: 1.5, color: "bg-lime-500", glow: "shadow-lime-500/50" },
  { multiplier: 3, color: "bg-emerald-400", glow: "shadow-emerald-400/60" },
  { multiplier: 1.5, color: "bg-lime-500", glow: "shadow-lime-500/50" },
  { multiplier: 1, color: "bg-amber-500", glow: "shadow-amber-500/50" },
  { multiplier: 0.5, color: "bg-orange-500", glow: "shadow-orange-500/50" },
  { multiplier: 0.2, color: "bg-rose-600", glow: "shadow-rose-500/50" },
] as const;

const MIN_FALL_MS = 1800;

type Risk = "low" | "medium" | "high";

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  targetSlot: number;
  startedAt: number;
};

function slotCenterX(slot: number) {
  const w = 100 / PLINKO_SLOTS.length;
  return w * slot + w / 2;
}

/**
 * Generate peg positions for a pyramid:
 * row 0: 1 peg, row 1: 2 pegs, ... row 7: 8 pegs.
 * Pegs are centered horizontally with 4% margins.
 */
function getPegPositions() {
  const rows = 8;
  const leftMargin = 4;
  const rightMargin = 4;
  const usableWidth = 100 - leftMargin - rightMargin;
  const positions: { x: number; y: number; row: number; col: number }[] = [];

  for (let row = 0; row < rows; row++) {
    const numPegs = row + 1;
    const y = 12 + row * 8; // same vertical spacing as before
    if (numPegs === 1) {
      positions.push({ x: 50, y, row, col: 0 });
    } else {
      const spacing = usableWidth / (numPegs - 1);
      for (let col = 0; col < numPegs; col++) {
        const x = leftMargin + col * spacing;
        positions.push({ x, y, row, col });
      }
    }
  }
  return positions;
}

const PEG_POSITIONS = getPegPositions();

export function HypnoticPlinkoPanel() {
  const [pending, startTransition] = useTransition();
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<Risk>("medium");
  const [balls, setBalls] = useState<Ball[]>([]);
  const [ballId, setBallId] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const ballsRef = useRef<Ball[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const pendingResultRef = useRef<{ slot: number; message: string } | null>(null);

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
      if (!current.some((b) => b.active)) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(32, now - lastTimeRef.current);
      lastTimeRef.current = now;

      let anyActive = false;
      const next = current.map((ball) => {
        if (!ball.active) return ball;

        const elapsed = now - ball.startedAt;
        // Weaker steering to allow more natural bouncing
        const steerStrength = elapsed < MIN_FALL_MS * 0.55 ? 0.0004 : 0.002;

        let vx = ball.vx;
        let vy = ball.vy + 0.045 * (dt / 16);
        let x = ball.x + vx * (dt / 16);
        let y = ball.y + vy * (dt / 16);

        // Wall collisions
        if (x < 2) {
          x = 2;
          vx = Math.abs(vx) * 0.8;
        } else if (x > 98) {
          x = 98;
          vx = -Math.abs(vx) * 0.8;
        }

        // Pyramid peg collisions
        const pegRadius = 2.4; // radius for collision
        for (const peg of PEG_POSITIONS) {
          const dx = x - peg.x;
          const dy = y - peg.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < pegRadius) {
            // Push ball away from peg center
            const angle = Math.atan2(dy, dx);
            const overlap = pegRadius - dist;
            x += Math.cos(angle) * overlap * 1.2;
            y += Math.sin(angle) * overlap * 1.2;

            // Reflect velocity with some randomness
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > 0.1) {
              // Normalize direction from peg to ball
              const nx = Math.cos(angle);
              const ny = Math.sin(angle);
              // Dot product of velocity with normal
              const vn = vx * nx + vy * ny;
              if (vn < 0) {
                // Reflect and add randomness
                const restitution = 0.6 + Math.random() * 0.2;
                vx -= (1 + restitution) * vn * nx;
                vy -= (1 + restitution) * vn * ny;
                // Add small random deflection
                vx += (Math.random() - 0.5) * 0.3;
                vy += (Math.random() - 0.5) * 0.1;
                // Clamp to prevent explosion
                const newSpeed = Math.sqrt(vx * vx + vy * vy);
                if (newSpeed > 12) {
                  vx = (vx / newSpeed) * 12;
                  vy = (vy / newSpeed) * 12;
                }
              }
            }
            break; // only one peg collision per frame
          }
        }

        // Gentle steering toward target slot (only horizontal)
        const targetX = slotCenterX(ball.targetSlot);
        vx += (targetX - x) * steerStrength;

        const canLand = elapsed >= MIN_FALL_MS && y >= 74;
        if (canLand) {
          // Snap to target slot center and stop
          return {
            ...ball,
            x: targetX,
            y: 82,
            vx: 0,
            vy: 0,
            active: false,
          };
        }

        anyActive = true;
        return { ...ball, x, y, vx, vy };
      });

      ballsRef.current = next;
      setBalls(next);

      if (!anyActive && current.some((b) => b.active)) {
        finishDrop();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
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

    setLastMessage(null);
    setLastSlot(null);
    pendingResultRef.current = null;
    setAnimating(true);
    lastTimeRef.current = null;

    const id = ballId;
    const startedAt = performance.now();
    syncBalls([
      ...ballsRef.current.filter((b) => b.active),
      {
        id,
        x: 50,
        y: 4,
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.2,
        active: true,
        targetSlot: 4,
        startedAt,
      },
    ]);
    setBallId((n) => n + 1);

    startTransition(async () => {
      const result = await playPlinko(clampedStake, risk);
      if (result.error) {
        syncBalls(ballsRef.current.filter((b) => b.id !== id));
        setAnimating(false);
        toast.error(result.error);
        return;
      }

      const slot = result.slot ?? 4;
      const message = result.ok ?? "Ball dropped!";
      pendingResultRef.current = { slot, message };

      syncBalls(
        ballsRef.current.map((b) =>
          b.id === id ? { ...b, targetSlot: slot } : b,
        ),
      );
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
          </div>

          <div className="hypnotic-plinko-panel__board">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(34,211,238,0.15), transparent 70%)",
              }}
            />

            {/* Render pyramid pegs */}
            {PEG_POSITIONS.map((peg, idx) => (
              <div
                key={idx}
                className="absolute h-2 w-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                style={{
                  left: `${peg.x}%`,
                  top: `${peg.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}

            {balls.map((ball) => (
              <div
                key={ball.id}
                className={`absolute h-3.5 w-3.5 rounded-full bg-gradient-to-br from-lime-300 to-emerald-500 shadow-[0_0_12px_rgba(74,222,128,0.8)] transition-opacity ${ball.active ? "opacity-100" : "opacity-95"}`}
                style={{
                  left: `${ball.x}%`,
                  top: `${ball.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                  willChange: ball.active ? "left, top" : undefined,
                }}
              />
            ))}

            <div className="absolute bottom-0 left-0 right-0 flex h-14 gap-0.5 px-1 pb-1">
              {PLINKO_SLOTS.map((slot, index) => (
                <div
                  key={index}
                  className={`flex flex-1 items-end justify-center rounded-sm border border-black/30 pb-1 text-[9px] font-bold text-white transition-all duration-300 ${
                    lastSlot === index
                      ? `${slot.color} ${slot.glow} scale-105 shadow-lg`
                      : "bg-zinc-800/90"
                  }`}
                >
                  {slot.multiplier}x
                </div>
              ))}
            </div>

            {lastMessage && !animating && (
              <div className="absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-black/60 px-3 py-1.5 text-center text-[10px] font-medium text-emerald-200">
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
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type Risk = "low" | "medium" | "high";

type Ball = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  targetSlot: number;
};

function slotCenterX(slot: number) {
  const w = 100 / PLINKO_SLOTS.length;
  return w * slot + w / 2;
}

export function HypnoticPlinkoPanel({ balance }: { balance?: number }) {
  const [pending, startTransition] = useTransition();
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<Risk>("medium");
  const [balls, setBalls] = useState<Ball[]>([]);
  const [ballId, setBallId] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);

  const clampedStake = useMemo(() => {
    const n = Number(stake);
    if (!Number.isFinite(n)) return 50;
    return Math.max(10, Math.min(5000, Math.floor(n)));
  }, [stake]);

  useEffect(() => {
    if (!balls.some((b) => b.active)) return;

    const tick = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min(32, now - lastTimeRef.current);
      lastTimeRef.current = now;

      setBalls((prev) => {
        let anyActive = false;
        const next = prev.map((ball) => {
          if (!ball.active) return ball;

          let vx = ball.vx;
          let vy = ball.vy + 0.06 * (dt / 16);
          let x = ball.x + vx * (dt / 16);
          let y = ball.y + vy * (dt / 16);

          if (x < 4) {
            x = 4;
            vx = Math.abs(vx) * 0.85;
          } else if (x > 96) {
            x = 96;
            vx = -Math.abs(vx) * 0.85;
          }

          const targetX = slotCenterX(ball.targetSlot);
          vx += (targetX - x) * 0.0025;

          for (let row = 1; row <= 8; row++) {
            const pegY = row * 8 + 12;
            if (Math.abs(y - pegY) < 2.2) {
              vx += (Math.random() - 0.5) * 0.35;
              vy *= 0.88;
            }
          }

          if (y >= 78) {
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

        if (!anyActive && prev.some((b) => b.active)) {
          setAnimating(false);
        }

        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
  }, [balls]);

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

    startTransition(async () => {
      const result = await playPlinko(clampedStake, risk);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const slot = result.slot ?? 4;
      setLastSlot(slot);
      setLastMessage(result.ok ?? null);
      toast.success(result.ok ?? "Ball dropped!");
      setAnimating(true);
      lastTimeRef.current = null;

      setBalls((prev) => [
        ...prev.filter((b) => b.active),
        {
          id: ballId,
          x: 50,
          y: 4,
          vx: (Math.random() - 0.5) * 0.4,
          vy: 0.35,
          active: true,
          targetSlot: slot,
        },
      ]);
      setBallId((id) => id + 1);
    });
  }

  return (
    <div className="hypnotic-plinko-panel w-full">
      <div className="hypnotic-plinko-panel__layout">
        {/* Board */}
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

          <div className="hypnotic-plinko-panel__board">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(34,211,238,0.15), transparent 70%)",
              }}
            />

            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="absolute w-full"
                style={{ top: `${rowIndex * 8 + 12}%` }}
              >
                {Array.from({ length: 10 - (rowIndex % 2) }).map((_, colIndex) => {
                  const cols = 10 - (rowIndex % 2);
                  const offsetX = (rowIndex % 2) * (100 / (cols * 2));
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className="absolute h-2 w-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      style={{
                        left: `${offsetX + colIndex * (100 / cols)}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {balls.map((ball) => (
              <div
                key={ball.id}
                className={`absolute h-3.5 w-3.5 rounded-full bg-gradient-to-br from-lime-300 to-emerald-500 shadow-[0_0_12px_rgba(74,222,128,0.8)] ${ball.active ? "" : "opacity-90"}`}
                style={{
                  left: `${ball.x}%`,
                  top: `${ball.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
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

            {lastMessage && (
              <div className="absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-black/60 px-3 py-1.5 text-center text-[10px] font-medium text-emerald-200">
                {lastMessage}
              </div>
            )}
          </div>
        </div>

        {/* Controls — reference-style side panel */}
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
            {pending || animating ? "Sending…" : "Send Ball"}
          </button>
        </div>
      </div>
    </div>
  );
}

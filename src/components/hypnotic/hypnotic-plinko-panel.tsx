"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { playPlinko } from "@/app/games/arcade/actions";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import {
  createPlinkoPhysicsBall,
  formatPlinkoMultiplier,
  PLINKO_BALL_TTL_MS,
  PLINKO_PEGS,
  plinkoSlotsForRisk,
  stepPlinkoPhysicsBall,
  type PlinkoPhysicsBall,
  type PlinkoRisk,
} from "@/lib/plinko-board";
import { formatVibe } from "@/lib/utils";

const MAX_ACTIVE_BALLS = 16;

type PlinkoBoardProps = {
  risk: PlinkoRisk;
  balls: PlinkoPhysicsBall[];
  lastSlot: number | null;
  lastMessage: string | null;
  variant?: "normal" | "cinema";
};

function PlinkoBoard({
  risk,
  balls,
  lastSlot,
  lastMessage,
  variant = "normal",
}: PlinkoBoardProps) {
  const slots = useMemo(() => plinkoSlotsForRisk(risk), [risk]);
  const activeCount = balls.filter((b) => b.active).length;

  return (
    <div
      className={`hypnotic-plinko-panel__board hypnotic-plinko-panel__board--pyramid ${
        variant === "cinema" ? "hypnotic-plinko-panel__board--cinema" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 50% 88%, rgba(34,211,238,0.18), transparent 72%)",
        }}
      />

      {PLINKO_PEGS.map((peg) => (
        <div
          key={`${peg.row}-${peg.col}`}
          className="hypnotic-plinko-panel__peg"
          style={{ left: `${peg.x}%`, top: `${peg.y}%` }}
        />
      ))}

      {balls.map((ball) => (
        <div
          key={ball.id}
          className={`hypnotic-plinko-panel__ball ${ball.active ? "hypnotic-plinko-panel__ball--active" : ""}`}
          style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
        />
      ))}

      <div className="hypnotic-plinko-panel__slots">
        {slots.map((slot, index) => (
          <div
            key={`${risk}-${index}`}
            className={`hypnotic-plinko-panel__slot ${
              lastSlot === index ? `${slot.color} ${slot.glow} hypnotic-plinko-panel__slot--hit` : ""
            }`}
          >
            {formatPlinkoMultiplier(slot.multiplier)}
          </div>
        ))}
      </div>

      {lastMessage && activeCount === 0 && (
        <div className="absolute left-1/2 top-2 max-w-[92%] -translate-x-1/2 rounded-lg border border-emerald-400/30 bg-black/70 px-3 py-1.5 text-center text-[10px] font-medium text-emerald-200">
          {lastMessage}
        </div>
      )}

      {activeCount > 1 && (
        <div className="absolute right-2 top-2 rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
          {activeCount} balls
        </div>
      )}
    </div>
  );
}

type ControlsProps = {
  stake: number;
  setStake: (n: number) => void;
  risk: PlinkoRisk;
  setRisk: (r: PlinkoRisk) => void;
  onSend: () => void;
  pendingCount: number;
  activeBalls: number;
  balance?: number;
  onFullscreen?: () => void;
  showFullscreen?: boolean;
};

function PlinkoControls({
  stake,
  setStake,
  risk,
  setRisk,
  onSend,
  pendingCount,
  activeBalls,
  balance,
  onFullscreen,
  showFullscreen = true,
}: ControlsProps) {
  function adjustStake(mult: number) {
    setStake(Math.max(10, Math.min(5000, Math.floor((Number(stake) || 50) * mult))));
  }

  const buttonLabel =
    pendingCount > 0 ? `Sending… (${pendingCount})` : activeBalls > 0 ? "Send Ball" : "Send Ball";

  return (
    <div className="hypnotic-plinko-panel__controls">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-sky-200">Plinko Ball Falling</p>
        {showFullscreen && onFullscreen && (
          <button
            type="button"
            onClick={onFullscreen}
            className="rounded-md border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200 hover:bg-violet-500/25"
          >
            Full screen
          </button>
        )}
      </div>

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
        onClick={onSend}
        className="mt-5 w-full rounded-xl border border-emerald-400/50 bg-gradient-to-b from-lime-400 to-emerald-600 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_4px_0_rgba(21,128,61,0.8)] transition hover:brightness-110"
      >
        {buttonLabel}
      </button>

      {balance != null && (
        <p className="mt-2 text-center text-[10px] text-amber-200/90">
          Balance: {formatVibe(balance)} VIBE
        </p>
      )}
    </div>
  );
}

export function HypnoticPlinkoPanel({ balance }: { balance?: number }) {
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [balls, setBalls] = useState<PlinkoPhysicsBall[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const ballsRef = useRef<PlinkoPhysicsBall[]>([]);
  const rafRef = useRef<number>(0);
  const ballIdRef = useRef(0);

  const clampedStake = useMemo(() => {
    const n = Number(stake);
    if (!Number.isFinite(n)) return 50;
    return Math.max(10, Math.min(5000, Math.floor(n)));
  }, [stake]);

  const activeBalls = balls.filter((b) => b.active).length;

  const syncBalls = useCallback((next: PlinkoPhysicsBall[]) => {
    ballsRef.current = next;
    setBalls(next);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!cinemaOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [cinemaOpen]);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      let changed = false;

      const next = ballsRef.current
        .map((ball) => {
          if (!ball.active) {
            if (ball.landedAt && now - ball.landedAt > PLINKO_BALL_TTL_MS) {
              changed = true;
              return null;
            }
            return ball;
          }

          const landed = stepPlinkoPhysicsBall(ball, PLINKO_PEGS);
          changed = true;

          if (landed && ball.message) {
            setLastSlot(ball.targetSlot);
            setLastMessage(ball.message);
            toast.success(ball.message);
          }

          return ball;
        })
        .filter((b): b is PlinkoPhysicsBall => b != null);

      if (changed) syncBalls(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [syncBalls]);

  const sendBall = useCallback(() => {
    if (ballsRef.current.filter((b) => b.active).length >= MAX_ACTIVE_BALLS) {
      toast.error(`Max ${MAX_ACTIVE_BALLS} balls in the air.`);
      return;
    }
    if (balance != null && balance < clampedStake) {
      toast.error(`Need ${formatVibe(clampedStake)} VIBE.`);
      return;
    }

    const id = ballIdRef.current++;
    setPendingCount((c) => c + 1);

    const currentRisk = risk;
    const currentStake = clampedStake;

    void (async () => {
      const result = await playPlinko(currentStake, currentRisk);
      setPendingCount((c) => Math.max(0, c - 1));

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const slot = result.slot ?? 5;
      const message = result.ok ?? "Ball dropped!";
      const ball = createPlinkoPhysicsBall(id, slot);
      ball.message = message;

      syncBalls([...ballsRef.current, ball]);
    })();
  }, [balance, clampedStake, risk, syncBalls]);

  const gameBody = (
    <div className="hypnotic-plinko-panel__layout">
      <div className="hypnotic-plinko-panel__board-wrap">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200/80">
            Plinko · Ball Falling
          </span>
          {balance != null && !cinemaOpen && (
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-amber-200">
              <CurrencyIconVibe className="h-3.5 w-3.5" />
              {formatVibe(balance)}
            </span>
          )}
        </div>
        <PlinkoBoard
          risk={risk}
          balls={balls}
          lastSlot={lastSlot}
          lastMessage={lastMessage}
          variant={cinemaOpen ? "cinema" : "normal"}
        />
      </div>

      <PlinkoControls
        stake={stake}
        setStake={setStake}
        risk={risk}
        setRisk={setRisk}
        onSend={sendBall}
        pendingCount={pendingCount}
        activeBalls={activeBalls}
        balance={balance}
        onFullscreen={() => setCinemaOpen(true)}
        showFullscreen={!cinemaOpen}
      />
    </div>
  );

  return (
    <div className="hypnotic-plinko-panel w-full">
      {gameBody}

      {mounted &&
        cinemaOpen &&
        createPortal(
          <div className="hypnotic-plinko-cinema" role="dialog" aria-modal="true" aria-label="Plinko full screen">
            <div className="hypnotic-plinko-cinema__backdrop" />
            <div className="hypnotic-plinko-cinema__shell">
              <button
                type="button"
                className="hypnotic-plinko-cinema__exit"
                onClick={() => setCinemaOpen(false)}
              >
                Exit full screen
              </button>

              <p className="hypnotic-plinko-cinema__title">Plinko</p>

              <div className="hypnotic-plinko-cinema__game">
                <div className="hypnotic-plinko-cinema__board-col">
                  <PlinkoBoard
                    risk={risk}
                    balls={balls}
                    lastSlot={lastSlot}
                    lastMessage={lastMessage}
                    variant="cinema"
                  />
                </div>
                <div className="hypnotic-plinko-cinema__controls-col">
                  <PlinkoControls
                    stake={stake}
                    setStake={setStake}
                    risk={risk}
                    setRisk={setRisk}
                    onSend={sendBall}
                    pendingCount={pendingCount}
                    activeBalls={activeBalls}
                    balance={balance}
                    showFullscreen={false}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

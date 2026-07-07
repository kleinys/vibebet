"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { playPlinko } from "@/app/games/arcade/actions";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import {
  BALL_R,
  BOARD_H,
  BOARD_W,
  createBall,
  formatMultiplier,
  PEG_R,
  PLINKO_BALL_TTL_MS,
  PLINKO_BATCH_MS,
  PLINKO_MULTIPLIERS,
  PLINKO_PEGS,
  PLINKO_SLOT_COUNT,
  slotFill,
  stepBall,
  type PlinkoBall,
  type PlinkoRisk,
} from "@/lib/plinko-board";
import { formatVibe } from "@/lib/utils";

const MAX_BALLS = 12;

function paintBoard(
  ctx: CanvasRenderingContext2D,
  risk: PlinkoRisk,
  balls: PlinkoBall[],
  highlightSlot: number | null,
  pendingDrops: number,
) {
  const w = BOARD_W;
  const h = BOARD_H;

  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.55, "#020617");
  bg.addColorStop(1, "#082f49");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 0.85, 0, w / 2, h * 0.85, w * 0.45);
  glow.addColorStop(0, "rgba(34,211,238,0.12)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const mults = PLINKO_MULTIPLIERS[risk];
  const slotW = w / PLINKO_SLOT_COUNT;
  const slotH = 44;
  const slotTop = h - slotH - 8;

  for (let i = 0; i < PLINKO_SLOT_COUNT; i++) {
    const x = i * slotW + 2;
    const sw = slotW - 4;
    const hit = highlightSlot === i;
    ctx.fillStyle = hit ? slotFill(mults[i]) : "rgba(24,24,27,0.92)";
    ctx.strokeStyle = hit ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
    ctx.lineWidth = hit ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x, slotTop, sw, slotH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fafafa";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatMultiplier(mults[i]), x + sw / 2, slotTop + slotH / 2);
  }

  for (const peg of PLINKO_PEGS) {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, PEG_R, 0, Math.PI * 2);
    const pegGrad = ctx.createRadialGradient(peg.x - 1, peg.y - 1, 0, peg.x, peg.y, PEG_R);
    pegGrad.addColorStop(0, "#ffffff");
    pegGrad.addColorStop(0.55, "#cbd5e1");
    pegGrad.addColorStop(1, "#64748b");
    ctx.fillStyle = pegGrad;
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const ball of balls) {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(
      ball.x - 2,
      ball.y - 2,
      0,
      ball.x,
      ball.y,
      BALL_R,
    );
    ballGrad.addColorStop(0, "#bbf7d0");
    ballGrad.addColorStop(0.55, "#22c55e");
    ballGrad.addColorStop(1, "#15803d");
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = ball.active ? "rgba(74,222,128,0.95)" : "rgba(74,222,128,0.7)";
    ctx.shadowBlur = ball.active ? 14 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (pendingDrops > 0) {
    const pulse = 0.85 + Math.sin(performance.now() / 120) * 0.15;
    ctx.beginPath();
    ctx.arc(BOARD_W / 2, 24, BALL_R * pulse, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(74,222,128,0.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(134,239,172,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

type ControlsProps = {
  stake: number;
  setStake: (n: number) => void;
  risk: PlinkoRisk;
  setRisk: (r: PlinkoRisk) => void;
  onDrop: () => void;
  pending: number;
  balance?: number;
  onFullscreen?: () => void;
  showFullscreen?: boolean;
};

function Controls({
  stake,
  setStake,
  risk,
  setRisk,
  onDrop,
  pending,
  balance,
  onFullscreen,
  showFullscreen = true,
}: ControlsProps) {
  function adjust(mult: number) {
    setStake(Math.max(10, Math.min(5000, Math.floor((Number(stake) || 50) * mult))));
  }

  return (
    <div className="plinko-v2__controls">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-sky-200">Plinko</p>
        {showFullscreen && onFullscreen && (
          <button type="button" className="plinko-v2__fs-btn" onClick={onFullscreen}>
            Full screen
          </button>
        )}
      </div>

      <label className="mt-4 block text-[11px] font-semibold text-zinc-300">Ball price</label>
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
        <button type="button" onClick={() => adjust(0.5)} className="plinko-v2__adj plinko-v2__adj--half">
          ½
        </button>
        <button type="button" onClick={() => adjust(2)} className="plinko-v2__adj plinko-v2__adj--double">
          2×
        </button>
      </div>

      <label className="mt-4 block text-[11px] font-semibold text-zinc-300">Risk</label>
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

      <button type="button" onClick={onDrop} className="plinko-v2__drop">
        {pending > 0 ? `Sending… (${pending})` : "Drop ball"}
      </button>

      {balance != null && (
        <p className="mt-2 text-center text-[10px] text-amber-200/90">
          Balance: {formatVibe(balance)} VIBE
        </p>
      )}
    </div>
  );
}

function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const dpr = window.devicePixelRatio || 1;
  const nextW = Math.round(rect.width * dpr);
  const nextH = Math.round(rect.height * dpr);
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW;
    canvas.height = nextH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.scale(rect.width / BOARD_W, rect.height / BOARD_H);
  }
  return true;
}

export function HypnoticPlinkoPanel({
  balance,
  onBalanceChange,
}: {
  balance?: number;
  onBalanceChange?: (next: number) => void;
}) {
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [pending, setPending] = useState(0);
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ballCount, setBallCount] = useState(0);

  const ballsRef = useRef<PlinkoBall[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cinemaCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const ballIdRef = useRef(0);
  const queueRef = useRef<Array<{ id: number; slot: number; message: string }>>([]);
  const batchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(0);
  const riskRef = useRef(risk);
  const highlightRef = useRef(highlightSlot);
  const pendingRef = useRef(pending);

  riskRef.current = risk;
  highlightRef.current = highlightSlot;
  pendingRef.current = pending;

  const clampedStake = useMemo(
    () => Math.max(10, Math.min(5000, Math.floor(Number(stake) || 50))),
    [stake],
  );

  const paint = useCallback(() => {
    for (const canvas of [canvasRef.current, cinemaCanvasRef.current]) {
      if (!canvas) continue;
      const ctx = canvas.getContext("2d");
      if (!ctx || !fitCanvas(canvas, ctx)) continue;
      paintBoard(
        ctx,
        riskRef.current,
        ballsRef.current,
        highlightRef.current,
        pendingRef.current,
      );
    }
  }, []);

  const bumpBallCount = useCallback(() => {
    setBallCount(ballsRef.current.length);
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
    paint();
    const ro = new ResizeObserver(() => paint());
    if (canvasRef.current) ro.observe(canvasRef.current);
    if (cinemaCanvasRef.current) ro.observe(cinemaCanvasRef.current);
    return () => ro.disconnect();
  }, [cinemaOpen, paint, risk, highlightSlot]);

  useEffect(() => {
    const loop = () => {
      const now = performance.now();
      let needsSync = false;

      ballsRef.current = ballsRef.current
        .map((ball) => {
          if (!ball.active) {
            if (ball.landedAt && now - ball.landedAt > PLINKO_BALL_TTL_MS) {
              needsSync = true;
              return null;
            }
            return ball;
          }
          const landed = stepBall(ball, now);
          if (landed) {
            needsSync = true;
            if (ball.message) {
              setHighlightSlot(ball.targetSlot);
              setLastMessage(ball.message);
              toast.success(ball.message);
            }
          }
          return ball;
        })
        .filter((b): b is PlinkoBall => b != null);

      paint();

      if (needsSync) bumpBallCount();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paint, bumpBallCount]);

  const flushQueue = useCallback(() => {
    if (inFlightRef.current > 0) {
      batchRef.current = setTimeout(flushQueue, 40);
      return;
    }
    if (queueRef.current.length === 0) return;
    const items = queueRef.current.splice(0);
    const dropAt = performance.now();
    const added = items.map(({ id, slot, message }) => {
      const ball = createBall(id, slot, message);
      ball.segmentStart = dropAt;
      return ball;
    });
    ballsRef.current = [...ballsRef.current, ...added];
    bumpBallCount();
    paint();
  }, [bumpBallCount, paint]);

  const enqueue = useCallback(
    (item: { id: number; slot: number; message: string }) => {
      queueRef.current.push(item);
      if (batchRef.current) clearTimeout(batchRef.current);
      batchRef.current = setTimeout(flushQueue, PLINKO_BATCH_MS);
    },
    [flushQueue],
  );

  const dropBall = useCallback(() => {
    const active =
      ballsRef.current.filter((b) => b.active).length +
      queueRef.current.length +
      inFlightRef.current;
    if (active >= MAX_BALLS) {
      toast.error(`Max ${MAX_BALLS} balls in the air.`);
      return;
    }
    if (balance != null && balance < clampedStake) {
      toast.error(`Need ${formatVibe(clampedStake)} VIBE.`);
      return;
    }

    const id = ballIdRef.current++;
    inFlightRef.current++;
    setPending((n) => n + 1);

    void playPlinko(clampedStake, risk)
      .then((result) => {
        inFlightRef.current--;
        setPending((n) => Math.max(0, n - 1));
        if (result.error) {
          toast.error(result.error);
          return;
        }
        if (typeof result.newBalance === "number" && onBalanceChange) {
          onBalanceChange(result.newBalance);
        }
        enqueue({
          id,
          slot: result.slot ?? Math.floor(PLINKO_SLOT_COUNT / 2),
          message: result.ok ?? "Ball dropped!",
        });
      })
      .catch(() => {
        inFlightRef.current--;
        setPending((n) => Math.max(0, n - 1));
        toast.error("Plinko drop failed.");
      });
  }, [balance, clampedStake, risk, enqueue, onBalanceChange]);

  const showResult = lastMessage != null && ballCount > 0;

  const board = (ref: RefObject<HTMLCanvasElement | null>, cinema = false) => (
    <div className="plinko-v2__board-wrap">
      <canvas
        ref={ref}
        className={`plinko-v2__canvas ${cinema ? "plinko-v2__canvas--cinema" : ""}`}
        width={BOARD_W}
        height={BOARD_H}
        aria-label="Plinko board"
      />
      {showResult && <p className="plinko-v2__result">{lastMessage}</p>}
    </div>
  );

  const controls = (
    <Controls
      stake={stake}
      setStake={setStake}
      risk={risk}
      setRisk={setRisk}
      onDrop={dropBall}
      pending={pending}
      balance={balance}
      onFullscreen={() => setCinemaOpen(true)}
      showFullscreen={!cinemaOpen}
    />
  );

  return (
    <div className="plinko-v2">
      {!cinemaOpen && (
        <div className="plinko-v2__layout">
          {board(canvasRef)}
          {controls}
        </div>
      )}

      {mounted &&
        cinemaOpen &&
        createPortal(
          <div className="plinko-v2__cinema" role="dialog" aria-modal aria-label="Plinko full screen">
            <div className="plinko-v2__cinema-backdrop" aria-hidden />
            <div className="plinko-v2__cinema-shell">
              <button
                type="button"
                className="plinko-v2__cinema-exit"
                onClick={() => setCinemaOpen(false)}
              >
                Exit full screen
              </button>
              <div className="plinko-v2__layout plinko-v2__layout--cinema">
                {board(cinemaCanvasRef, true)}
                <Controls
                  stake={stake}
                  setStake={setStake}
                  risk={risk}
                  setRisk={setRisk}
                  onDrop={dropBall}
                  pending={pending}
                  balance={balance}
                  showFullscreen={false}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

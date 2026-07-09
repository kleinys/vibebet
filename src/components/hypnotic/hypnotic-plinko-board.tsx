"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { formatVibe } from "@/lib/utils";
import {
  PLINKO_MULTIPLIERS,
  PLINKO_ROW_COUNT,
  PLINKO_STAKE_PRESETS,
  clampPlinkoStake,
  slotColor,
  type PlinkoRisk,
} from "@/lib/plinko-board";

const BTN =
  "rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-50";

export function HypnoticPlinkoBoard({ balance }: { balance: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stake, setStake] = useState(50);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");

  const clampedStake = useMemo(() => clampPlinkoStake(stake), [stake]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const slotCount = PLINKO_MULTIPLIERS.length;
    const slotW = width / slotCount;
    const boardTop = 12;
    const slotTop = height - 34;
    const pegAreaBottom = slotTop - 10;
    const pegAreaHeight = pegAreaBottom - boardTop;
    const pegRadius = Math.max(2.5, Math.min(4.5, width / 120));
    const rowGap = pegAreaHeight / PLINKO_ROW_COUNT;

    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "rgba(76, 29, 149, 0.35)");
    bg.addColorStop(1, "rgba(15, 23, 42, 0.9)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < PLINKO_ROW_COUNT; row++) {
      const pegsInRow = row + 3;
      const y = boardTop + rowGap * (row + 0.65);
      const span = (slotCount - 1) * slotW;
      const startX = (width - span) / 2;

      for (let col = 0; col < pegsInRow; col++) {
        const x = startX + (col * span) / (pegsInRow - 1);
        ctx.beginPath();
        ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(196, 181, 253, 0.85)";
        ctx.shadowColor = "rgba(167, 139, 250, 0.6)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (let i = 0; i < slotCount; i++) {
      const mult = PLINKO_MULTIPLIERS[i];
      const x = i * slotW;
      const color = slotColor(mult);

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(x + 1, slotTop, slotW - 2, height - slotTop - 2);
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${Math.max(9, Math.min(12, slotW * 0.28))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = mult >= 1 ? `${mult}×` : `${mult}×`;
      ctx.fillText(label, x + slotW / 2, slotTop + (height - slotTop) / 2);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }, []);

  return (
    <div className="hypnotic-plinko-board w-full">
      <div className="hypnotic-plinko-board__layout">
        <div className="hypnotic-plinko-board__canvas-wrap">
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

          <p className="text-center text-[10px] leading-relaxed text-zinc-500">
            {PLINKO_ROW_COUNT}-row board · {PLINKO_MULTIPLIERS.length} slots · medium risk shown.
            Physics and payouts are not wired yet.
          </p>
        </div>
      </div>
    </div>
  );
}

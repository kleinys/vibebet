/** Static Plinko board layout — visual only until drop mechanics ship. */

export const PLINKO_ROW_COUNT = 12;
export const PLINKO_SLOT_COUNT = 13;

/** Medium-risk multipliers (left → right). */
export const PLINKO_MULTIPLIERS: number[] = [
  5, 3, 2, 1, 0.5, 0.2, 0.1, 0.2, 0.5, 1, 2, 3, 5,
];

export const PLINKO_STAKE_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export type PlinkoRisk = "low" | "medium" | "high";

export function clampPlinkoStake(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(10, Math.min(5000, Math.floor(value)));
}

export function slotColor(multiplier: number): string {
  if (multiplier >= 5) return "#f43f5e";
  if (multiplier >= 2) return "#f97316";
  if (multiplier >= 1) return "#eab308";
  if (multiplier >= 0.5) return "#84cc16";
  if (multiplier >= 0.2) return "#22d3ee";
  return "#a855f7";
}

/** Draw staggered peg pyramid + multiplier slots onto a 2D canvas context. */
export function drawPlinkoBoard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const slotCount = PLINKO_MULTIPLIERS.length;
  const slotW = width / slotCount;
  const boardTop = 14;
  const slotTop = height - 36;
  const pegAreaBottom = slotTop - 8;
  const pegAreaHeight = pegAreaBottom - boardTop;
  const pegRadius = Math.max(2.5, Math.min(4.5, width / 120));
  const rowGap = pegAreaHeight / PLINKO_ROW_COUNT;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "rgba(76, 29, 149, 0.35)");
  bg.addColorStop(1, "rgba(15, 23, 42, 0.9)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Pyramid guide lines (subtle) — narrow at top, wide at bottom.
  ctx.strokeStyle = "rgba(167, 139, 250, 0.12)";
  ctx.lineWidth = 1;
  const apexX = width / 2;
  const apexY = boardTop - 4;
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(0, slotTop);
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(width, slotTop);
  ctx.stroke();

  for (let row = 0; row < PLINKO_ROW_COUNT; row++) {
    const pegsInRow = row + 3;
    const y = boardTop + rowGap * (row + 0.55);
    const rowWidth = (pegsInRow - 1) * slotW;
    let startX = (width - rowWidth) / 2;

    // Honeycomb stagger — skip on the widest row so pegs stay inside the board.
    if (row % 2 === 1 && pegsInRow <= slotCount) {
      startX += slotW / 2;
    }

    for (let col = 0; col < pegsInRow; col++) {
      const x = startX + col * slotW;
      ctx.beginPath();
      ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(196, 181, 253, 0.9)";
      ctx.shadowColor = "rgba(167, 139, 250, 0.55)";
      ctx.shadowBlur = 5;
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
    ctx.font = `bold ${Math.max(9, Math.min(13, slotW * 0.28))}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${mult}×`, x + slotW / 2, slotTop + (height - slotTop) / 2);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

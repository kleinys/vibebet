/** Static Plinko board layout — visual only until drop mechanics ship. */

export const PLINKO_ROW_COUNT = 12;
export const PLINKO_SLOT_COUNT = 13;

export const PLINKO_STAKE_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export type PlinkoRisk = "low" | "medium" | "high";

/** Symmetric multiplier rows — edges hot, center cold (reference-style). */
export const PLINKO_MULTIPLIERS_BY_RISK: Record<PlinkoRisk, number[]> = {
  low: [8, 4, 2, 1.2, 1, 0.7, 0.5, 0.7, 1, 1.2, 2, 4, 8],
  medium: [110, 26, 9, 4, 2, 1, 0.2, 1, 2, 4, 9, 26, 110],
  high: [1000, 130, 26, 9, 4, 2, 0.2, 0.5, 2, 4, 9, 26, 130],
};

export function multipliersForRisk(risk: PlinkoRisk): number[] {
  return PLINKO_MULTIPLIERS_BY_RISK[risk];
}

export function clampPlinkoStake(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(10, Math.min(5000, Math.floor(value)));
}

/** Red (edges) → orange → yellow (center), like classic Plinko UIs. */
export function slotColor(index: number, total: number, multiplier: number): string {
  const center = (total - 1) / 2;
  const dist = Math.abs(index - center) / Math.max(center, 1);

  if (dist > 0.85 || multiplier >= 100) return "#dc2626";
  if (dist > 0.65 || multiplier >= 20) return "#ea580c";
  if (dist > 0.45 || multiplier >= 5) return "#f59e0b";
  if (dist > 0.25 || multiplier >= 2) return "#facc15";
  return "#fde047";
}

function formatMultiplier(mult: number): string {
  if (mult >= 100) return String(Math.round(mult));
  if (Number.isInteger(mult)) return String(mult);
  return String(mult);
}

/** Equilateral honeycomb peg grid + multiplier bins. */
export function drawPlinkoBoard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  risk: PlinkoRisk = "medium",
): void {
  const multipliers = multipliersForRisk(risk);
  const slotCount = multipliers.length;
  const rows = PLINKO_ROW_COUNT;

  const padX = 10;
  const slotBarH = 30;
  const padTop = 18;
  const boardW = width - padX * 2;
  const idealPitch = boardW / slotCount;
  const idealRowStep = idealPitch * (Math.sqrt(3) / 2);
  const pegAreaH = height - slotBarH - padTop - 14;
  const maxRowStep = pegAreaH / Math.max(rows - 1, 1);
  const scale = Math.min(1, maxRowStep / idealRowStep);
  const pegPitch = idealPitch * scale;
  const rowStep = idealRowStep * scale;
  const slotTop = height - slotBarH - 6;
  const pegRadius = Math.max(2.2, Math.min(3.8, pegPitch * 0.13));

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(0.55, "#0f172a");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const originX = padX;

  function pegX(row: number, col: number, pegsInRow: number): number {
    if (row === rows - 1) {
      return originX + col * pegPitch;
    }
    const rowSpan = (pegsInRow - 1) * pegPitch;
    const base = originX + (boardW - rowSpan) / 2 + col * pegPitch;
    return row % 2 === 1 ? base + pegPitch / 2 : base;
  }

  for (let row = 0; row < rows; row++) {
    const pegsInRow = row + 3;
    const y = padTop + row * rowStep;

    for (let col = 0; col < pegsInRow; col++) {
      const x = pegX(row, col, pegsInRow);
      ctx.beginPath();
      ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255,255,255,0.45)";
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  const slotW = boardW / slotCount;
  for (let i = 0; i < slotCount; i++) {
    const mult = multipliers[i];
    const x = originX + i * slotW;
    const color = slotColor(i, slotCount, mult);
    const r = 3;

    ctx.beginPath();
    ctx.roundRect(x + 1.5, slotTop, slotW - 3, slotBarH - 2, r);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = mult >= 10 ? "#ffffff" : "#0f172a";
    const fontSize = Math.max(8, Math.min(11, slotW * 0.34));
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatMultiplier(mult), x + slotW / 2, slotTop + slotBarH / 2 - 1);
  }
}

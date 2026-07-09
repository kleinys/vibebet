/** Plinko board geometry + canvas rendering (pegs, slots, ball). */

import {
  multipliersForRisk,
  type PlinkoRisk,
} from "@/lib/plinko-board-types";

export {
  PLINKO_ROW_COUNT,
  PLINKO_SLOT_COUNT,
  PLINKO_STAKE_PRESETS,
  PLINKO_MULTIPLIERS_BY_RISK,
  multipliersForRisk,
  clampPlinkoStake,
  type PlinkoRisk,
} from "@/lib/plinko-board-types";

export interface PlinkoBoardLayout {
  width: number;
  height: number;
  padX: number;
  padTop: number;
  boardW: number;
  pegPitch: number;
  rowStep: number;
  slotTop: number;
  slotBarH: number;
  pegRadius: number;
  originX: number;
  startCol: number;
  rows: number;
  slotCount: number;
}

export interface PlinkoBallState {
  x: number;
  y: number;
  radius: number;
}

export function computePlinkoLayout(
  width: number,
  height: number,
  rows = 12,
  slotCount = 13,
): PlinkoBoardLayout {
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

  return {
    width,
    height,
    padX,
    padTop,
    boardW,
    pegPitch,
    rowStep,
    slotTop,
    slotBarH,
    pegRadius,
    originX: padX,
    startCol: Math.floor(slotCount / 2),
    rows,
    slotCount,
  };
}

function formatMultiplier(mult: number): string {
  if (mult >= 100) return String(Math.round(mult));
  if (Number.isInteger(mult)) return String(mult);
  return String(mult);
}

export function slotColor(index: number, total: number, multiplier: number): string {
  const center = (total - 1) / 2;
  const dist = Math.abs(index - center) / Math.max(center, 1);

  if (dist > 0.85 || multiplier >= 10) return "#dc2626";
  if (dist > 0.65 || multiplier >= 5) return "#ea580c";
  if (dist > 0.45 || multiplier >= 2) return "#f59e0b";
  if (dist > 0.25 || multiplier >= 1) return "#facc15";
  return "#fde047";
}

function drawPeg(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,255,255,0.45)";
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function pegX(layout: PlinkoBoardLayout, row: number, col: number, pegsInRow: number): number {
  if (row === layout.rows - 1) {
    return layout.originX + col * layout.pegPitch;
  }
  const rowSpan = (pegsInRow - 1) * layout.pegPitch;
  const base = layout.originX + (layout.boardW - rowSpan) / 2 + col * layout.pegPitch;
  return row % 2 === 1 ? base + layout.pegPitch / 2 : base;
}

export function drawPlinkoBoard(
  ctx: CanvasRenderingContext2D,
  layout: PlinkoBoardLayout,
  risk: PlinkoRisk,
  ball?: PlinkoBallState | null,
  highlightSlot?: number | null,
): void {
  const multipliers = multipliersForRisk(risk);
  const slotCount = multipliers.length;

  ctx.clearRect(0, 0, layout.width, layout.height);

  const bg = ctx.createLinearGradient(0, 0, 0, layout.height);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(0.55, "#0f172a");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const slotW = layout.boardW / slotCount;

  for (let row = 0; row < layout.rows; row++) {
    const pegsInRow = row + 3;
    const y = layout.padTop + row * layout.rowStep;

    for (let col = 0; col < pegsInRow; col++) {
      drawPeg(ctx, pegX(layout, row, col, pegsInRow), y, layout.pegRadius);
    }
  }

  for (let i = 0; i < slotCount; i++) {
    const mult = multipliers[i];
    const x = layout.originX + i * slotW;
    const color = slotColor(i, slotCount, mult);
    const active = highlightSlot === i;

    ctx.beginPath();
    ctx.roundRect(x + 1.5, layout.slotTop, slotW - 3, layout.slotBarH - 2, 3);
    ctx.fillStyle = color;
    ctx.fill();

    if (active) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = mult >= 10 ? "#ffffff" : "#0f172a";
    const fontSize = Math.max(8, Math.min(11, slotW * 0.34));
    ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatMultiplier(mult), x + slotW / 2, layout.slotTop + layout.slotBarH / 2 - 1);
  }

  if (ball) {
    const grad = ctx.createRadialGradient(
      ball.x - ball.radius * 0.3,
      ball.y - ball.radius * 0.3,
      ball.radius * 0.2,
      ball.x,
      ball.y,
      ball.radius,
    );
    grad.addColorStop(0, "#fde68a");
    grad.addColorStop(0.55, "#f59e0b");
    grad.addColorStop(1, "#b45309");
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = "rgba(245, 158, 11, 0.65)";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, layout.width - 1, layout.height - 1);
}

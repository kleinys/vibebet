/** Plinko board math — 12 rows, 13 slots. Matches `play_plinko` RPC. */

export const PLINKO_ROWS = 12;
export const PLINKO_SLOT_COUNT = 13;
export const PLINKO_BOUNCE_MS = 520;
export const PLINKO_BALL_TTL_MS = 10_000;
export const PLINKO_BATCH_MS = 120;

export const BOARD_W = 520;
export const BOARD_H = 560;
export const PEG_R = 5;
export const BALL_R = 7;

export type PlinkoRisk = "low" | "medium" | "high";

export const PLINKO_MULTIPLIERS: Record<PlinkoRisk, number[]> = {
  low: [3, 2, 1.5, 1.2, 1, 0.3, 0.5, 0.3, 1, 1.2, 1.5, 2, 3],
  medium: [5, 3, 2, 1.5, 1, 0.5, 0.1, 0.5, 1, 1.5, 2, 3, 5],
  high: [10, 5, 3, 2, 0.5, 0.2, 0.1, 0.2, 0.5, 2, 3, 5, 10],
};

export type Point = { x: number; y: number };

export type PlinkoPeg = Point & { row: number; col: number };

export type PlinkoBall = {
  id: number;
  targetSlot: number;
  waypoints: Point[];
  segment: number;
  segmentStart: number | null;
  x: number;
  y: number;
  active: boolean;
  landedAt: number | null;
  message: string | null;
};

const SLOT_W = BOARD_W / PLINKO_SLOT_COUNT;
const PEG_TOP = 56;
const PEG_BOTTOM = 430;
const ROW_STEP = (PEG_BOTTOM - PEG_TOP) / (PLINKO_ROWS - 1);
const SLOT_Y = 498;

export function pegAt(row: number, col: number): Point {
  return {
    x: BOARD_W / 2 + (col - row / 2) * SLOT_W,
    y: PEG_TOP + row * ROW_STEP,
  };
}

export function buildPegs(): PlinkoPeg[] {
  const pegs: PlinkoPeg[] = [];
  for (let row = 0; row < PLINKO_ROWS; row++) {
    for (let col = 0; col <= row; col++) {
      pegs.push({ row, col, ...pegAt(row, col) });
    }
  }
  return pegs;
}

export const PLINKO_PEGS = buildPegs();

export function slotCenter(slot: number): Point {
  const clamped = Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, slot));
  return { x: (clamped + 0.5) * SLOT_W, y: SLOT_Y };
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildMoves(targetSlot: number): ("L" | "R")[] {
  const slot = Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, targetSlot));
  return shuffle([
    ...Array.from({ length: slot }, () => "R" as const),
    ...Array.from({ length: PLINKO_ROWS - slot }, () => "L" as const),
  ]);
}

function colAfterMoves(moves: ("L" | "R")[], row: number): number {
  let col = 0;
  for (let i = 0; i < row; i++) if (moves[i] === "R") col++;
  return col;
}

export function buildWaypoints(targetSlot: number, startX = BOARD_W / 2): Point[] {
  const moves = buildMoves(targetSlot);
  const points: Point[] = [{ x: startX, y: 24 }];

  for (let row = 0; row < PLINKO_ROWS; row++) {
    const col = colAfterMoves(moves, row);
    const peg = pegAt(row, col);
    const dir = moves[row] === "R" ? 1 : -1;
    points.push({
      x: peg.x + dir * (PEG_R + BALL_R + 2),
      y: peg.y + PEG_R + BALL_R + 4,
    });
  }

  points.push(slotCenter(targetSlot));
  return points;
}

export function createBall(id: number, targetSlot: number, message: string | null): PlinkoBall {
  const spread = ((id % 5) - 2) * 6;
  const startX = BOARD_W / 2 + spread;
  const waypoints = buildWaypoints(targetSlot, startX);
  return {
    id,
    targetSlot,
    waypoints,
    segment: 0,
    segmentStart: null,
    x: waypoints[0].x,
    y: waypoints[0].y,
    active: true,
    landedAt: null,
    message,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function stepBall(ball: PlinkoBall, now: number): boolean {
  if (!ball.active) return false;

  if (ball.segmentStart == null) ball.segmentStart = now;

  const from = ball.waypoints[ball.segment];
  const to = ball.waypoints[ball.segment + 1];
  if (!to) {
    ball.active = false;
    ball.landedAt = now;
    return true;
  }

  const t = Math.min(1, (now - ball.segmentStart) / PLINKO_BOUNCE_MS);
  const e = easeInOut(t);
  ball.x = from.x + (to.x - from.x) * e;
  ball.y = from.y + (to.y - from.y) * e;

  if (t >= 1) {
    ball.x = to.x;
    ball.y = to.y;
    ball.segment++;
    ball.segmentStart = now;
    if (ball.segment >= ball.waypoints.length - 1) {
      ball.active = false;
      ball.landedAt = now;
      return true;
    }
  }

  return false;
}

export function formatMultiplier(n: number): string {
  return Number.isInteger(n) ? `${n}x` : `${n.toFixed(1)}x`;
}

export function slotFill(multiplier: number): string {
  if (multiplier >= 5) return "#34d399";
  if (multiplier >= 2) return "#84cc16";
  if (multiplier >= 1) return "#fbbf24";
  if (multiplier >= 0.5) return "#f97316";
  return "#f43f5e";
}

export const PLINKO_ROWS = 12;
export const PLINKO_SLOT_COUNT = 13;

export type PlinkoRisk = "low" | "medium" | "high";

export type PlinkoSlot = {
  multiplier: number;
  color: string;
  glow: string;
};

/** Matches `play_plinko` RPC — high at edges, lowest in center with extra low bins beside 0.1. */
export const PLINKO_SLOTS_BY_RISK: Record<PlinkoRisk, number[]> = {
  low: [3, 2, 1.5, 1.2, 1, 0.3, 0.5, 0.3, 1, 1.2, 1.5, 2, 3],
  medium: [5, 3, 2, 1.5, 1, 0.5, 0.1, 0.5, 1, 1.5, 2, 3, 5],
  high: [10, 5, 3, 2, 0.5, 0.2, 0.1, 0.2, 0.5, 2, 3, 5, 10],
};

function colorForMultiplier(multiplier: number): { color: string; glow: string } {
  if (multiplier >= 5) {
    return { color: "bg-emerald-400", glow: "shadow-emerald-400/60" };
  }
  if (multiplier >= 2) {
    return { color: "bg-lime-500", glow: "shadow-lime-500/50" };
  }
  if (multiplier >= 1) {
    return { color: "bg-amber-500", glow: "shadow-amber-500/50" };
  }
  if (multiplier >= 0.5) {
    return { color: "bg-orange-600", glow: "shadow-orange-500/50" };
  }
  return { color: "bg-rose-600", glow: "shadow-rose-500/50" };
}

export function plinkoSlotsForRisk(risk: PlinkoRisk): PlinkoSlot[] {
  return PLINKO_SLOTS_BY_RISK[risk].map((multiplier) => ({
    multiplier,
    ...colorForMultiplier(multiplier),
  }));
}

export function formatPlinkoMultiplier(multiplier: number): string {
  if (Number.isInteger(multiplier)) return `${multiplier}x`;
  return `${multiplier.toFixed(1)}x`;
}

export type PlinkoPeg = { row: number; col: number; x: number; y: number };

export type PlinkoPoint = { x: number; y: number };

export const PLINKO_PEGS = buildPlinkoPegs();

const SLOT_WIDTH = 100 / PLINKO_SLOT_COUNT;
export const PEG_RADIUS = 1.65;
export const BALL_RADIUS = 1.05;

export function slotCenterX(slot: number): number {
  return (slot + 0.5) * SLOT_WIDTH;
}

export function pegPosition(row: number, col: number): PlinkoPoint {
  return {
    x: 50 + (col - row / 2) * SLOT_WIDTH,
    y: pegRowY(row),
  };
}

function pegRowY(row: number): number {
  return 7 + row * (54 / (PLINKO_ROWS - 1));
}

export function buildPlinkoPegs(): PlinkoPeg[] {
  const pegs: PlinkoPeg[] = [];
  for (let row = 0; row < PLINKO_ROWS; row++) {
    for (let col = 0; col <= row; col++) {
      const { x, y } = pegPosition(row, col);
      pegs.push({ row, col, x, y });
    }
  }
  return pegs;
}

function shuffleMoves(moves: ("L" | "R")[]): ("L" | "R")[] {
  const next = [...moves];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function colAtRow(moves: ("L" | "R")[], row: number): number {
  let col = 0;
  for (let i = 0; i < row; i++) {
    if (moves[i] === "R") col++;
  }
  return col;
}

function buildMoves(targetSlot: number): ("L" | "R")[] {
  const clamped = Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, targetSlot));
  return shuffleMoves([
    ...Array.from({ length: clamped }, () => "R" as const),
    ...Array.from({ length: PLINKO_ROWS - clamped }, () => "L" as const),
  ]);
}

function buildWaypoints(
  moves: ("L" | "R")[],
  targetSlot: number,
  startX: number,
): PlinkoPoint[] {
  const points: PlinkoPoint[] = [{ x: startX, y: 2.5 }];

  for (let row = 0; row < PLINKO_ROWS; row++) {
    const col = colAtRow(moves, row);
    const peg = pegPosition(row, col);
    const move = moves[row];
    points.push({
      x: peg.x + (move === "R" ? PEG_RADIUS * 0.58 : -PEG_RADIUS * 0.58),
      y: peg.y + PEG_RADIUS + BALL_RADIUS + 0.12,
    });
  }

  points.push({ x: slotCenterX(targetSlot), y: 79 });
  return points;
}

export type PlinkoPhysicsBall = {
  id: number;
  x: number;
  y: number;
  active: boolean;
  targetSlot: number;
  moves: ("L" | "R")[];
  waypoints: PlinkoPoint[];
  segment: number;
  segmentStartAt: number | null;
  landedAt: number | null;
  message: string | null;
  releaseAt: number | null;
};

export function createPlinkoPhysicsBall(
  id: number,
  targetSlot: number,
  releaseAt: number | null = null,
): PlinkoPhysicsBall {
  const spread = (id % 7) * 0.18 - 0.54;
  const startX = 50 + spread;
  const clampedSlot = Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, targetSlot));
  const moves = buildMoves(clampedSlot);

  return {
    id,
    x: startX,
    y: 2.5,
    active: true,
    targetSlot: clampedSlot,
    moves,
    waypoints: buildWaypoints(moves, clampedSlot, startX),
    segment: 0,
    segmentStartAt: null,
    landedAt: null,
    message: null,
    releaseAt,
  };
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export const PLINKO_BOUNCE_MS = 480;

export function stepPlinkoPhysicsBall(ball: PlinkoPhysicsBall): boolean {
  if (!ball.active) return false;

  const now = performance.now();
  if (ball.releaseAt != null && now < ball.releaseAt) {
    return false;
  }

  if (ball.segmentStartAt == null) {
    ball.segmentStartAt = now;
  }

  const from = ball.waypoints[ball.segment];
  const to = ball.waypoints[ball.segment + 1];

  if (!to) {
    ball.x = from.x;
    ball.y = from.y;
    ball.active = false;
    ball.landedAt = now;
    return true;
  }

  const raw = (now - ball.segmentStartAt) / PLINKO_BOUNCE_MS;
  const t = Math.min(1, raw);
  const eased = easeInOutQuad(t);

  ball.x = from.x + (to.x - from.x) * eased;
  ball.y = from.y + (to.y - from.y) * eased;

  if (t >= 1) {
    ball.x = to.x;
    ball.y = to.y;
    ball.segment++;
    ball.segmentStartAt = now;

    if (ball.segment >= ball.waypoints.length - 1) {
      ball.active = false;
      ball.landedAt = now;
      return true;
    }
  }

  return false;
}

export const PLINKO_BALL_TTL_MS = 12000;
/** Grace period after the last RPC returns — balls in the queue drop together. */
export const PLINKO_BATCH_GRACE_MS = 150;

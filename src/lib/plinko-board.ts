export const PLINKO_ROWS = 10;
export const PLINKO_SLOT_COUNT = 11;

export type PlinkoRisk = "low" | "medium" | "high";

export type PlinkoSlot = {
  multiplier: number;
  color: string;
  glow: string;
};

/** Matches `play_plinko` RPC — high at edges, lowest in center. */
export const PLINKO_SLOTS_BY_RISK: Record<PlinkoRisk, number[]> = {
  low: [3, 2, 1.5, 1.2, 1, 0.5, 1, 1.2, 1.5, 2, 3],
  medium: [5, 3, 2, 1.5, 1, 0.1, 1, 1.5, 2, 3, 5],
  high: [10, 5, 3, 2, 0.5, 0.1, 0.5, 2, 3, 5, 10],
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
export const PEG_RADIUS = 1.75;
export const BALL_RADIUS = 1.1;
const GRAVITY = 0.022;
const MAX_BALL_SPEED = 0.85;

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
  return 8 + row * (56 / (PLINKO_ROWS - 1));
}

/** Pyramid peg lattice: row r has r+1 pegs. */
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

export type PlinkoPhysicsBall = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  targetSlot: number;
  moves: ("L" | "R")[];
  rowHit: boolean[];
  landedAt: number | null;
  message: string | null;
};

export function createPlinkoPhysicsBall(id: number, targetSlot: number): PlinkoPhysicsBall {
  return {
    id,
    x: 50 + (Math.random() - 0.5) * 0.6,
    y: 2.5,
    vx: (Math.random() - 0.5) * 0.04,
    vy: 0.1,
    active: true,
    targetSlot: Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, targetSlot)),
    moves: buildMoves(targetSlot),
    rowHit: Array.from({ length: PLINKO_ROWS }, () => false),
    landedAt: null,
    message: null,
  };
}

function clampSpeed(ball: PlinkoPhysicsBall) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_BALL_SPEED) {
    ball.vx = (ball.vx / speed) * MAX_BALL_SPEED;
    ball.vy = (ball.vy / speed) * MAX_BALL_SPEED;
  }
}

function bounceOffPeg(ball: PlinkoPhysicsBall, peg: PlinkoPoint) {
  const dx = ball.x - peg.x;
  const dy = ball.y - peg.y;
  const dist = Math.hypot(dx, dy);
  const minDist = PEG_RADIUS + BALL_RADIUS;
  if (dist >= minDist || dist < 0.0001) return false;

  const nx = dx / dist;
  const ny = dy / dist;
  ball.x = peg.x + nx * minDist;
  ball.y = peg.y + ny * minDist;

  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    const restitution = 0.72;
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
  }

  ball.vx *= 0.92;
  ball.vy *= 0.88;
  return true;
}

function guidedRowBounce(ball: PlinkoPhysicsBall): boolean {
  for (let row = 0; row < PLINKO_ROWS; row++) {
    if (ball.rowHit[row]) continue;

    const col = colAtRow(ball.moves, row);
    const peg = pegPosition(row, col);
    const move = ball.moves[row];
    const nearX = Math.abs(ball.x - peg.x) < SLOT_WIDTH * 0.42;
    const nearY = ball.y >= peg.y - 1.4 && ball.y <= peg.y + 2.6;
    const passed = ball.y > peg.y + 2.2;

    if (!nearY && !passed) continue;
    if (!nearX && !passed) continue;

    ball.x = peg.x + (move === "R" ? PEG_RADIUS * 0.55 : -PEG_RADIUS * 0.55);
    ball.y = peg.y + PEG_RADIUS + BALL_RADIUS + 0.15;
    ball.vx = move === "R" ? 0.2 + Math.random() * 0.05 : -0.2 - Math.random() * 0.05;
    ball.vy = Math.max(ball.vy, 0.06);
    ball.rowHit[row] = true;
    return true;
  }
  return false;
}

/** Advance one physics frame. Returns true when the ball just landed. */
export function stepPlinkoPhysicsBall(ball: PlinkoPhysicsBall, pegs: PlinkoPeg[]): boolean {
  if (!ball.active) return false;

  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < 4.5) {
    ball.x = 4.5;
    ball.vx = Math.abs(ball.vx) * 0.75;
  } else if (ball.x > 95.5) {
    ball.x = 95.5;
    ball.vx = -Math.abs(ball.vx) * 0.75;
  }

  guidedRowBounce(ball);

  for (const peg of pegs) {
    bounceOffPeg(ball, peg);
  }

  clampSpeed(ball);

  const allRowsHit = ball.rowHit.every(Boolean);
  if (allRowsHit) {
    const targetX = slotCenterX(ball.targetSlot);
    ball.x += (targetX - ball.x) * 0.12;
    if (ball.y < 83.5) {
      ball.vy = Math.max(ball.vy, 0.14);
    }

    if (ball.y >= 83.5) {
      ball.x = targetX;
      ball.y = 84;
      ball.vx = 0;
      ball.vy = 0;
      ball.active = false;
      ball.landedAt = performance.now();
      return true;
    }
  }

  return false;
}

export const PLINKO_BALL_TTL_MS = 4500;

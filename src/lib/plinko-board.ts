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

const SLOT_WIDTH = 100 / PLINKO_SLOT_COUNT;
const PEG_RADIUS = 1.55;
const BALL_RADIUS = 1.05;

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

/** Build a zig-zag path that bounces off peg surfaces (not through centers). */
export function buildPlinkoDropPath(targetSlot: number): PlinkoPoint[] {
  const clamped = Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, targetSlot));
  const rights = clamped;
  const lefts = PLINKO_ROWS - rights;
  const moves = shuffleMoves([
    ...Array.from({ length: rights }, () => "R" as const),
    ...Array.from({ length: lefts }, () => "L" as const),
  ]);

  const touch = PEG_RADIUS + BALL_RADIUS * 0.45;
  const points: PlinkoPoint[] = [{ x: 50, y: 2.5 }];
  let col = 0;

  for (let row = 0; row < PLINKO_ROWS; row++) {
    const peg = pegPosition(row, col);
    const move = moves[row];

    points.push({ x: peg.x, y: peg.y - touch - 2.8 });

    const contactX =
      move === "R" ? peg.x - PEG_RADIUS * 0.72 : peg.x + PEG_RADIUS * 0.72;
    const contactY = peg.y - PEG_RADIUS * 0.92;
    points.push({ x: contactX, y: contactY });

    const exitX =
      move === "R"
        ? peg.x + SLOT_WIDTH * 0.2 + PEG_RADIUS * 0.35
        : peg.x - SLOT_WIDTH * 0.2 - PEG_RADIUS * 0.35;
    const exitY = peg.y + PEG_RADIUS * 1.15;
    points.push({ x: exitX, y: exitY });

    col = move === "R" ? col + 1 : col;

    if (row < PLINKO_ROWS - 1) {
      const nextPeg = pegPosition(row + 1, col);
      points.push({
        x: exitX * 0.35 + nextPeg.x * 0.65,
        y: exitY * 0.4 + (nextPeg.y - touch - 2) * 0.6,
      });
      points.push({ x: nextPeg.x, y: nextPeg.y - touch - 2 });
    }
  }

  points.push({ x: slotCenterX(clamped), y: 70 });
  points.push({ x: slotCenterX(clamped), y: 84 });
  return points;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function samplePlinkoPath(
  points: PlinkoPoint[],
  progress: number,
): PlinkoPoint {
  if (points.length <= 1) return points[0] ?? { x: 50, y: 2.5 };
  const t = Math.max(0, Math.min(1, progress));
  const scaled = t * (points.length - 1);
  const index = Math.min(Math.floor(scaled), points.length - 2);
  const local = easeInOutQuad(scaled - index);
  const a = points[index];
  const b = points[index + 1];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
  };
}

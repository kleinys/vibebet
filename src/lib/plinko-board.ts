export const PLINKO_ROWS = 8;
export const PLINKO_SLOT_COUNT = 9;

export type PlinkoRisk = "low" | "medium" | "high";

export type PlinkoSlot = {
  multiplier: number;
  color: string;
  glow: string;
};

/** Matches `play_plinko` RPC slot arrays (left → right). */
export const PLINKO_SLOTS_BY_RISK: Record<PlinkoRisk, number[]> = {
  low: [0.5, 0.8, 1.0, 1.2, 1.5, 1.2, 1.0, 0.8, 0.5],
  medium: [0.3, 0.7, 1.0, 1.5, 3.0, 1.5, 1.0, 0.7, 0.3],
  high: [0.2, 0.5, 1.0, 2.0, 5.0, 2.0, 1.0, 0.5, 0.2],
};

const SLOT_COLORS = [
  { color: "bg-rose-600", glow: "shadow-rose-500/50" },
  { color: "bg-orange-600", glow: "shadow-orange-500/50" },
  { color: "bg-amber-500", glow: "shadow-amber-500/50" },
  { color: "bg-yellow-500", glow: "shadow-yellow-400/50" },
  { color: "bg-lime-400", glow: "shadow-lime-400/60" },
  { color: "bg-yellow-500", glow: "shadow-yellow-400/50" },
  { color: "bg-amber-500", glow: "shadow-amber-500/50" },
  { color: "bg-orange-600", glow: "shadow-orange-500/50" },
  { color: "bg-rose-600", glow: "shadow-rose-500/50" },
];

export function plinkoSlotsForRisk(risk: PlinkoRisk): PlinkoSlot[] {
  return PLINKO_SLOTS_BY_RISK[risk].map((multiplier, index) => ({
    multiplier,
    ...SLOT_COLORS[index],
  }));
}

export type PlinkoPeg = { row: number; col: number; x: number; y: number };

export type PlinkoPoint = { x: number; y: number };

const SLOT_WIDTH = 100 / PLINKO_SLOT_COUNT;

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
  return 10 + row * (58 / (PLINKO_ROWS - 1));
}

/** Pyramid peg lattice: row r has r+1 pegs (1 at top → 8 at bottom). */
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

/** Build a natural zig-zag path that lands in `targetSlot` (0-indexed). */
export function buildPlinkoDropPath(targetSlot: number): PlinkoPoint[] {
  const clamped = Math.max(0, Math.min(PLINKO_SLOT_COUNT - 1, targetSlot));
  const rights = clamped;
  const lefts = PLINKO_ROWS - rights;
  const moves = shuffleMoves([
    ...Array.from({ length: rights }, () => "R" as const),
    ...Array.from({ length: lefts }, () => "L" as const),
  ]);

  const points: PlinkoPoint[] = [{ x: 50, y: 3 }];
  let col = 0;

  for (let row = 0; row < PLINKO_ROWS; row++) {
    const peg = pegPosition(row, col);
    points.push({ x: peg.x, y: peg.y - 0.4 });

    const move = moves[row];
    const nextCol = move === "R" ? col + 1 : col;
    const landingX =
      move === "R"
        ? peg.x + SLOT_WIDTH * 0.22
        : peg.x - SLOT_WIDTH * 0.22;
    const landingY = peg.y + 2.8;
    points.push({ x: landingX, y: landingY });

    col = nextCol;

    if (row < PLINKO_ROWS - 1) {
      const nextPeg = pegPosition(row + 1, col);
      points.push({ x: nextPeg.x, y: nextPeg.y - 1.2 });
    }
  }

  points.push({ x: slotCenterX(clamped), y: 72 });
  points.push({ x: slotCenterX(clamped), y: 86 });
  return points;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function samplePlinkoPath(
  points: PlinkoPoint[],
  progress: number,
): PlinkoPoint {
  if (points.length <= 1) return points[0] ?? { x: 50, y: 3 };
  const t = Math.max(0, Math.min(1, progress));
  const scaled = t * (points.length - 1);
  const index = Math.min(Math.floor(scaled), points.length - 2);
  const local = easeOutQuad(scaled - index);
  const a = points[index];
  const b = points[index + 1];
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
  };
}

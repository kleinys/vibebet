/** Build a random L/R path that lands in the target slot (Galton board model). */

import {
  ballXForCol,
  slotCenterX,
  type PlinkoBoardLayout,
} from "@/lib/plinko-board";

export type PlinkoDirection = "L" | "R";

/** Y midpoint between peg row `row` and the next row — ball passes through gaps here. */
export function ballYBetweenRows(layout: PlinkoBoardLayout, row: number): number {
  return layout.padTop + (row + 0.5) * layout.rowStep;
}

/**
 * Standard Galton board: with `rows` peg rows, slot index equals the count of
 * right deflections (0…rows). All 13 slots are reachable.
 */
export function rightsNeededForSlot(targetSlot: number, rows: number): number {
  return targetSlot;
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Random L/R sequence with exactly `targetSlot` rights — any order stays in bounds. */
export function pathForSlot(targetSlot: number, rows: number): PlinkoDirection[] {
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot > rows) {
    throw new Error(`Invalid plinko slot ${targetSlot} for ${rows} rows`);
  }
  const rights = rightsNeededForSlot(targetSlot, rows);
  const lefts = rows - rights;
  return shuffle<PlinkoDirection>([
    ...Array.from({ length: rights }, () => "R" as const),
    ...Array.from({ length: lefts }, () => "L" as const),
  ]);
}

export interface PlinkoWaypoint {
  x: number;
  y: number;
}

/** Peg-gap bounce points: spawn → each row gap → final slot. */
export function waypointsForPath(
  path: PlinkoDirection[],
  layout: PlinkoBoardLayout,
  targetSlot: number,
): PlinkoWaypoint[] {
  const points: PlinkoWaypoint[] = [
    { x: ballXForCol(layout, layout.startCol), y: layout.padTop - 16 },
  ];

  let col = layout.startCol;
  for (let row = 0; row < path.length; row++) {
    col += path[row] === "R" ? 0.5 : -0.5;
    points.push({
      x: ballXForCol(layout, col),
      y: ballYBetweenRows(layout, row),
    });
  }

  points.push({
    x: slotCenterX(layout, targetSlot),
    y: layout.slotTop + layout.slotBarH / 2,
  });

  return points;
}

/** Global ease along the full path (0…1). */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function pointAlongWaypoints(
  waypoints: PlinkoWaypoint[],
  progress: number,
): PlinkoWaypoint {
  if (waypoints.length <= 1) return waypoints[0] ?? { x: 0, y: 0 };

  const eased = easeOutCubic(Math.max(0, Math.min(1, progress)));
  const segments = waypoints.length - 1;
  const scaled = eased * segments;
  const idx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - idx;
  const a = waypoints[idx];
  const b = waypoints[idx + 1];
  return {
    x: a.x + (b.x - a.x) * localT,
    y: a.y + (b.y - a.y) * localT,
  };
}

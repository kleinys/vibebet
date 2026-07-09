/** Build a random L/R path that lands in the target slot (12 rows, start col 6). */

import { ballXForCol, ballYForRow, slotCenterX, type PlinkoBoardLayout } from "@/lib/plinko-board";

export type PlinkoDirection = "L" | "R";

export function rightsNeededForSlot(targetSlot: number, rows: number, startCol: number): number {
  return (targetSlot + rows - startCol) / 2;
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Random left/right sequence with exactly the rights needed to land in `targetSlot`. */
export function pathForSlot(targetSlot: number, rows: number, startCol: number): PlinkoDirection[] {
  const rights = rightsNeededForSlot(targetSlot, rows, startCol);
  const lefts = rows - rights;
  if (rights < 0 || lefts < 0 || !Number.isInteger(rights)) {
    throw new Error(`Invalid plinko slot ${targetSlot} for ${rows} rows`);
  }
  return shuffle<PlinkoDirection>([
    ...Array.from({ length: rights }, () => "R" as const),
    ...Array.from({ length: lefts }, () => "L" as const),
  ]);
}

export interface PlinkoWaypoint {
  x: number;
  y: number;
}

/** Peg-gap bounce points from spawn → each row → final slot. */
export function waypointsForPath(
  path: PlinkoDirection[],
  layout: PlinkoBoardLayout,
  targetSlot: number,
): PlinkoWaypoint[] {
  const points: PlinkoWaypoint[] = [
    { x: ballXForCol(layout, layout.startCol), y: layout.padTop - 14 },
  ];

  let col = layout.startCol;
  for (let row = 0; row < path.length; row++) {
    const dir = path[row] === "R" ? 1 : -1;
    points.push({
      x: ballXForCol(layout, col + dir * 0.5),
      y: ballYForRow(layout, row) + layout.rowStep * 0.42,
    });
    col += dir;
  }

  points.push({
    x: slotCenterX(layout, targetSlot),
    y: layout.slotTop + layout.slotBarH / 2,
  });

  return points;
}

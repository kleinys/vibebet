/** Build a random L/R path that lands in the target slot (12 rows, start col 6). */

export type PlinkoDirection = "L" | "R";

export function rightsNeededForSlot(targetSlot: number, startCol = 6): number {
  return Math.round((targetSlot + startCol) / 2);
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pathForSlot(targetSlot: number, rows: number, startCol = 6): PlinkoDirection[] {
  const rights = rightsNeededForSlot(targetSlot, startCol);
  const lefts = rows - rights;
  if (rights < 0 || lefts < 0) {
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

export function waypointsForPath(
  path: PlinkoDirection[],
  layout: {
    width: number;
    padTop: number;
    rowStep: number;
    pegPitch: number;
    originX: number;
    slotTop: number;
    slotBarH: number;
    startCol: number;
  },
  targetSlot: number,
): PlinkoWaypoint[] {
  const points: PlinkoWaypoint[] = [
    { x: layout.width / 2, y: layout.padTop - 14 },
  ];

  let col = layout.startCol;
  for (let row = 0; row < path.length; row++) {
    points.push({
      x: layout.originX + (col + 0.5) * layout.pegPitch,
      y: layout.padTop + row * layout.rowStep,
    });
    col += path[row] === "R" ? 1 : -1;
  }

  points.push({
    x: layout.originX + (targetSlot + 0.5) * layout.pegPitch,
    y: layout.slotTop + layout.slotBarH / 2,
  });

  return points;
}

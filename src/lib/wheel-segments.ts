/** Wheel segment layout — must match `spin_locker_wheel` in Supabase. */

export const WHEEL_SEGMENTS = [
  { label: "25 VIBE", color: "#6366f1", text: "#e0e7ff", weight: 14 },
  { label: "100 VIBE", color: "#ec4899", text: "#fce7f3", weight: 8 },
  { label: "50 VIBE", color: "#14b8a6", text: "#ccfbf1", weight: 12 },
  { label: "500 VIBE", color: "#f59e0b", text: "#fef3c7", weight: 3 },
  { label: "10 VIBE", color: "#8b5cf6", text: "#ede9fe", weight: 16 },
  { label: "250 VIBE", color: "#06b6d4", text: "#cffafe", weight: 6 },
  { label: "75 VIBE", color: "#22c55e", text: "#dcfce7", weight: 10 },
  { label: "1000 VIBE", color: "#ef4444", text: "#fee2e2", weight: 2 },
  { label: "15 VIBE", color: "#a855f7", text: "#f3e8ff", weight: 15 },
  { label: "200 VIBE", color: "#3b82f6", text: "#dbeafe", weight: 7 },
  { label: "30 VIBE", color: "#10b981", text: "#d1fae5", weight: 13 },
  { label: "2500 JACKPOT", color: "#fbbf24", text: "#451a03", weight: 1 },
] as const;

export type WheelSegment = (typeof WHEEL_SEGMENTS)[number];

export type WheelSegmentLayout = WheelSegment & {
  index: number;
  start: number;
  end: number;
  mid: number;
  sweep: number;
};

let cachedLayout: WheelSegmentLayout[] | null = null;

export function wheelSegmentLayout(): WheelSegmentLayout[] {
  if (cachedLayout) return cachedLayout;

  const total = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
  let cursor = 0;

  cachedLayout = WHEEL_SEGMENTS.map((seg, index) => {
    const sweep = (seg.weight / total) * 360;
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;
    return { ...seg, index, start, end, mid: start + sweep / 2, sweep };
  });

  return cachedLayout;
}

/** Pointer sits at 12 o'clock; rotate the disk so the winning wedge centers there. */
export function wheelRotationToSegment(
  segmentIndex: number,
  currentRotation: number,
  extraFullSpins = 5,
): number {
  const seg = wheelSegmentLayout()[segmentIndex];
  if (!seg) throw new Error(`Invalid wheel segment index: ${segmentIndex}`);

  const targetMod = ((360 - seg.mid) % 360 + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  let delta = targetMod - currentMod;
  if (delta <= 0) delta += 360;

  return currentRotation + extraFullSpins * 360 + delta;
}

export function wheelConicGradient(): string {
  const layout = wheelSegmentLayout();
  return `conic-gradient(${layout
    .map((seg) => `${seg.color} ${seg.start}deg ${seg.end}deg`)
    .join(", ")})`;
}

export function wheelLabelFontSize(label: string, size: "panel" | "cinema"): number {
  if (label.includes("2500") || label.includes("JACKPOT")) {
    return size === "cinema" ? 10 : 9;
  }
  if (label.includes("1000")) {
    return size === "cinema" ? 12 : 11;
  }
  if (label.startsWith("500")) {
    return size === "cinema" ? 13 : 12;
  }
  return size === "cinema" ? 17 : 15;
}

export function isJackpotSegment(label: string): boolean {
  return label.includes("2500") || label.includes("JACKPOT");
}

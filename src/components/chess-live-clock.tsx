"use client";

import { useEffect, useState } from "react";

function formatClock(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ChessLiveClock({
  whiteMsLeft,
  blackMsLeft,
  clockRunningSince,
  currentTurnId,
  creatorId,
  status,
  creatorName,
  opponentName,
}: {
  whiteMsLeft: number;
  blackMsLeft: number;
  clockRunningSince: string | null;
  currentTurnId: string | null;
  creatorId: string;
  status: string;
  creatorName: string;
  opponentName: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!clockRunningSince || !currentTurnId) return;
    if (status !== "active" && status !== "matched") return;
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [clockRunningSince, currentTurnId, status]);

  void tick;

  let white = whiteMsLeft;
  let black = blackMsLeft;

  if (
    clockRunningSince &&
    currentTurnId &&
    (status === "active" || status === "matched")
  ) {
    const elapsed = Date.now() - new Date(clockRunningSince).getTime();
    if (currentTurnId === creatorId) white -= elapsed;
    else black -= elapsed;
  }

  const whiteActive = currentTurnId === creatorId;
  const blackActive = currentTurnId != null && currentTurnId !== creatorId;

  return (
    <div className="flex flex-wrap gap-3 font-mono text-sm">
      <span
        className={`rounded-md px-2 py-1 ${
          whiteActive ? "bg-stone-600/40 ring-1 ring-stone-400/50" : "bg-zinc-800/60"
        } ${white <= 10_000 ? "text-rose-400" : "text-zinc-200"}`}
      >
        {creatorName} (W) {formatClock(white)}
      </span>
      <span
        className={`rounded-md px-2 py-1 ${
          blackActive ? "bg-stone-600/40 ring-1 ring-stone-400/50" : "bg-zinc-800/60"
        } ${black <= 10_000 ? "text-rose-400" : "text-zinc-200"}`}
      >
        {opponentName} (B) {formatClock(black)}
      </span>
    </div>
  );
}

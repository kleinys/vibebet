"use client";

import { useEffect, useState } from "react";

export function FastCountdown({ windowEnd }: { windowEnd: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(windowEnd).getTime() - Date.now()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, new Date(windowEnd).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [windowEnd]);

  const totalSec = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const urgent = totalSec <= 30;

  return (
    <span
      className={
        urgent
          ? "font-mono text-lg font-semibold tabular-nums text-rose-400"
          : "font-mono text-lg font-semibold tabular-nums text-zinc-200"
      }
    >
      {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
    </span>
  );
}

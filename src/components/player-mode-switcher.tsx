"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { setPlayerPath } from "@/app/player-path/actions";
import {
  PLAYER_PATHS,
  pathFromPathname,
  type PlayerPath,
} from "@/lib/player-path";

const TONE: Record<PlayerPath, string> = {
  predict:
    "bg-fuchsia-600 text-white shadow-fuchsia-900/40 hover:bg-fuchsia-500",
  compete: "bg-violet-600 text-white shadow-violet-900/40 hover:bg-violet-500",
  watch: "bg-emerald-600 text-white shadow-emerald-900/40 hover:bg-emerald-500",
  explore: "bg-zinc-600 text-white shadow-zinc-900/40 hover:bg-zinc-500",
};

const IDLE =
  "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200";

export function PlayerModeSwitcher({
  storedPath,
}: {
  storedPath: PlayerPath;
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const routeHint = pathFromPathname(pathname);
  const active = routeHint ?? (storedPath === "explore" ? null : storedPath);

  function pick(path: PlayerPath) {
    startTransition(async () => {
      await setPlayerPath(path);
    });
  }

  return (
    <div
      className="border-b border-white/5 bg-zinc-950/95 backdrop-blur-sm"
      role="navigation"
      aria-label="Play mode"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto px-3 py-2 sm:justify-center sm:gap-2 sm:px-4">
        <span className="mr-1 hidden shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 sm:inline">
          Mode
        </span>
        {PLAYER_PATHS.map((mode) => {
          const isActive = active === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={pending}
              onClick={() => pick(mode.id)}
              title={mode.description}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:opacity-50 sm:px-4 sm:text-sm ${
                isActive ? TONE[mode.id] : IDLE
              }`}
            >
              <span aria-hidden>{mode.emoji}</span>
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

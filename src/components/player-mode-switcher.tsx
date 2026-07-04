"use client";

import Link from "next/link";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setPlayerPath } from "@/app/player-path/actions";
import { MODE_ICONS } from "@/components/fantasy-icons";
import {
  PLAYER_PATHS,
  pathFromPathname,
  type PlayerPath,
} from "@/lib/player-path";

const TONE: Record<PlayerPath, string> = {
  predict:
    "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-lg shadow-fuchsia-900/50 ring-1 ring-fuchsia-400/40 hover:from-fuchsia-500 hover:to-violet-500",
  compete:
    "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/50 ring-1 ring-violet-400/40 hover:from-violet-500 hover:to-indigo-500",
  watch:
    "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/50 ring-1 ring-emerald-400/40 hover:from-emerald-500 hover:to-teal-500",
  trainer:
    "bg-gradient-to-r from-amber-600 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/50 ring-1 ring-amber-400/40 hover:from-amber-500 hover:to-fuchsia-500",
  explore:
    "bg-zinc-700 text-white shadow-lg shadow-zinc-900/40 hover:bg-zinc-600",
};

const IDLE =
  "bg-[#0a1628]/90 text-zinc-400 ring-1 ring-white/10 hover:bg-[#111827] hover:text-zinc-100 hover:ring-white/20";

export function PlayerModeSwitcher({
  storedPath,
}: {
  storedPath: PlayerPath;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const routeHint = pathFromPathname(pathname);
  const active = routeHint ?? (storedPath === "explore" ? null : storedPath);

  function onModeClick(path: PlayerPath, href: string) {
    router.push(href);
    if (path === "trainer") return;
    startTransition(async () => {
      await setPlayerPath(path, { redirect: false });
    });
  }

  return (
    <div
      className="border-b border-violet-500/10 bg-[#020617]/95 backdrop-blur-md"
      role="navigation"
      aria-label="Play mode"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-4 sm:gap-3 sm:px-5 sm:py-4">
        {PLAYER_PATHS.map((mode) => {
          const isActive = active === mode.id;
          const Icon = MODE_ICONS[mode.id as keyof typeof MODE_ICONS];
          return (
            <Link
              key={mode.id}
              href={mode.hubHref}
              onClick={(e) => {
                e.preventDefault();
                if (!pending) onModeClick(mode.id, mode.hubHref);
              }}
              title={mode.description}
              className={`inline-flex items-center justify-center gap-2.5 rounded-sm px-3 py-3.5 text-xs font-semibold transition sm:px-4 sm:py-4 sm:text-sm ${
                isActive ? TONE[mode.id] : IDLE
              } ${pending ? "opacity-70" : ""}`}
            >
              <Icon className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
              <span className="truncate">{mode.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

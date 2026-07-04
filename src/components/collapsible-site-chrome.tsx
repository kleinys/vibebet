"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PLAYER_PATHS, pathFromPathname, type PlayerPath } from "@/lib/player-path";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "vibebet-chrome-expanded";

function CompactModePills({ storedPath }: { storedPath: PlayerPath }) {
  const pathname = usePathname();
  const routeHint = pathFromPathname(pathname);
  const active = routeHint ?? (storedPath === "explore" ? null : storedPath);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {PLAYER_PATHS.map((mode) => {
        const isActive = active === mode.id;
        return (
          <Link
            key={mode.id}
            href={mode.hubHref}
            className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold transition ${
              isActive
                ? "bg-violet-600/40 text-violet-100 ring-1 ring-violet-400/40"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            {mode.short}
          </Link>
        );
      })}
    </div>
  );
}

export function CollapsibleSiteChrome({
  storedPath,
  playerCode,
  children,
}: {
  storedPath: PlayerPath;
  playerCode: string | null;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setExpanded(true);
      if (stored === "false") setExpanded(false);
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <>
      <div className="border-b border-white/5 bg-[#020617]/98">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-5">
          {!expanded && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <CompactModePills storedPath={storedPath} />
              {playerCode && (
                <span className="font-mono text-[11px] font-medium text-violet-300/90">
                  {playerCode}
                </span>
              )}
            </div>
          )}
          {expanded && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Navigation &amp; player code
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            className="ml-auto shrink-0 rounded-sm border border-white/10 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-violet-400/30 hover:text-white"
          >
            {expanded ? "▲ Compact" : "▼ Expand"}
          </button>
        </div>
      </div>
      {expanded ? children : null}
    </>
  );
}

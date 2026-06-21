"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Gavel,
  LayoutGrid,
  Menu,
  Trophy,
  Zap,
} from "lucide-react";
import { MobileMoreSheet } from "@/components/mobile-more-sheet";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/games", label: "Live", icon: Zap, match: (p: string) => p.startsWith("/games") || p.startsWith("/markets/fast") },
  { href: "/markets", label: "Markets", icon: LayoutGrid, match: (p: string) => p === "/" || (p.startsWith("/markets") && !p.startsWith("/markets/fast")) },
  { href: "/court", label: "Court", icon: Gavel, match: (p: string) => p.startsWith("/court") },
  { href: "/leaderboard", label: "Rank", icon: Trophy, match: (p: string) => p.startsWith("/leaderboard") || p.startsWith("/tournaments") },
] as const;

export function MobileBottomNav({
  duelsOn,
  guildsOn,
  copyOn,
  limitsOn,
  tournamentsOn,
  questsOn,
  isLoggedIn,
}: {
  duelsOn: boolean;
  guildsOn: boolean;
  copyOn: boolean;
  limitsOn: boolean;
  tournamentsOn: boolean;
  questsOn: boolean;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-fuchsia-400" : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors",
              moreOpen ? "text-fuchsia-400" : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        duelsOn={duelsOn}
        guildsOn={guildsOn}
        copyOn={copyOn}
        limitsOn={limitsOn}
        tournamentsOn={tournamentsOn}
        questsOn={questsOn}
        isLoggedIn={isLoggedIn}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Gamepad2,
  LayoutGrid,
  Menu,
  Sparkles,
  Tv,
  User,
} from "lucide-react";
import { MobileMoreSheet } from "@/components/mobile-more-sheet";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/markets",
    label: "Markets",
    icon: LayoutGrid,
    match: (p: string) =>
      p === "/" || (p.startsWith("/markets") && !p.startsWith("/markets/fast")),
  },
  {
    href: "/play?tab=live",
    label: "Play",
    icon: Gamepad2,
    match: (p: string) =>
      p.startsWith("/play") ||
      p.startsWith("/games") ||
      p.startsWith("/markets/fast"),
  },
  {
    href: "/hustle",
    label: "Hustle",
    icon: Sparkles,
    match: (p: string) =>
      p.startsWith("/hustle") ||
      p.startsWith("/account/hustle") ||
      p.includes("tab=hustle"),
  },
  {
    href: "/play?tab=watch",
    label: "Watch",
    icon: Tv,
    match: (p: string) => p.startsWith("/live") || p.includes("tab=watch"),
  },
  {
    href: "/account/profile",
    label: "Profile",
    icon: User,
    match: (p: string) => p.startsWith("/account/profile"),
  },
] as const;

export function MobileBottomNav({
  duelsOn,
  guildsOn,
  copyOn,
  limitsOn,
  tournamentsOn,
  questsOn,
  isLoggedIn,
  playHubOn,
  interconnectOn,
  modulesOn,
}: {
  duelsOn: boolean;
  guildsOn: boolean;
  copyOn: boolean;
  limitsOn: boolean;
  tournamentsOn: boolean;
  questsOn: boolean;
  isLoggedIn: boolean;
  playHubOn: boolean;
  interconnectOn: boolean;
  modulesOn: boolean;
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
        <div className="mx-auto grid grid-cols-6">
          {TABS.map((tab) => {
            const href =
              interconnectOn && tab.label === "Hustle"
                ? "/hustle"
                : !playHubOn && tab.label === "Play"
                ? "/games"
                : !playHubOn && tab.label === "Hustle"
                  ? "/account/hustle"
                  : !playHubOn && tab.label === "Watch"
                    ? "/live"
                    : tab.href;
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors btn-responsive",
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
              "flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors btn-responsive",
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
        playHubOn={playHubOn}
        modulesOn={modulesOn}
      />
    </>
  );
}

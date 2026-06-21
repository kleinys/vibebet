"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function MobileMoreSheet({
  open,
  onClose,
  duelsOn,
  guildsOn,
  copyOn,
  limitsOn,
  tournamentsOn,
  questsOn,
  isLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  duelsOn: boolean;
  guildsOn: boolean;
  copyOn: boolean;
  limitsOn: boolean;
  tournamentsOn: boolean;
  questsOn: boolean;
  isLoggedIn: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const links = [
    { href: "/guide", label: "Playbook", show: true },
    { href: "/tournaments", label: "Tournaments", show: tournamentsOn },
    { href: "/account/hustle", label: "Daily Hustle", show: isLoggedIn },
    { href: "/account/quests", label: "Quests", show: isLoggedIn },
    { href: "/leaderboard/accuracy", label: "Sharp Minds", show: true },
    { href: "/duels", label: "Duels", show: duelsOn },
    { href: "/guilds", label: "Guilds", show: guildsOn },
    { href: "/copy", label: "Copy trading", show: copyOn },
    { href: "/limit-orders", label: "Limit orders", show: limitsOn && isLoggedIn },
    { href: "/shop", label: "Shop", show: true },
    { href: "/battle-pass", label: "Season Pass", show: true },
    { href: "/markets/new", label: "Create market", show: isLoggedIn },
    { href: "/onboarding", label: "Setup wizard", show: isLoggedIn },
    { href: "/invite", label: "Invite friends", show: isLoggedIn },
    { href: isLoggedIn ? "/account" : "/login", label: isLoggedIn ? "Account" : "Sign in", show: true },
  ].filter((l) => l.show);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-950 pb-[env(safe-area-inset-bottom)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">More</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-1 p-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

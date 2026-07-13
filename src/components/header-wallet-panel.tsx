"use client";

import Link from "next/link";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconGem, CurrencyIconVibe } from "@/components/fantasy-icons";
import type { StreakUrgency } from "@/lib/streak-urgency";

export function HeaderWalletPanel({
  streak,
  vibe,
  gem,
  streakUrgency: urgency,
}: {
  streak: number;
  vibe: number;
  gem: number;
  streakUrgency?: StreakUrgency | null;
}) {
  const urgent = urgency?.showTimer && urgency.hoursLeft < 4;

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-sm border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/5 transition hover:border-violet-400/30 hover:bg-zinc-900 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm [&::-webkit-details-marker]:hidden">
        <span
          className={`inline-flex items-center gap-1.5 tabular-nums ${
            urgent ? "text-rose-300" : "text-orange-300"
          }`}
          title={urgency?.showTimer ? urgency.label : undefined}
        >
          <span aria-hidden>🔥</span>
          {streak} day{streak === 1 ? "" : "s"}
          {urgency?.showTimer && (
            <span className="hidden font-normal text-rose-300/90 sm:inline">
              · {urgency.hoursLeft > 0 ? `${urgency.hoursLeft}h` : `${urgency.minutesLeft}m`}
            </span>
          )}
        </span>
        <span className="text-zinc-600" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums text-amber-200">
          <CurrencyIconVibe className="h-4 w-4 shrink-0" />
          {formatVibe(vibe)}
        </span>
        <span className="text-zinc-600" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums text-fuchsia-200">
          <CurrencyIconGem className="h-4 w-4 shrink-0" />
          {formatVibe(gem)}
        </span>
        <span className="ml-0.5 text-zinc-500 transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="absolute right-0 top-[calc(100%+8px)] z-[60] min-w-[240px] overflow-hidden rounded-sm border border-white/10 bg-zinc-950 shadow-xl shadow-black/50 ring-1 ring-violet-500/20">
        <ul className="divide-y divide-white/5 text-sm">
          <li>
            <Link
              href="/account/achievements"
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-zinc-900"
            >
              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                <span aria-hidden>🔥</span>
                <span className="sr-only">Streak</span>
              </span>
              <span className="text-right">
                <span
                  className={`block font-semibold tabular-nums ${
                    urgent ? "text-rose-300" : "text-orange-300"
                  }`}
                >
                  {streak} day{streak === 1 ? "" : "s"}
                </span>
                {urgency?.showTimer && (
                  <span className="text-[10px] text-rose-300/80">{urgency.label}</span>
                )}
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/account#wallet"
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-zinc-900"
            >
              <span className="inline-flex items-center gap-2 text-zinc-400">
                <CurrencyIconVibe className="h-4 w-4" />
                VIBE
              </span>
              <span className="font-semibold tabular-nums text-amber-200">
                {formatVibe(vibe)}
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/account#wallet"
              className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-zinc-900"
            >
              <span className="inline-flex items-center gap-2 text-zinc-400">
                <CurrencyIconGem className="h-4 w-4" />
                Gems
              </span>
              <span className="font-semibold tabular-nums text-fuchsia-200">
                {formatVibe(gem)}
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </details>
  );
}

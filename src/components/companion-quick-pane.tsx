"use client";

import Link from "next/link";
import type { CompanionInput } from "@/lib/vibe-companion";
import { resolveFigureConfig, figureLabels } from "@/lib/companion-figure";
import { VibeCompanionLink } from "@/components/vibe-companion";
import { mysticEyeStreakMode, type MysticEyeStreakMode } from "@/lib/companion-eyes";
import type { StreakUrgency } from "@/lib/streak-urgency";
import { CONSUMABLE_SLUGS } from "@/lib/consumables";

export function CompanionQuickPane({
  input,
  streakUrgency: urgency,
  adrenalineTokens = 0,
  companionName,
  eyeStreakMode,
}: {
  input: CompanionInput;
  streakUrgency?: StreakUrgency | null;
  adrenalineTokens?: number;
  companionName?: string | null;
  eyeStreakMode?: MysticEyeStreakMode;
}) {
  const config = resolveFigureConfig(input);
  const labels = figureLabels(config);
  const streakMode =
    eyeStreakMode ??
    mysticEyeStreakMode(input.currentStreak, input.lastActiveDate ?? null);

  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <VibeCompanionLink
          input={input}
          href="/account/profile"
          title="Companion quick menu"
          eyeStreakMode={streakMode}
        />
      </summary>
      <div className="absolute right-0 top-[calc(100%+8px)] z-[60] w-64 overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-xl shadow-black/50 ring-1 ring-violet-500/20">
        <div className="border-b border-white/5 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">
            {companionName ?? config.companion.name}
          </p>
          <p className="text-[10px] text-zinc-500">
            {labels.humanTitle} & {labels.animalTitle}
          </p>
        </div>
        <ul className="divide-y divide-white/5 text-sm">
          <li className="px-4 py-2.5">
            <span className="text-zinc-500">Streak</span>
            <p className="font-semibold text-orange-300">
              {input.currentStreak} day{input.currentStreak === 1 ? "" : "s"}
            </p>
            {urgency?.showTimer && (
              <p className="text-[10px] text-rose-300/90">{urgency.label}</p>
            )}
          </li>
          {adrenalineTokens > 0 && (
            <li className="px-4 py-2.5">
              <span className="text-zinc-500">
                {CONSUMABLE_SLUGS.adrenaline_token.label}
              </span>
              <p className="font-semibold text-violet-300">×{adrenalineTokens}</p>
              <p className="text-[10px] text-zinc-500">
                Use in Arcade for a boosted free spin
              </p>
            </li>
          )}
        </ul>
        <div className="flex flex-col gap-1 border-t border-white/5 p-2">
          <Link
            href="/play?tab=arcade"
            className="rounded-md px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/10"
          >
            Open Arcade →
          </Link>
          <Link
            href="/hustle"
            className="rounded-md px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
          >
            Send on expedition (Hustle) →
          </Link>
          <Link
            href="/account/profile"
            className="rounded-md px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900"
          >
            Full profile →
          </Link>
        </div>
      </div>
    </details>
  );
}

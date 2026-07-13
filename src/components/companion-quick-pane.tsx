"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { CompanionInput } from "@/lib/vibe-companion";
import { resolveFigureConfig, figureLabels } from "@/lib/companion-figure";
import { VibeCompanionLink } from "@/components/vibe-companion";
import { mysticEyeStreakMode, type MysticEyeStreakMode } from "@/lib/companion-eyes";
import type { StreakUrgency } from "@/lib/streak-urgency";
import type { CompanionExpeditionStatus } from "@/lib/companion-expedition";
import { CONSUMABLE_SLUGS } from "@/lib/consumables";
import {
  claimCompanionExpedition,
  startCompanionExpedition,
} from "@/app/companion/actions";
import { formatVibe } from "@/lib/utils";

function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Ready!";
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m left`;
}

export function CompanionQuickPane({
  input,
  streakUrgency: urgency,
  adrenalineTokens = 0,
  companionName,
  eyeStreakMode,
  expedition,
}: {
  input: CompanionInput;
  streakUrgency?: StreakUrgency | null;
  adrenalineTokens?: number;
  companionName?: string | null;
  eyeStreakMode?: MysticEyeStreakMode;
  expedition?: CompanionExpeditionStatus | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const config = resolveFigureConfig(input);
  const labels = figureLabels(config);
  const streakMode =
    eyeStreakMode ??
    mysticEyeStreakMode(input.currentStreak, input.lastActiveDate ?? null);

  function onStartExpedition() {
    startTransition(async () => {
      const r = await startCompanionExpedition();
      if (r.error) toast.error(r.error);
      else {
        toast.success("Companion sent on expedition — check back in ~30m");
        router.refresh();
      }
    });
  }

  function onClaimExpedition() {
    startTransition(async () => {
      const r = await claimCompanionExpedition();
      if (r.error) toast.error(r.error);
      else {
        toast.success(
          r.claimed_vibe
            ? `+${formatVibe(r.claimed_vibe)} VIBE from expedition`
            : "Expedition reward claimed",
        );
        router.refresh();
      }
    });
  }

  return (
    <details
      className="group relative"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
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
          {!companionName && (
            <Link
              href="/account/profile"
              className="mt-2 inline-block text-[10px] font-medium text-violet-300 hover:text-violet-200"
            >
              Name your companion →
            </Link>
          )}
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
          {expedition && (
            <li className="px-4 py-2.5">
              <span className="text-zinc-500">Expedition</span>
              {expedition.can_claim ? (
                <>
                  <p className="font-semibold text-amber-300">
                    Ready — {formatVibe(expedition.reward_vibe ?? 0)} VIBE
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onClaimExpedition}
                    className="mt-1 text-[11px] font-medium text-amber-200 hover:text-amber-100"
                  >
                    Claim reward →
                  </button>
                </>
              ) : expedition.active && expedition.ends_at ? (
                <p className="text-xs text-zinc-300">
                  Away scouting… {formatCountdown(expedition.ends_at)}
                </p>
              ) : expedition.can_start ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={onStartExpedition}
                  className="mt-0.5 text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                >
                  Send on expedition (30m) →
                </button>
              ) : expedition.cooldown_ends_at ? (
                <p className="text-xs text-zinc-500">
                  Resting until{" "}
                  {new Date(expedition.cooldown_ends_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
            </li>
          )}
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
            Hustle earn loop →
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

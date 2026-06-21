"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import type { GuildQuestStatus } from "@/lib/guild-quest";
import { claimGuildQuestReward } from "./quest-actions";

export function GuildQuestPanel({ quest }: { quest: GuildQuestStatus }) {
  const [pending, startTransition] = useTransition();

  if (!quest.enabled) return null;

  if (!quest.inGuild) {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h2 className="text-sm font-semibold text-amber-100">Weekly guild quest</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Join a guild to work toward a collective {formatVibe(quest.targetVolume)} VIBE
          betting goal and earn {formatVibe(quest.rewardVibe)} when your crew hits it.
        </p>
      </div>
    );
  }

  const pct = Math.min(
    100,
    Math.round((quest.currentVolume / quest.targetVolume) * 100),
  );

  return (
    <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">Weekly guild quest</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Pool bets with your guild — hit {formatVibe(quest.targetVolume)} VIBE volume
            this week. Each member claims {formatVibe(quest.rewardVibe)} once.
          </p>
        </div>
        {quest.completed && !quest.claimed && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await claimGuildQuestReward();
                if (r.error) toast.error(r.error);
                else toast.success(`+${formatVibe(quest.rewardVibe)} VIBE claimed!`);
              })
            }
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {pending ? "Claiming…" : "Claim reward"}
          </button>
        )}
        {quest.claimed && (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
            Claimed this week
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>{formatVibe(quest.currentVolume)} / {formatVibe(quest.targetVolume)} VIBE</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

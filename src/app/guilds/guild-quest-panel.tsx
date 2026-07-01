"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import type { GuildQuestStatus } from "@/lib/guild-quest";
import { claimGuildQuestReward, contributeToGuildPot } from "./quest-actions";

const POT_PRESETS = [50, 100, 250, 500] as const;

export function GuildQuestPanel({ quest }: { quest: GuildQuestStatus }) {
  const [pending, startTransition] = useTransition();
  const [customPot, setCustomPot] = useState("100");

  if (!quest.enabled) return null;

  if (!quest.inGuild) {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h2 className="text-sm font-semibold text-amber-100">Team pot — weekly quest</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Join a guild to pool VIBE with your crew. Hit {formatVibe(quest.targetVolume)}{" "}
          combined volume and earn {formatVibe(quest.rewardVibe)} each when the team pot
          fills.
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
          <h2 className="text-sm font-semibold text-amber-100">Team pot — weekly quest</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Shared stakes: everyone&apos;s bets and pot contributions count toward{" "}
            {formatVibe(quest.targetVolume)} VIBE. One reckless miss hurts the whole
            crew — claim {formatVibe(quest.rewardVibe)} when you hit the goal.
          </p>
          {quest.potContributed > 0 && (
            <p className="mt-2 text-xs text-amber-200/90">
              Team pot contributions this week: {formatVibe(quest.potContributed)} VIBE
            </p>
          )}
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
          <span>
            {formatVibe(quest.currentVolume)} / {formatVibe(quest.targetVolume)} VIBE
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!quest.completed && (
        <div className="mt-5 border-t border-amber-500/15 pt-4">
          <p className="text-xs font-medium text-amber-100/90">Contribute to team pot</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            Put VIBE in the shared pot — counts toward the weekly goal. Everyone wins or
            loses together.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {POT_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await contributeToGuildPot(n);
                    if (r.error) toast.error(r.error);
                    else toast.success(`+${formatVibe(n)} VIBE added to team pot`);
                  })
                }
                className="rounded-md bg-amber-600/30 px-3 py-1.5 text-xs font-medium text-amber-100 ring-1 ring-amber-500/30 hover:bg-amber-500/40 disabled:opacity-50"
              >
                {formatVibe(n)}
              </button>
            ))}
          </div>
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number.parseInt(customPot, 10);
              if (!Number.isFinite(amount) || amount < 10) {
                toast.error("Enter at least 10 VIBE");
                return;
              }
              startTransition(async () => {
                const r = await contributeToGuildPot(amount);
                if (r.error) toast.error(r.error);
                else toast.success(`+${formatVibe(amount)} VIBE added to team pot`);
              });
            }}
          >
            <label className="text-xs text-zinc-400">
              Custom
              <input
                type="number"
                min={10}
                max={50000}
                value={customPot}
                onChange={(e) => setCustomPot(e.target.value)}
                className="ml-2 w-24 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              Contribute
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

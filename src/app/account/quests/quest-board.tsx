"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import type { WeeklyQuest } from "@/lib/quests";
import { claimQuest } from "./actions";

export function QuestBoard({ quests }: { quests: WeeklyQuest[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {quests.map((q) => (
        <QuestRow key={q.quest_id} quest={q} />
      ))}
    </ul>
  );
}

function QuestRow({ quest: q }: { quest: WeeklyQuest }) {
  const [pending, startTransition] = useTransition();
  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));

  return (
    <li className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-100">{q.title}</p>
          <p className="mt-1 text-xs text-zinc-400">{q.description}</p>
          <p className="mt-2 text-xs text-amber-200">
            Reward: {formatVibe(q.reward_vibe)} VIBE
          </p>
        </div>
        {q.claimed ? (
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
            Claimed
          </span>
        ) : q.completed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await claimQuest(q.quest_id);
                if (result.error) toast.error(result.error);
                else toast.success(`+${formatVibe(result.reward ?? 0)} VIBE!`);
              });
            }}
            className="rounded-md bg-fuchsia-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            Claim
          </button>
        ) : (
          <span className="text-xs tabular-nums text-zinc-500">
            {q.progress}/{q.target}
          </span>
        )}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-fuchsia-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

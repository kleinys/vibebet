"use client";

import { useTransition } from "react";
import { claimDailyHustleReward } from "@/app/account/hustle/actions";
import type { DailyHustleTask } from "@/lib/daily-hustle";
import { formatVibe } from "@/lib/utils";

export function DailyHustleBoard({ tasks }: { tasks: DailyHustleTask[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <ul className="mt-6 space-y-3">
      {tasks.map((task) => (
        <li
          key={task.task_id}
          className="rounded-xl border border-white/5 bg-zinc-900/40 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-100">{task.title}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{task.description}</p>
              <p className="mt-2 text-xs text-amber-200">
                +{formatVibe(task.reward_vibe)} VIBE
              </p>
            </div>
            <div className="text-right text-sm tabular-nums text-zinc-300">
              {task.progress}/{task.target}
            </div>
          </div>

          {task.completed && !task.claimed && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await claimDailyHustleReward(task.task_id);
                })
              }
              className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
            >
              Claim reward
            </button>
          )}

          {task.claimed && (
            <p className="mt-2 text-xs text-emerald-300">Claimed today ✓</p>
          )}
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useActionState } from "react";
import {
  claimTierAction,
  unlockPremiumAction,
  type BattlePassState,
} from "@/app/battle-pass/actions";
import type { BattlePassProgress, BattlePassSeason } from "@/lib/battle-pass";
import { formatVibe } from "@/lib/utils";

export function BattlePassClient({
  season,
  progress,
}: {
  season: BattlePassSeason;
  progress: BattlePassProgress;
}) {
  const [claimState, claimAction, claiming] = useActionState<
    BattlePassState,
    FormData
  >(claimTierAction, null);
  const [premiumState, premiumAction, unlocking] = useActionState<
    BattlePassState,
    FormData
  >(async () => unlockPremiumAction(), null);

  const xpInTier = progress.xp % season.xp_per_tier;
  const pct = Math.round((xpInTier / season.xp_per_tier) * 100);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
        <div className="flex justify-between text-sm">
          <span>
            Tier {progress.tier} / {season.max_tier}
          </span>
          <span className="text-zinc-400">{progress.xp} XP</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-fuchsia-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!progress.premium_unlocked && (
        <form action={premiumAction}>
          <button
            type="submit"
            disabled={unlocking}
            className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
          >
            {unlocking ? "Unlocking…" : "Unlock premium track (500 Gems)"}
          </button>
          {premiumState?.error && (
            <p className="mt-2 text-xs text-red-300">{premiumState.error}</p>
          )}
        </form>
      )}

      {claimState?.ok && (
        <p className="text-sm text-emerald-300">{claimState.ok}</p>
      )}
      {claimState?.error && (
        <p className="text-sm text-red-300">{claimState.error}</p>
      )}

      <ul className="space-y-2">
        {Array.from({ length: Math.min(season.max_tier, 10) }, (_, i) => {
          const tier = i + 1;
          const unlocked = progress.tier >= tier;
          const freeClaimed = progress.claimed_free.includes(tier);
          const premClaimed = progress.claimed_premium.includes(tier);
          const freeReward = 10 + tier * 3;
          const premReward = 25 + tier * 5;

          return (
            <li
              key={tier}
              className={`rounded-lg border p-3 ${
                unlocked
                  ? "border-white/10 bg-zinc-900/30"
                  : "border-white/5 opacity-50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Tier {tier}</span>
                <div className="flex gap-2">
                  {unlocked && !freeClaimed && (
                    <form action={claimAction}>
                      <input type="hidden" name="tier" value={tier} />
                      <input type="hidden" name="premium" value="no" />
                      <button
                        type="submit"
                        disabled={claiming}
                        className="rounded bg-emerald-600/80 px-2 py-1 text-xs text-white disabled:opacity-50"
                      >
                        Free {formatVibe(freeReward)}
                      </button>
                    </form>
                  )}
                  {unlocked &&
                    progress.premium_unlocked &&
                    !premClaimed && (
                      <form action={claimAction}>
                        <input type="hidden" name="tier" value={tier} />
                        <input type="hidden" name="premium" value="yes" />
                        <button
                          type="submit"
                          disabled={claiming}
                          className="rounded bg-fuchsia-600/80 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          Premium {formatVibe(premReward)}
                        </button>
                      </form>
                    )}
                  {freeClaimed && (
                    <span className="text-xs text-zinc-500">Free claimed</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {season.max_tier > 10 && (
        <p className="text-xs text-zinc-500">
          Showing tiers 1–10. More tiers unlock as you earn XP.
        </p>
      )}
    </div>
  );
}

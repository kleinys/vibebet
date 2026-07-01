"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { MatchmakingButton } from "@/components/matchmaking-button";
import { WinSharePanel } from "@/components/win-share-panel";
import type { ShareProfile } from "@/lib/share-profile";
import {
  acceptDiceDuel,
  cancelDiceDuel,
  createDiceDuel,
  playCoinFlip,
} from "./actions";

export function CoinFlipPanel({ shareProfile }: { shareProfile: ShareProfile }) {
  const [state, action, pending] = useActionState(playCoinFlip, null);

  return (
    <form action={action} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      <h2 className="text-sm font-semibold text-amber-100">Coin flip</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Pick heads or tails. Win = 1.8× your stake (10% house edge).
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="side" value="heads" defaultChecked /> Heads
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="side" value="tails" /> Tails
        </label>
        <input
          name="stake"
          type="number"
          min={10}
          max={10000}
          defaultValue={50}
          className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {pending ? "Flipping…" : "Flip"}
        </button>
      </div>
      {state?.error && <p className="mt-3 text-xs text-rose-300">{state.error}</p>}
      {state?.result && (
        <p className="mt-3 text-xs text-emerald-300">{state.result}</p>
      )}
      {state?.won && (
        <WinSharePanel
          displayName={shareProfile.displayName}
          username={shareProfile.username}
          headline="Won a coin flip on Vibebet"
        />
      )}
    </form>
  );
}

export function DiceDuelPanel({
  openDuels,
  userId,
  shareProfile,
}: {
  openDuels: {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
  }[];
  userId: string;
  shareProfile: ShareProfile;
}) {
  const [createState, createAction, createPending] = useActionState(createDiceDuel, null);
  const [pending, startTransition] = useTransition();
  const [showWinShare, setShowWinShare] = useState(false);

  return (
    <div className="space-y-4">
      <form
        action={createAction}
        className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-sky-100">Dice duel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          2d6 vs 2d6. Winner takes 90% of the pool. Ties reroll once.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            name="stake"
            type="number"
            min={10}
            max={10000}
            defaultValue={100}
            id="dice-stake"
            className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Post open duel
          </button>
          <MatchmakingButton gameKey="dice" stakeInputId="dice-stake" defaultStake={100} />
        </div>
        {createState?.error && (
          <p className="mt-2 text-xs text-rose-300">{createState.error}</p>
        )}
        {createState?.ok && (
          <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>
        )}
      </form>

      {openDuels.length > 0 && (
        <ul className="space-y-2">
          {openDuels.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm"
            >
              <p>
                {d.creator_name} · {d.stake} VIBE
              </p>
              {d.creator_id !== userId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await acceptDiceDuel(d.id);
                      if (r.error) toast.error(r.error);
                      else {
                        toast.success(r.ok ?? "Done!");
                        setShowWinShare(!!r.won);
                      }
                    })
                  }
                  className="mt-2 rounded-md bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-500"
                >
                  Roll against them
                </button>
              )}
              {d.creator_id === userId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await cancelDiceDuel(d.id);
                      if (r.error) toast.error(r.error);
                      else toast.success("Cancelled");
                    })
                  }
                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {showWinShare && (
        <WinSharePanel
          displayName={shareProfile.displayName}
          username={shareProfile.username}
          headline="Won a dice duel on Vibebet"
        />
      )}
    </div>
  );
}

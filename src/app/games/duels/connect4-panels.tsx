"use client";

import { useRouter } from "next/navigation";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { FriendChallengeFields } from "@/components/friend-challenge-fields";
import {
  acceptConnect4Game,
  cancelConnect4Game,
  createConnect4Game,
} from "./connect4-actions";

type OpenGame = {
  id: string;
  creator_id: string;
  creator_name: string;
  stake: number;
  is_friendly: boolean;
  invited_user_id: string | null;
};

export function Connect4Panel({
  openGames,
  userId,
}: {
  openGames: OpenGame[];
  userId: string;
}) {
  const [createState, createAction, createPending] = useActionState(createConnect4Game, null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-indigo-100">Post Connect Four</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Drop discs — connect 4 in a row to win. 90% of the pool to the winner.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            name="stake"
            type="number"
            min={10}
            max={10000}
            defaultValue={100}
            className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {createPending ? "Posting…" : "Post game"}
          </button>
        </div>
        <FriendChallengeFields stakeInputName="stake" />
        {createState?.error && <p className="mt-2 text-xs text-rose-300">{createState.error}</p>}
        {createState?.ok && <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>}
      </form>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Open games
        </h3>
        {openGames.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No open games — post one above.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {openGames.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm"
              >
                <span>
                  {g.creator_name}
                  {g.is_friendly ? (
                    <span className="ml-2 text-[10px] text-sky-400">friendly · free</span>
                  ) : (
                    <> · {g.stake} VIBE</>
                  )}
                  {g.invited_user_id && (
                    <span className="ml-2 text-[10px] text-violet-400">direct invite</span>
                  )}
                </span>
                {g.creator_id !== userId ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await acceptConnect4Game(g.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Game started!");
                          router.push(`/games/duels/connect4/${g.id}`);
                        }
                      })
                    }
                    className="rounded-md bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500"
                  >
                    Join &amp; play
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await cancelConnect4Game(g.id);
                        if (r.error) toast.error(r.error);
                        else toast.success("Cancelled");
                      })
                    }
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

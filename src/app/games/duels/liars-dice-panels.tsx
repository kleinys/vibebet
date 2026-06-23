"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { FriendChallengeFields } from "@/components/friend-challenge-fields";
import {
  acceptLiarsDiceGame,
  cancelLiarsDiceGame,
  createLiarsDiceGame,
} from "./liars-dice-actions";

type OpenGame = {
  id: string;
  creator_id: string;
  creator_name: string;
  stake: number;
  is_friendly: boolean;
  invited_user_id: string | null;
};

export function LiarsDicePanel({
  openGames,
  userId,
}: {
  openGames: OpenGame[];
  userId: string;
}) {
  const [createState, createAction, createPending] = useActionState(createLiarsDiceGame, null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-amber-100">Post Liar&apos;s Dice</h2>
        <p className="mt-1 text-xs text-zinc-400">
          5 dice each. Raise bids on face values (1s wild) or call &quot;Liar!&quot; Winner takes
          90% of the pool.
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
            className="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
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
                </span>
                {g.creator_id !== userId ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await acceptLiarsDiceGame(g.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Game started!");
                          router.push(`/games/duels/liars-dice/${g.id}`);
                        }
                      })
                    }
                    className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-500"
                  >
                    Join
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await cancelLiarsDiceGame(g.id);
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

export function LiarsDicePlayPanel({
  gameId,
  myDice,
  bidQuantity,
  bidFace,
  currentTurnId,
  userId,
  lastBidderId,
  status,
  winnerId,
  creatorDice,
  opponentDice,
}: {
  gameId: string;
  myDice: number[] | null;
  bidQuantity: number | null;
  bidFace: number | null;
  currentTurnId: string | null;
  userId: string;
  lastBidderId: string | null;
  status: string;
  winnerId: string | null;
  creatorDice: number[] | null;
  opponentDice: number[] | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(bidQuantity ? bidQuantity + 1 : 1);
  const [face, setFace] = useState(1);
  const isMyTurn = status === "active" && currentTurnId === userId;
  const canCallLiar =
    isMyTurn && bidQuantity != null && lastBidderId != null && lastBidderId !== userId;

  const bid = () => {
    if (!isMyTurn || pending) return;
    startTransition(async () => {
      const { placeLiarsDiceBid } = await import("./liars-dice-actions");
      const r = await placeLiarsDiceBid(gameId, qty, face);
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.ok ?? "Bid placed");
        router.refresh();
      }
    });
  };

  const callLiar = () => {
    if (!canCallLiar || pending) return;
    startTransition(async () => {
      const { callLiarsDice } = await import("./liars-dice-actions");
      const r = await callLiarsDice(gameId);
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.ok ?? "Game over!");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {status === "active" && myDice && (
        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Your dice</p>
          <p className="mt-2 flex gap-2 text-2xl">
            {myDice.map((d, i) => (
              <span key={i} className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                {d}
              </span>
            ))}
          </p>
          <p className="mt-2 text-xs text-zinc-500">1s count as wild for all faces.</p>
        </div>
      )}

      {bidQuantity != null && bidFace != null && status === "active" && (
        <p className="text-sm text-zinc-300">
          Current bid: <strong>{bidQuantity}</strong> dice showing <strong>{bidFace}</strong>
          {bidFace === 1 ? "" : " (or 1s)"}
        </p>
      )}

      {status === "active" && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? (
            <span className="text-emerald-300">Your turn</span>
          ) : (
            "Waiting for opponent…"
          )}
        </p>
      )}

      {status === "settled" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
          <p className="text-emerald-200">
            {winnerId === userId ? "You won!" : winnerId ? "You lost." : "Game over."}
          </p>
          {creatorDice && opponentDice && (
            <p className="mt-2 text-xs text-zinc-400">
              Revealed — Creator: [{creatorDice.join(", ")}] · Opponent: [
              {opponentDice.join(", ")}]
            </p>
          )}
        </div>
      )}

      {isMyTurn && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-zinc-400">
            Qty
            <input
              type="number"
              min={1}
              max={10}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="mt-1 block w-16 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Face
            <select
              value={face}
              onChange={(e) => setFace(Number(e.target.value))}
              className="mt-1 block rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={bid}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Raise bid
          </button>
          {canCallLiar && (
            <button
              type="button"
              disabled={pending}
              onClick={callLiar}
              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              Liar!
            </button>
          )}
        </div>
      )}
    </div>
  );
}

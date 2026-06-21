"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { MatchmakingButton } from "@/components/matchmaking-button";
import { FriendChallengeFields } from "@/components/friend-challenge-fields";
import {
  acceptHighCardDuel,
  acceptRpsDuel,
  cancelHighCardDuel,
  cancelRpsDuel,
  createHighCardDuel,
  createRpsDuel,
} from "./actions";

type OpenDuel = {
  id: string;
  creator_id: string;
  creator_name: string;
  stake: number;
  is_friendly?: boolean;
  invited_user_id?: string | null;
};

function OpenDuelList({
  duels,
  userId,
  onAccept,
  onCancel,
  acceptLabel,
}: {
  duels: OpenDuel[];
  userId: string;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  acceptLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  if (duels.length === 0) {
    return <p className="text-xs text-zinc-500">No open duels right now — post one below.</p>;
  }

  return (
    <ul className="space-y-2">
      {duels.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-zinc-900/40 p-3 text-sm"
        >
          <span>
            {d.creator_name}
            {d.is_friendly ? (
              <span className="ml-2 text-[10px] text-sky-400">friendly · free</span>
            ) : (
              <>
                {" "}
                · <strong>{d.stake}</strong> VIBE
              </>
            )}
            {d.invited_user_id && (
              <span className="ml-2 text-[10px] text-violet-400">direct invite</span>
            )}
          </span>
          {d.creator_id !== userId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  onAccept(d.id);
                })
              }
              className="rounded-md bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {acceptLabel}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  onCancel(d.id);
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
  );
}

export function RpsDuelPanel({
  openDuels,
  userId,
}: {
  openDuels: OpenDuel[];
  userId: string;
}) {
  const [createState, createAction, createPending] = useActionState(createRpsDuel, null);
  const [move, setMove] = useState<"rock" | "paper" | "scissors">("rock");

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-violet-100">Post RPS duel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Your move is hidden until someone accepts. Draw = both refunded.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {(["rock", "paper", "scissors"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm capitalize">
              <input
                type="radio"
                name="move"
                value={m}
                checked={move === m}
                onChange={() => setMove(m)}
              />
              {m}
            </label>
          ))}
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
            disabled={createPending}
            className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {createPending ? "Posting…" : "Post duel"}
          </button>
        </div>
        <FriendChallengeFields stakeInputName="stake" />
        {createState?.error && <p className="mt-2 text-xs text-rose-300">{createState.error}</p>}
        {createState?.ok && <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>}
      </form>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Open challenges
        </h3>
        <div className="mt-2">
          <OpenDuelList
            duels={openDuels}
            userId={userId}
            acceptLabel="Accept & pick move"
            onAccept={async (id) => {
              const r = await acceptRpsDuel(id, move);
              if (r.error) toast.error(r.error);
              else toast.success(r.ok ?? "Done");
            }}
            onCancel={async (id) => {
              const r = await cancelRpsDuel(id);
              if (r.error) toast.error(r.error);
              else toast.success("Cancelled");
            }}
          />
        </div>
      </section>
    </div>
  );
}

export function HighCardDuelPanel({
  openDuels,
  userId,
}: {
  openDuels: OpenDuel[];
  userId: string;
}) {
  const [createState, createAction, createPending] = useActionState(createHighCardDuel, null);

  return (
    <div className="space-y-6">
      <form
        action={createAction}
        className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5"
      >
        <h2 className="text-sm font-semibold text-sky-100">Post High Card duel</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Each player draws 1–13. Higher card wins 90% of the pool.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            name="stake"
            type="number"
            min={10}
            max={10000}
            defaultValue={100}
            id="hc-stake"
            className="w-24 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={createPending}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Post open duel
          </button>
          <MatchmakingButton gameKey="high_card" stakeInputId="hc-stake" defaultStake={100} />
        </div>
        {createState?.error && <p className="mt-2 text-xs text-rose-300">{createState.error}</p>}
        {createState?.ok && <p className="mt-2 text-xs text-emerald-300">{createState.ok}</p>}
      </form>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Open challenges
        </h3>
        <div className="mt-2">
          <OpenDuelList
            duels={openDuels}
            userId={userId}
            acceptLabel="Draw cards"
            onAccept={async (id) => {
              const r = await acceptHighCardDuel(id);
              if (r.error) toast.error(r.error);
              else toast.success(r.ok ?? "Done");
            }}
            onCancel={async (id) => {
              const r = await cancelHighCardDuel(id);
              if (r.error) toast.error(r.error);
              else toast.success("Cancelled");
            }}
          />
        </div>
      </section>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { PokerState } from "@/lib/poker-holdem";
import { advancePokerGame } from "./poker-actions";

function CardRow({ cards, label }: { cards: string[]; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 text-zinc-500">{label}</span>
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="inline-flex h-10 w-8 items-center justify-center rounded border border-white/10 bg-zinc-900 font-mono text-xs"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PokerBoard({
  gameId,
  state,
  status,
  winnerId,
  userId,
  creatorId,
  creatorHandRank,
  opponentHandRank,
}: {
  gameId: string;
  state: PokerState | null;
  status: string;
  winnerId: string | null;
  userId: string;
  creatorId: string;
  creatorHandRank?: string | null;
  opponentHandRank?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!state) return <p className="text-sm text-zinc-400">Waiting for opponent…</p>;

  const phaseLabel =
    state.phase === "preflop"
      ? "Pre-flop"
      : state.phase === "flop"
        ? "Flop"
        : state.phase === "turn"
          ? "Turn"
          : state.phase === "river"
            ? "River"
            : "Showdown";

  return (
    <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <p className="text-sm text-zinc-300">
        Phase: <strong>{phaseLabel}</strong>
        {" · "}
        You are {userId === creatorId ? "Player 1" : "Player 2"}
      </p>

      <CardRow cards={state.hole.creator} label="Player 1" />
      <CardRow cards={state.hole.opponent} label="Player 2" />
      {state.community.length > 0 && (
        <CardRow cards={state.community} label="Board" />
      )}

      {status === "active" && state.phase !== "showdown" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await advancePokerGame(gameId);
              if (r.error) toast.error(r.error);
              else {
                if (r.settled) toast.success("Showdown!");
                router.refresh();
              }
            })
          }
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending
            ? "Dealing…"
            : state.phase === "preflop"
              ? "Deal flop"
              : state.phase === "flop"
                ? "Deal turn"
                : state.phase === "turn"
                  ? "Deal river"
                  : "Showdown"}
        </button>
      )}

      {(status === "settled" || status === "draw") && (
        <div className="text-sm text-zinc-300">
          <p>Player 1: {creatorHandRank}</p>
          <p>Player 2: {opponentHandRank}</p>
          {winnerId && (
            <p className="mt-2 text-emerald-300">
              {winnerId === userId ? "You won the pot!" : "You lost."}
            </p>
          )}
          {status === "draw" && <p className="mt-2 text-zinc-400">Split pot — tie hand.</p>}
        </div>
      )}
    </div>
  );
}

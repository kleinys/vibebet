"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { GO_BOARD_SIZE } from "@/lib/go-engine";
import { passGoGame, playGoMove, resignGoGame } from "./go-actions";
import type { GoCell } from "@/lib/go-engine";

export function GoBoard({
  gameId,
  board,
  currentTurnId,
  userId,
  creatorId,
  status,
  winnerId,
  blackScore,
  whiteScore,
}: {
  gameId: string;
  board: GoCell[];
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
  blackScore?: number | null;
  whiteScore?: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isMyTurn = status === "active" && currentTurnId === userId;

  const play = (idx: number) => {
    if (!isMyTurn || pending) return;
    startTransition(async () => {
      const r = await playGoMove(gameId, idx);
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {status === "active" && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? <span className="text-emerald-300">Your turn</span> : "Waiting…"}
          {" · "}
          {userId === creatorId ? "Black" : "White"}
        </p>
      )}
      {(status === "settled" || status === "draw") && blackScore != null && (
        <p className="text-sm text-zinc-300">
          Score — Black {blackScore} : White {whiteScore} (6.5 komi)
          {winnerId && (
            <span className="ml-2 text-emerald-300">
              {winnerId === userId ? "You won!" : "You lost."}
            </span>
          )}
        </p>
      )}

      <div
        className="inline-grid gap-px rounded-xl border border-white/10 bg-zinc-800 p-2"
        style={{ gridTemplateColumns: `repeat(${GO_BOARD_SIZE}, minmax(0, 1fr))` }}
      >
        {board.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            disabled={!isMyTurn || pending || cell !== 0}
            onClick={() => play(idx)}
            className="h-8 w-8 rounded-full border border-zinc-600 bg-amber-100/10 disabled:cursor-default"
          >
            {cell === 1 ? "⚫" : cell === 2 ? "⚪" : ""}
          </button>
        ))}
      </div>

      {status === "active" && isMyTurn && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await passGoGame(gameId);
                if (r.error) toast.error(r.error);
                else {
                  if (r.settled) toast.success("Game scored");
                  router.refresh();
                }
              })
            }
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Pass
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await resignGoGame(gameId);
                if (r.error) toast.error(r.error);
                else router.refresh();
              })
            }
            className="text-xs text-rose-400 hover:underline"
          >
            Resign
          </button>
        </div>
      )}
    </div>
  );
}

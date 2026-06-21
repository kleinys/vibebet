"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { playConnect4Move } from "./connect4-actions";

const COLORS = ["bg-zinc-800/80", "bg-rose-500", "bg-amber-400"];

export function Connect4Board({
  gameId,
  board,
  currentTurnId,
  userId,
  creatorId,
  status,
  winnerId,
}: {
  gameId: string;
  board: number[];
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const myPiece = userId === creatorId ? 1 : 2;
  const isMyTurn = status === "active" && currentTurnId === userId;

  const drop = (col: number) => {
    if (!isMyTurn || pending) return;
    startTransition(async () => {
      const r = await playConnect4Move(gameId, col);
      if (r.error) toast.error(r.error);
      else {
        if (r.settled) toast.success(r.ok ?? "Done");
        router.refresh();
      }
    });
  };

  const cells: number[][] = [];
  for (let r = 0; r < 6; r++) {
    cells[r] = [];
    for (let c = 0; c < 7; c++) {
      cells[r][c] = board[r * 7 + c] ?? 0;
    }
  }

  return (
    <div className="space-y-3">
      {status === "active" && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? (
            <span className="text-emerald-300">Your turn</span>
          ) : (
            "Waiting for opponent…"
          )}
          {" · "}
          You are{" "}
          <span className={myPiece === 1 ? "text-rose-400" : "text-amber-400"}>
            {myPiece === 1 ? "Red" : "Yellow"}
          </span>
        </p>
      )}
      {status === "settled" && winnerId && (
        <p className="text-sm text-emerald-300">
          {winnerId === userId ? "You won!" : "You lost."}
        </p>
      )}
      {status === "draw" && <p className="text-sm text-zinc-400">Draw game.</p>}

      <div className="inline-block rounded-xl border border-white/10 bg-zinc-950 p-2">
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, col) => (
            <button
              key={`btn-${col}`}
              type="button"
              disabled={!isMyTurn || pending}
              onClick={() => drop(col)}
              className="h-6 rounded-md bg-zinc-800 text-[10px] text-zinc-500 hover:bg-zinc-700 disabled:opacity-30"
              aria-label={`Drop column ${col + 1}`}
            >
              ▼
            </button>
          ))}
          {cells.map((row, ri) =>
            row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className={`h-10 w-10 rounded-full ${COLORS[cell] ?? COLORS[0]} border border-white/5`}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

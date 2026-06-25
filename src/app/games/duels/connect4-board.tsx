"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  acceptConnect4Draw,
  declineConnect4Draw,
  leaveConnect4Game,
  offerConnect4Draw,
  playConnect4Move,
  resignConnect4Game,
} from "./connect4-actions";

const COLORS = ["bg-zinc-800/80", "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]", "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"];

export function Connect4Board({
  gameId,
  board,
  currentTurnId,
  userId,
  creatorId,
  status,
  winnerId,
  moveCount = 0,
  drawOfferedBy,
  isSpectator = false,
}: {
  gameId: string;
  board: number[];
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
  moveCount?: number;
  drawOfferedBy?: string | null;
  isSpectator?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const myPiece = userId === creatorId ? 1 : 2;
  const inPlay = status === "active" || status === "matched";
  const isLocked = status === "active";
  const isMyTurn = inPlay && !isSpectator && currentTurnId === userId;
  const drawPending = drawOfferedBy && drawOfferedBy !== userId;
  const iOfferedDraw = drawOfferedBy === userId;

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

  const run = (fn: () => Promise<{ error?: string; ok?: string; settled?: boolean; left?: boolean }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.ok ?? "Done");
        if (r.left) router.push("/games/duels/connect4");
        else router.refresh();
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
      {isSpectator && inPlay && (
        <p className="text-sm text-violet-300">Spectating — board updates when players move.</p>
      )}
      {inPlay && !isSpectator && (
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
          {!isLocked && moveCount < 2 && (
            <span className="ml-2 text-amber-300/90">· Warm-up ({moveCount}/2 until locked)</span>
          )}
        </p>
      )}
      {status === "settled" && winnerId && !isSpectator && (
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
              disabled={isSpectator || !isMyTurn || pending}
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
                className={`h-10 w-10 rounded-full ${COLORS[cell] ?? COLORS[0]} border border-white/10`}
              />
            )),
          )}
        </div>
      </div>

      {!isSpectator && inPlay && (
        <div className="flex flex-wrap gap-2">
          {status === "matched" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => leaveConnect4Game(gameId))}
              className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Leave (before lock)
            </button>
          )}
          {isLocked && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => resignConnect4Game(gameId))}
                className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
              >
                Resign
              </button>
              {!drawOfferedBy && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => offerConnect4Draw(gameId))}
                  className="rounded-md border border-sky-500/40 px-3 py-1.5 text-xs text-sky-300 hover:bg-sky-500/10"
                >
                  Offer draw
                </button>
              )}
              {iOfferedDraw && (
                <span className="self-center text-xs text-zinc-500">Draw offer sent…</span>
              )}
              {drawPending && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => acceptConnect4Draw(gameId))}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500"
                  >
                    Accept draw
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => declineConnect4Draw(gameId))}
                    className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                  >
                    Decline
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

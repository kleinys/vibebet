"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  acceptChessDraw,
  declineChessDraw,
  leaveChessGame,
  offerChessDraw,
  playChessBotMove,
  playChessMove,
  resignChessGame,
} from "./chess-actions";

const PIECES: Record<string, string> = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};

function pieceClass(piece: string) {
  const isWhite = piece === piece.toUpperCase();
  if (isWhite) {
    return "text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]";
  }
  return "text-[#1a1a1a] drop-shadow-[0_0_2px_rgba(255,255,255,0.85)]";
}

function parseFenBoard(fen: string): (string | null)[][] {
  const rows = fen.split(" ")[0].split("/");
  return rows.map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch, 10); i++) cells.push(null);
      } else cells.push(ch);
    }
    return cells;
  });
}

export function ChessBoard({
  gameId,
  fen,
  currentTurnId,
  userId,
  creatorId,
  status,
  winnerId,
  moveCount = 0,
  drawOfferedBy,
  isSpectator = false,
  botUserId = null,
  opponentId = null,
}: {
  gameId: string;
  fen: string;
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
  moveCount?: number;
  drawOfferedBy?: string | null;
  isSpectator?: boolean;
  botUserId?: string | null;
  opponentId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const inPlay = status === "active" || status === "matched";
  const isLocked = status === "active";
  const isMyTurn = inPlay && !isSpectator && currentTurnId === userId;
  const isBotTurn =
    inPlay &&
    !isSpectator &&
    !!botUserId &&
    currentTurnId === botUserId &&
    (opponentId === botUserId || creatorId === botUserId);
  const board = parseFenBoard(fen);
  const files = "abcdefgh";
  const myColor = userId === creatorId ? "White" : "Black";
  const drawPending = drawOfferedBy && drawOfferedBy !== userId;
  const iOfferedDraw = drawOfferedBy === userId;

  useEffect(() => {
    if (!isBotTurn || pending) return;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await playChessBotMove(gameId);
        if (result.error) toast.error(result.error);
        router.refresh();
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [isBotTurn, gameId, fen, pending, router]);

  const clickSquare = (file: number, rank: number) => {
    if (isSpectator || !isMyTurn || pending) return;

    const sq = `${files[file]}${8 - rank}`;
    if (!selected) {
      const piece = board[rank][file];
      if (!piece) return;
      const isWhite = piece === piece.toUpperCase();
      const myWhite = userId === creatorId;
      if (isWhite !== myWhite) return;
      setSelected(sq);
      return;
    }

    if (selected === sq) {
      setSelected(null);
      return;
    }

    startTransition(async () => {
      const r = await playChessMove(gameId, selected, sq);
      setSelected(null);
      if (r.error) toast.error(r.error);
      else {
        if (r.settled) toast.success(r.ok ?? "Game over");
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
        if (r.left) router.push("/games/duels/chess");
        else router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {isSpectator && inPlay && (
        <p className="text-sm text-violet-300">Spectating — board updates when players move.</p>
      )}
      {inPlay && !isSpectator && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? <span className="text-emerald-300">Your turn</span> : "Waiting for opponent…"}
          {" · You are "}
          {myColor}
          {!isLocked && moveCount < 2 && (
            <span className="ml-2 text-amber-300/90">
              · Warm-up ({moveCount}/2 moves until locked)
            </span>
          )}
        </p>
      )}
      {status === "settled" && winnerId && !isSpectator && (
        <p className="text-sm text-emerald-300">{winnerId === userId ? "You won!" : "You lost."}</p>
      )}
      {status === "draw" && <p className="text-sm text-zinc-400">Draw.</p>}

      <div className="inline-block rounded-xl border border-white/10 bg-zinc-950 p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {board.map((row, ri) =>
            row.map((cell, ci) => {
              const dark = (ri + ci) % 2 === 1;
              const sq = `${files[ci]}${8 - ri}`;
              const sel = selected === sq;
              return (
                <button
                  key={sq}
                  type="button"
                  disabled={isSpectator || !isMyTurn || pending}
                  onClick={() => clickSquare(ci, ri)}
                  className={`flex h-11 w-11 items-center justify-center text-2xl ${
                    dark ? "bg-[#769656]" : "bg-[#eeeed2]"
                  } ${sel ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-950" : ""} disabled:cursor-default`}
                >
                  {cell ? (
                    <span className={pieceClass(cell)}>{PIECES[cell]}</span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {!isSpectator && inPlay && (
        <div className="flex flex-wrap gap-2">
          {status === "matched" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => leaveChessGame(gameId))}
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
                onClick={() => run(() => resignChessGame(gameId))}
                className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
              >
                Resign
              </button>
              {!drawOfferedBy && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => offerChessDraw(gameId))}
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
                    onClick={() => run(() => acceptChessDraw(gameId))}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500"
                  >
                    Accept draw
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => declineChessDraw(gameId))}
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

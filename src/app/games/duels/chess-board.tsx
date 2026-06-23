"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { playChessMove, resignChessGame } from "./chess-actions";

const PIECES: Record<string, string> = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};

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
}: {
  gameId: string;
  fen: string;
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const isMyTurn = status === "active" && currentTurnId === userId;
  const board = parseFenBoard(fen);
  const files = "abcdefgh";

  const clickSquare = (file: number, rank: number) => {
    const sq = `${files[file]}${8 - rank}`;
    if (!isMyTurn || pending) return;

    if (!selected) {
      const piece = board[rank][file];
      if (!piece) return;
      const isWhite = piece === piece.toUpperCase();
      const isCreatorWhite = true;
      const myWhite = userId === creatorId ? isCreatorWhite : !isCreatorWhite;
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

  return (
    <div className="space-y-3">
      {status === "active" && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? <span className="text-emerald-300">Your turn</span> : "Waiting for opponent…"}
          {" · You are "}
          {userId === creatorId ? "White" : "Black"}
        </p>
      )}
      {status === "settled" && winnerId && (
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
                  disabled={!isMyTurn || pending}
                  onClick={() => clickSquare(ci, ri)}
                  className={`flex h-11 w-11 items-center justify-center text-2xl ${
                    dark ? "bg-zinc-700" : "bg-zinc-500"
                  } ${sel ? "ring-2 ring-emerald-400" : ""} disabled:cursor-default`}
                >
                  {cell ? PIECES[cell] : ""}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {status === "active" && isMyTurn && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await resignChessGame(gameId);
              if (r.error) toast.error(r.error);
              else router.refresh();
            })
          }
          className="text-xs text-rose-400 hover:underline"
        >
          Resign
        </button>
      )}
    </div>
  );
}

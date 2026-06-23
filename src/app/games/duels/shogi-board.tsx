"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { parseSfen } from "shogiops/sfen";
import { makeSquareName } from "shogiops/util";
import { playShogiMove, resignShogiGame } from "./shogi-actions";

const PIECE_CHARS: Record<string, string> = {
  p: "歩", l: "香", n: "桂", s: "銀", g: "金", b: "角", r: "飛", k: "玉",
};

function boardFromSfen(sfen: string) {
  const parsed = parseSfen("standard", sfen);
  if (parsed.isErr) return [];
  const pos = parsed.value;
  const cells: { piece: string | null; color: "sente" | "gote" | null }[] = [];
  for (let sq = 0; sq < 81; sq++) {
    const p = pos.board.get(sq);
    if (!p) cells.push({ piece: null, color: null });
    else cells.push({ piece: p.role, color: p.color });
  }
  return cells;
}

export function ShogiBoard({
  gameId,
  sfen,
  currentTurnId,
  userId,
  creatorId,
  status,
  winnerId,
}: {
  gameId: string;
  sfen: string;
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState<string | null>(null);
  const isMyTurn = status === "active" && currentTurnId === userId;
  const cells = boardFromSfen(sfen);
  const myColor = userId === creatorId ? "sente" : "gote";

  const click = (sqIdx: number) => {
    if (!isMyTurn || pending) return;
    const sq = makeSquareName(sqIdx);
    if (!from) {
      const cell = cells[sqIdx];
      if (cell.piece && cell.color === myColor) setFrom(sq);
      return;
    }
    if (from === sq) {
      setFrom(null);
      return;
    }
    startTransition(async () => {
      const r = await playShogiMove(gameId, from, sq);
      setFrom(null);
      if (r.error) toast.error(r.error);
      else {
        if (r.settled) toast.success("Game over!");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {status === "active" && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? <span className="text-emerald-300">Your turn</span> : "Waiting…"}
          {" · "}
          {userId === creatorId ? "Black (先手)" : "White (後手)"}
        </p>
      )}
      {status === "settled" && winnerId && (
        <p className="text-sm text-emerald-300">{winnerId === userId ? "You won!" : "You lost."}</p>
      )}

      <div className="inline-block rounded-xl border border-white/10 bg-amber-100/10 p-2">
        <div className="grid grid-cols-9 gap-0.5">
          {cells.map((cell, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!isMyTurn || pending}
              onClick={() => click(idx)}
              className={`flex h-9 w-9 items-center justify-center text-sm ${
                from === makeSquareName(idx) ? "ring-2 ring-emerald-400" : ""
              } bg-amber-200/30`}
            >
              {cell.piece ? (
                <span className={cell.color === "sente" ? "text-zinc-900" : "text-rose-700"}>
                  {PIECE_CHARS[cell.piece] ?? cell.piece}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {status === "active" && isMyTurn && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await resignShogiGame(gameId);
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

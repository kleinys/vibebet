"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { playCheckersMove } from "./checkers-actions";
import type { CheckersCell } from "@/lib/checkers-engine";

export function CheckersBoard({
  gameId,
  board,
  currentTurnId,
  userId,
  creatorId,
  status,
  winnerId,
}: {
  gameId: string;
  board: CheckersCell[];
  currentTurnId: string | null;
  userId: string;
  creatorId: string;
  status: string;
  winnerId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number | null>(null);
  const isMyTurn = status === "active" && currentTurnId === userId;
  const mySign = userId === creatorId ? 1 : -1;

  const click = (idx: number) => {
    if (!isMyTurn || pending) return;
    const cell = board[idx];
    if (!selected) {
      if (Math.sign(cell) === mySign) setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    startTransition(async () => {
      const dr = Math.abs(Math.floor(idx / 8) - Math.floor(selected / 8));
      const captures: number[] = [];
      if (dr === 2) {
        const mid = (selected + idx) / 2;
        captures.push(mid);
      }
      const r = await playCheckersMove(gameId, selected, idx, captures);
      setSelected(null);
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
          {userId === creatorId ? "Red" : "Black"}
        </p>
      )}
      {status === "settled" && winnerId && (
        <p className="text-sm text-emerald-300">{winnerId === userId ? "You won!" : "You lost."}</p>
      )}

      <div className="inline-block rounded-xl border border-white/10 bg-amber-950/30 p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {board.map((cell, idx) => {
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            const dark = (r + c) % 2 === 1;
            const label =
              cell === 2 ? "🔴K" : cell === 1 ? "🔴" : cell === -2 ? "⚫K" : cell === -1 ? "⚫" : "";
            return (
              <button
                key={idx}
                type="button"
                disabled={!isMyTurn || !dark || pending}
                onClick={() => click(idx)}
                className={`flex h-10 w-10 items-center justify-center text-sm ${
                  dark ? "bg-amber-900/80" : "bg-amber-200/20"
                } ${selected === idx ? "ring-2 ring-emerald-400" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

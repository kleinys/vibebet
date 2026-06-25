"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { parseSfen } from "shogiops/sfen";
import { makeSquareName } from "shogiops/util";
import { playShogiMove, resignShogiGame, leaveShogiGame, offerShogiDraw, acceptShogiDraw, declineShogiDraw } from "./shogi-actions";
import { SkillDuelControls } from "@/components/skill-duel-controls";

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
  moveCount = 0,
  drawOfferedBy,
  isSpectator = false,
}: {
  gameId: string;
  sfen: string;
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
  const [from, setFrom] = useState<string | null>(null);
  const inPlay = status === "active" || status === "matched";
  const isLocked = status === "active";
  const isMyTurn = inPlay && !isSpectator && currentTurnId === userId;
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
      {inPlay && !isSpectator && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? <span className="text-emerald-300">Your turn</span> : "Waiting…"}
          {" · "}
          {userId === creatorId ? "Black (先手)" : "White (後手)"}
          {!isLocked && moveCount < 2 && (
            <span className="ml-2 text-amber-300/90">· Warm-up ({moveCount}/2)</span>
          )}
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
              disabled={isSpectator || !isMyTurn || pending}
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

      {!isSpectator && (
        <SkillDuelControls
          status={status}
          isLocked={isLocked}
          drawOfferedBy={drawOfferedBy}
          userId={userId}
          pending={pending}
          onLeave={() => leaveShogiGame(gameId)}
          onResign={() => resignShogiGame(gameId)}
          onOfferDraw={() => offerShogiDraw(gameId)}
          onAcceptDraw={() => acceptShogiDraw(gameId)}
          onDeclineDraw={() => declineShogiDraw(gameId)}
          onAfterLeave={() => router.push("/games/duels/shogi")}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { GO_BOARD_SIZE } from "@/lib/go-engine";
import { passGoGame, playGoMove, resignGoGame, leaveGoGame, offerGoDraw, acceptGoDraw, declineGoDraw } from "./go-actions";
import { SkillDuelControls } from "@/components/skill-duel-controls";
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
  moveCount = 0,
  drawOfferedBy,
  isSpectator = false,
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
  moveCount?: number;
  drawOfferedBy?: string | null;
  isSpectator?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inPlay = status === "active" || status === "matched";
  const isLocked = status === "active";
  const isMyTurn = inPlay && !isSpectator && currentTurnId === userId;

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
      {inPlay && !isSpectator && (
        <p className="text-sm text-zinc-400">
          {isMyTurn ? <span className="text-emerald-300">Your turn</span> : "Waiting…"}
          {" · "}
          {userId === creatorId ? "Black" : "White"}
          {!isLocked && moveCount < 2 && (
            <span className="ml-2 text-amber-300/90">· Warm-up ({moveCount}/2)</span>
          )}
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
            disabled={isSpectator || !isMyTurn || pending || cell !== 0}
            onClick={() => play(idx)}
            className="h-8 w-8 rounded-full border border-zinc-600 bg-amber-100/10 disabled:cursor-default"
          >
            {cell === 1 ? "⚫" : cell === 2 ? "⚪" : ""}
          </button>
        ))}
      </div>

      {!isSpectator && inPlay && isMyTurn && (
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
        </div>
      )}
      {!isSpectator && (
        <SkillDuelControls
          status={status}
          isLocked={isLocked}
          drawOfferedBy={drawOfferedBy}
          userId={userId}
          pending={pending}
          onLeave={() => leaveGoGame(gameId)}
          onResign={() => resignGoGame(gameId)}
          onOfferDraw={() => offerGoDraw(gameId)}
          onAcceptDraw={() => acceptGoDraw(gameId)}
          onDeclineDraw={() => declineGoDraw(gameId)}
          onAfterLeave={() => router.push("/games/duels/go")}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}

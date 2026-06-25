"use client";

import { useTransition } from "react";
import { toast } from "sonner";

type ActionResult = { error?: string; ok?: string; settled?: boolean; left?: boolean };

export function SkillDuelControls({
  status,
  isLocked,
  drawOfferedBy,
  userId,
  pending,
  onLeave,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onAfterLeave,
  onRefresh,
}: {
  status: string;
  isLocked: boolean;
  drawOfferedBy?: string | null;
  userId: string;
  pending: boolean;
  onLeave: () => Promise<ActionResult>;
  onResign: () => Promise<ActionResult>;
  onOfferDraw: () => Promise<ActionResult>;
  onAcceptDraw: () => Promise<ActionResult>;
  onDeclineDraw: () => Promise<ActionResult>;
  onAfterLeave?: () => void;
  onRefresh?: () => void;
}) {
  const [, startTransition] = useTransition();
  const inPlay = status === "matched" || status === "active";
  const drawPending = drawOfferedBy && drawOfferedBy !== userId;
  const iOfferedDraw = drawOfferedBy === userId;

  if (!inPlay) return null;

  const run = (fn: () => Promise<ActionResult>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.ok ?? "Done");
        if (r.left) onAfterLeave?.();
        else onRefresh?.();
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === "matched" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(onLeave)}
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
            onClick={() => run(onResign)}
            className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            Resign
          </button>
          {!drawOfferedBy && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(onOfferDraw)}
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
                onClick={() => run(onAcceptDraw)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500"
              >
                Accept draw
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(onDeclineDraw)}
                className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Decline
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

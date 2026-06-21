"use client";

import { useActionState } from "react";
import { quickExitShares } from "@/app/markets/[id]/actions";
import { CANCEL_BET_PAYOUT_RATIO, quoteCancelBet } from "@/lib/cancel-bet";
import { formatVibe } from "@/lib/utils";

type Props = {
  marketId: string;
  yesShares: number;
  noShares: number;
  totalCost: number;
  yesLabel: string;
  noLabel: string;
};

export function PositionCancelBar({
  marketId,
  yesShares,
  noShares,
  totalCost,
  yesLabel,
  noLabel,
}: Props) {
  const [state, action, pending] = useActionState(quickExitShares, null);
  const totalHeld = yesShares + noShares;
  const side = yesShares >= noShares ? "yes" : "no";
  const shares = side === "yes" ? yesShares : noShares;
  const sideLabel = side === "yes" ? yesLabel : noLabel;
  const { proceeds, fee } = quoteCancelBet(totalCost);

  if (shares <= 0 || totalCost <= 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/5 p-3">
      <p className="text-xs text-rose-200/90">
        Cancel your {sideLabel} position early — get{" "}
        <strong>{Math.round(CANCEL_BET_PAYOUT_RATIO * 100)}%</strong> back (
        {formatVibe(proceeds)} VIBE, forfeit {formatVibe(fee)}).
      </p>
      <form action={action} className="mt-2">
        <input type="hidden" name="marketId" value={marketId} />
        <input type="hidden" name="side" value={side} />
        <input type="hidden" name="shares" value={shares} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-rose-700 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-40"
        >
          {pending
            ? "Cancelling…"
            : `Cancel bet — ${formatVibe(proceeds)} VIBE back`}
        </button>
      </form>
      {state && "error" in state && (
        <p className="mt-2 text-xs text-rose-400">{state.error}</p>
      )}
      {state && "success" in state && state.success.kind === "quick_exit" && (
        <p className="mt-2 text-xs text-emerald-400">
          Cancelled — {formatVibe(state.success.proceeds)} VIBE returned.
        </p>
      )}
    </div>
  );
}

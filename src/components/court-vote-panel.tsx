"use client";

import { useActionState } from "react";
import { castVote, type VoteState } from "@/app/court/actions";
import { formatVibe } from "@/lib/utils";
import type { VoteEligibility } from "@/lib/court";

interface VotePanelProps {
  disputeId: string;
  overturnLabel: string;
  upholdLabel: string;
  eligibility: VoteEligibility;
}

export function VotePanel({
  disputeId,
  overturnLabel,
  upholdLabel,
  eligibility,
}: VotePanelProps) {
  const [state, formAction, pending] = useActionState<VoteState, FormData>(
    castVote,
    null,
  );

  if (!eligibility.eligible) {
    return (
      <div className="rounded-md border border-zinc-700/30 bg-zinc-900/40 p-3 text-xs text-zinc-400">
        {eligibility.reason ?? "You cannot vote on this poll."}
        {eligibility.voteCount > 0 && (
          <p className="mt-1 text-zinc-500">
            You cast {eligibility.voteCount} vote
            {eligibility.voteCount === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    );
  }

  const costLabel =
    eligibility.nextCost === 0
      ? "Free"
      : `${formatVibe(eligibility.nextCost)} VIBE`;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="disputeId" value={disputeId} />
      {eligibility.voteCount > 0 && eligibility.lockedSide != null && (
        <p className="text-xs text-zinc-400">
          Vote #{eligibility.voteCount + 1} — must match your first vote (
          {eligibility.lockedSide ? overturnLabel : upholdLabel}). Cost:{" "}
          {costLabel}
        </p>
      )}
      {eligibility.voteCount === 0 && (
        <p className="text-xs text-zinc-400">
          First vote is free. Extra votes cost 50, 100, 150… VIBE each.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          name="overturn"
          value="yes"
          disabled={
            pending ||
            (eligibility.lockedSide != null && !eligibility.lockedSide)
          }
          className="rounded-md bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50"
        >
          Overturn → {overturnLabel}
        </button>
        <button
          type="submit"
          name="overturn"
          value="no"
          disabled={
            pending ||
            (eligibility.lockedSide != null && eligibility.lockedSide)
          }
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-200 ring-1 ring-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
        >
          Uphold → {upholdLabel}
        </button>
      </div>
      {state?.error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-xs text-emerald-300">Vote recorded.</p>
      )}
    </form>
  );
}

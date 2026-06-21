"use client";

import { useActionState, useState } from "react";
import { openDispute, type DisputeState } from "@/app/court/actions";
import { formatVibe } from "@/lib/utils";

interface DisputeFormProps {
  marketId: string;
  /** Estimated stake (max(5% volume, 100), capped at 10k). Displayed only — the
   *  RPC re-computes server-side so this is purely informational. */
  estimatedStake: number;
  /** Outcome the admin proposed (the disputer is claiming the opposite). */
  proposedOutcome: boolean;
  yesLabel: string;
  noLabel: string;
}

export function DisputeForm({
  marketId,
  estimatedStake,
  proposedOutcome,
  yesLabel,
  noLabel,
}: DisputeFormProps) {
  const [state, formAction, pending] = useActionState<DisputeState, FormData>(
    openDispute,
    null,
  );
  const [open, setOpen] = useState(false);

  const claimedLabel = proposedOutcome ? noLabel : yesLabel;
  const proposedLabel = proposedOutcome ? yesLabel : noLabel;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
      >
        Dispute outcome →
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <input type="hidden" name="marketId" value={marketId} />

      <h3 className="text-sm font-semibold text-amber-200">Open a dispute</h3>
      <p className="mt-1 text-xs text-amber-200/80">
        You&apos;re claiming the correct outcome is{" "}
        <span className="font-medium">{claimedLabel}</span> (admin proposed{" "}
        <span className="font-medium">{proposedLabel}</span>). Eligible voters
        from outside this market will decide in 48 hours.
      </p>

      <div className="mt-3 rounded-md bg-zinc-950/50 p-3 text-xs text-zinc-300">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Required stake</span>
          <span className="tabular-nums">{formatVibe(estimatedStake)} VIBE</span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Refunded if the court overturns. Forfeited if upheld or no votes
          cast.
        </p>
      </div>

      <label htmlFor="reasoning" className="mt-3 block text-xs text-zinc-300">
        Reasoning (optional, max 4000 chars)
      </label>
      <textarea
        id="reasoning"
        name="reasoning"
        rows={3}
        maxLength={4000}
        placeholder="Why is the proposed outcome wrong?"
        className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
      />

      {state?.error && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Filing…" : `Stake ${formatVibe(estimatedStake)} VIBE & file`}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

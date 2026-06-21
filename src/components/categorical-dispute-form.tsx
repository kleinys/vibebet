"use client";

import { useActionState } from "react";
import { openDispute, type DisputeState } from "@/app/court/actions";
import { formatVibe } from "@/lib/utils";

interface CategoricalDisputeFormProps {
  marketId: string;
  estimatedStake: number;
  proposedIndex: number;
  outcomes: Array<{ outcome_index: number; label: string }>;
}

export function CategoricalDisputeForm({
  marketId,
  estimatedStake,
  proposedIndex,
  outcomes,
}: CategoricalDisputeFormProps) {
  const [state, formAction, pending] = useActionState<DisputeState, FormData>(
    openDispute,
    null,
  );

  const alternatives = outcomes.filter((o) => o.outcome_index !== proposedIndex);
  const proposedLabel =
    outcomes.find((o) => o.outcome_index === proposedIndex)?.label ?? "?";

  return (
    <form
      action={formAction}
      className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
    >
      <input type="hidden" name="marketId" value={marketId} />

      <h3 className="text-sm font-semibold text-amber-200">Open a dispute</h3>
      <p className="mt-1 text-xs text-amber-200/80">
        Admin proposed <span className="font-medium">{proposedLabel}</span>.
        Pick the outcome you believe is correct. A 48-hour resolution poll
        follows.
      </p>

      <label className="mt-3 block text-xs text-zinc-300">
        Your claimed winner
      </label>
      <select
        name="claimedOutcomeIndex"
        required
        className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
      >
        {alternatives.map((o) => (
          <option key={o.outcome_index} value={o.outcome_index}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="mt-3 rounded-md bg-zinc-950/50 p-3 text-xs text-zinc-300">
        <div className="flex justify-between">
          <span className="text-zinc-400">Required stake</span>
          <span>{formatVibe(estimatedStake)} VIBE</span>
        </div>
      </div>

      <textarea
        name="reasoning"
        rows={2}
        maxLength={4000}
        placeholder="Why is the proposed outcome wrong?"
        className="mt-3 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
      />

      {state?.error && (
        <p className="mt-2 text-xs text-red-300">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {pending ? "Filing…" : `Stake & open poll`}
      </button>
    </form>
  );
}

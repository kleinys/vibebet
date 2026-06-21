"use client";

import { useActionState } from "react";
import { proposeResolutionCategorical, type ResolveState } from "@/app/admin/actions";

interface OutcomeOption {
  outcome_index: number;
  label: string;
}

interface Props {
  marketId: string;
  question: string;
  outcomes: OutcomeOption[];
}

export function ResolveCategoricalForm({
  marketId,
  question,
  outcomes,
}: Props) {
  const [state, formAction, pending] = useActionState<ResolveState, FormData>(
    proposeResolutionCategorical,
    null,
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3"
    >
      <input type="hidden" name="marketId" value={marketId} />
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">
          Multi-outcome
        </span>
      </div>
      <div className="mt-1 text-sm text-zinc-200">{question}</div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Pick the winning outcome. 24h challenge window — categorical disputes
        finalize automatically (no Meme Court yet).
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {outcomes.map((o) => (
          <button
            key={o.outcome_index}
            name="outcomeIndex"
            value={o.outcome_index}
            type="submit"
            disabled={pending}
            className="rounded-md bg-violet-500/20 px-3 py-1.5 text-xs font-medium text-violet-200 ring-1 ring-violet-500/40 hover:bg-violet-500/30 disabled:opacity-50"
          >
            Propose {o.label}
          </button>
        ))}
        {state?.error && (
          <span className="text-xs text-red-300">{state.error}</span>
        )}
        {state?.ok && (
          <span className="text-xs text-emerald-300">{state.ok}</span>
        )}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { proposeResolution, type ResolveState } from "@/app/admin/actions";

interface Props {
  marketId: string;
  question: string;
  yesLabel?: string;
  noLabel?: string;
}

export function ResolveMarketForm({
  marketId,
  question,
  yesLabel = "Yes",
  noLabel = "No",
}: Props) {
  const [state, formAction, pending] = useActionState<ResolveState, FormData>(
    proposeResolution,
    null,
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-white/5 bg-zinc-900/40 p-3"
    >
      <input type="hidden" name="marketId" value={marketId} />
      <div className="text-sm text-zinc-200">{question}</div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Proposing kicks off a 24h challenge window. Holders can stake VIBE to
        send to the court if they disagree.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          name="outcome"
          value="yes"
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          Propose {yesLabel}
        </button>
        <button
          name="outcome"
          value="no"
          type="submit"
          disabled={pending}
          className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/30 disabled:opacity-50"
        >
          Propose {noLabel}
        </button>
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

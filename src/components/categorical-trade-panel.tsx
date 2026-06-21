"use client";

import { useActionState, useMemo, useState } from "react";
import {
  placeCategoricalTrade,
  type CategoricalTradeState,
} from "@/app/markets/[id]/actions";
import { formatOutcomeProbability, lmsrSharesForCost } from "@/lib/lmsr";
import { formatVibe } from "@/lib/utils";
import type { CategoricalOutcome } from "@/lib/categorical";

interface CategoricalTradePanelProps {
  marketId: string;
  outcomes: CategoricalOutcome[];
  lmsrB: number;
  disabled?: boolean;
  vibeBalance: number;
}

export function CategoricalTradePanel({
  marketId,
  outcomes,
  lmsrB,
  disabled,
  vibeBalance,
}: CategoricalTradePanelProps) {
  const [selected, setSelected] = useState(0);
  const [costInput, setCostInput] = useState("10");
  const cost = Number.parseInt(costInput, 10) || 0;
  const [state, action, pending] = useActionState<
    CategoricalTradeState,
    FormData
  >(placeCategoricalTrade, null);

  const q = outcomes.map((o) => o.shares);
  const previewShares = useMemo(
    () => lmsrSharesForCost(q, lmsrB, selected, cost),
    [q, lmsrB, selected, cost],
  );

  const selectedOutcome = outcomes[selected];

  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Buy outcome</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Multi-outcome market (LMSR). Pick one outcome and spend VIBE.
      </p>

      <div className="mt-4 space-y-1.5">
        {outcomes.map((o) => (
          <button
            key={o.outcome_index}
            type="button"
            disabled={disabled}
            onClick={() => setSelected(o.outcome_index)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
              selected === o.outcome_index
                ? "bg-fuchsia-500/15 ring-1 ring-fuchsia-500/40"
                : "bg-zinc-950/50 hover:bg-zinc-900"
            }`}
          >
            <span className="truncate font-medium">{o.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-400">
              {formatOutcomeProbability(o.probability)}
            </span>
          </button>
        ))}
      </div>

      <form action={action} noValidate className="mt-4 space-y-3">
        <input type="hidden" name="marketId" value={marketId} />
        <input type="hidden" name="outcomeIndex" value={selected} />

        <div>
          <label className="text-xs text-zinc-400">Bet amount (VIBE)</label>
          <input
            name="cost"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={costInput}
            onChange={(e) =>
              setCostInput(e.target.value.replace(/\D/g, ""))
            }
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[10, 25, 50, 100, 250].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCostInput(String(v))}
                disabled={disabled || v > vibeBalance}
                className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-zinc-400 hover:border-white/20 disabled:opacity-30"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {previewShares > 0 && selectedOutcome && (
          <div className="rounded-md border border-white/5 bg-zinc-950/80 p-3 text-xs text-zinc-400">
            <div>
              You receive ~{formatVibe(previewShares)} shares of{" "}
              <span className="text-zinc-200">{selectedOutcome.label}</span>
            </div>
            <div className="mt-1">
              Max payout if {selectedOutcome.label} wins:{" "}
              {formatVibe(previewShares)} VIBE
            </div>
          </div>
        )}

        {state && "error" in state && (
          <p className="text-xs text-red-300">{state.error}</p>
        )}
        {state && "success" in state && (
          <p className="text-xs text-emerald-300">
            Bought {formatVibe(state.success.shares)} shares!
          </p>
        )}

        <button
          type="submit"
          disabled={disabled || pending || cost > vibeBalance || cost < 10}
          className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending
            ? "Placing bet…"
            : `Bet ${cost} VIBE on ${selectedOutcome?.label ?? "…"}`}
        </button>
      </form>
    </div>
  );
}

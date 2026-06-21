"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createRecurringSeries,
  toggleRecurringSeries,
  type RecurringSeriesState,
} from "./actions";

const INTERVALS = [
  { sec: 60, label: "1 minute" },
  { sec: 120, label: "2 minutes" },
  { sec: 300, label: "5 minutes" },
  { sec: 600, label: "10 minutes" },
  { sec: 900, label: "15 minutes" },
  { sec: 1800, label: "30 minutes" },
  { sec: 3600, label: "1 hour" },
];

export function RecurringSeriesForm() {
  const [state, formAction, pending] = useActionState<
    RecurringSeriesState,
    FormData
  >(createRecurringSeries, null);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {state?.error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {state.ok}
        </p>
      )}

      <div>
        <label htmlFor="title" className="block text-sm text-zinc-300">
          Series title (optional)
        </label>
        <input
          id="title"
          name="title"
          placeholder="My BTC scalps"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="asset" className="block text-sm text-zinc-300">
          Asset (auto-oracle)
        </label>
        <select
          id="asset"
          name="asset"
          defaultValue="btc"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        >
          <option value="btc">Bitcoin (BTC)</option>
          <option value="eth">Ethereum (ETH)</option>
          <option value="sol">Solana (SOL)</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Up/Down windows use live spot price (BTC, ETH, SOL today). Stocks and
          custom tickers need a price oracle — not wired yet. Window length can
          be 1 minute to 1 hour.
        </p>
      </div>

      <div>
        <label htmlFor="intervalSec" className="block text-sm text-zinc-300">
          Window length
        </label>
        <select
          id="intervalSec"
          name="intervalSec"
          defaultValue="300"
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        >
          {INTERVALS.map((i) => (
            <option key={i.sec} value={i.sec}>
              {i.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="creatorFeePercent" className="block text-sm text-zinc-300">
          Your fee on each bet (%)
        </label>
        <input
          id="creatorFeePercent"
          name="creatorFeePercent"
          type="number"
          min={0}
          max={5}
          step={0.1}
          defaultValue={2}
          className="mt-1 w-full max-w-xs rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-zinc-500">
          You earn this cut of every VIBE bet on your windows (not your own bets).
          Max 5%. Stored as basis points server-side.
        </p>
      </div>

      <p className="text-xs text-zinc-500">
        Activation costs <strong className="text-zinc-300">1,000 VIBE</strong>.
        Each window is play-money, auto-resolved, and respawns when the timer ends.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start recurring series"}
      </button>
    </form>
  );
}

export function SeriesToggleButton({
  seriesId,
  enabled,
}: {
  seriesId: string;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState<
    RecurringSeriesState,
    FormData
  >(toggleRecurringSeries, null);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="seriesId" value={seriesId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-zinc-400 hover:text-zinc-200"
      >
        {pending ? "…" : enabled ? "Pause" : "Resume"}
      </button>
      {state?.error && (
        <span className="ml-2 text-xs text-rose-400">{state.error}</span>
      )}
    </form>
  );
}

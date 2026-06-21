"use client";

import { useActionState } from "react";
import { createPaperDuel, type PaperDuelActionState } from "./actions";

const DURATIONS = [
  { sec: 300, label: "5 minutes" },
  { sec: 600, label: "10 minutes" },
  { sec: 900, label: "15 minutes" },
];

export function CreatePaperDuelForm() {
  const [state, action, pending] = useActionState<PaperDuelActionState, FormData>(
    createPaperDuel,
    null,
  );

  return (
    <form action={action} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <h2 className="text-sm font-semibold text-cyan-100">Start a return race</h2>
      <p className="mt-1 text-xs text-zinc-400">
        Pick the crypto you think will run hottest. Opponent picks theirs. Highest % return wins
        the pool — auto-settled at the bell.
      </p>

      {state?.error && (
        <p className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {state.ok}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-zinc-400">Your pick (long)</span>
          <select
            name="asset"
            defaultValue="btc"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="btc">Bitcoin (BTC)</option>
            <option value="eth">Ethereum (ETH)</option>
            <option value="sol">Solana (SOL)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Race length</span>
          <select
            name="durationSec"
            defaultValue="300"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            {DURATIONS.map((d) => (
              <option key={d.sec} value={d.sec}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Stake (VIBE)</span>
          <input
            name="stake"
            type="number"
            min={10}
            max={100000}
            defaultValue={100}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post open challenge"}
      </button>
    </form>
  );
}

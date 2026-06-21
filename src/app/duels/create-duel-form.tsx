"use client";

import { useActionState } from "react";
import { createDuel } from "./actions";

export function CreateDuelForm({
  markets,
}: {
  markets: { id: string; question: string }[];
}) {
  const [state, action, pending] = useActionState(createDuel, null);

  return (
    <form action={action} className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
      <h2 className="text-sm font-semibold text-violet-100">Post a duel</h2>
      <p className="mt-1 text-xs text-violet-200/70">
        Lock VIBE on a side. Someone takes the opposite — winner gets both stakes when the market resolves.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Market</span>
          <select
            name="marketId"
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="">Pick an open market…</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.question.slice(0, 80)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Your side</span>
          <select
            name="side"
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="yes">YES</option>
            <option value="no">NO</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Stake (VIBE)</span>
          <input
            name="stake"
            type="number"
            min={10}
            max={100000}
            defaultValue={50}
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Challenge user (optional @username)</span>
          <input
            name="opponentUsername"
            type="text"
            placeholder="Leave blank for open challenge"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {state?.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-xs text-emerald-300">{state.ok}</p>}

      <button
        type="submit"
        disabled={pending || markets.length === 0}
        className="mt-4 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
      >
        {pending ? "Posting…" : "Post duel"}
      </button>
    </form>
  );
}

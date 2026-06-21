"use client";

import { useActionState } from "react";

import { sponsorTournament } from "@/app/admin/tournament-actions";

export function AdminTournamentPanel({
  tournamentId,
  prizePool,
  sponsorName,
}: {
  tournamentId: string;
  prizePool: number;
  sponsorName: string | null;
}) {
  const [state, action, pending] = useActionState(sponsorTournament, null);

  return (
    <section className="mt-10 rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-200">
        Tournament sponsor
      </h2>
      <p className="mt-1 text-xs text-amber-200/70">
        Current pool: {prizePool.toLocaleString()} VIBE
        {sponsorName ? ` · sponsored by ${sponsorName}` : ""}. Top 3 auto-paid
        when the week ends (50% / 30% / 20%).
      </p>

      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <label className="block">
          <span className="text-xs text-zinc-400">Add VIBE to pool</span>
          <input
            name="amount"
            type="number"
            min={100}
            max={1000000}
            defaultValue={1000}
            required
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-zinc-400">Sponsor name</span>
          <input
            name="sponsorName"
            required
            defaultValue="Vibebet"
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add sponsored VIBE"}
        </button>
      </form>

      {state?.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-xs text-emerald-300">{state.ok}</p>}
    </section>
  );
}

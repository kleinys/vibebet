"use client";

import { useActionState } from "react";
import {
  populateAllMarketsForm,
  registerPlatformBotForm,
  seedOfficialMarketsForm,
  syncPolymarketMirrorsForm,
  type ResolveState,
} from "@/app/admin/actions";
import type { CatalogStats } from "@/lib/platform-activity";

export function AdminSeedPanel({ stats }: { stats: CatalogStats | null }) {
  const [populateState, populateAction, populatePending] = useActionState<
    ResolveState,
    FormData
  >(populateAllMarketsForm, null);

  const [seedState, seedAction, seedPending] = useActionState<
    ResolveState,
    FormData
  >(seedOfficialMarketsForm, null);

  const [syncState, syncAction, syncPending] = useActionState<
    ResolveState,
    FormData
  >(syncPolymarketMirrorsForm, null);

  const [botState, botAction, botPending] = useActionState<
    ResolveState,
    FormData
  >(registerPlatformBotForm, null);

  return (
    <section className="mt-10 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-fuchsia-300">
        Populate markets
      </h2>
      <p className="mt-1 max-w-2xl text-xs text-zinc-400">
        <strong className="text-zinc-300">Polymarket mirror</strong> copies live
        questions + odds from Polymarket (Bitcoin, elections, sports, etc.) —
        users bet play-money VIBE here, not real USD.{" "}
        <strong className="text-zinc-300">Official</strong> markets are
        Vibebet-curated. If home looks empty, click{" "}
        <strong className="text-zinc-300">Populate everything</strong> below.
      </p>

      {stats && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Official" value={stats.platform} />
          <Stat label="Polymarket mirror" value={stats.polymarket_mirror} />
          <Stat label="Community" value={stats.community} />
          <Stat
            label="Bot"
            value={stats.bot_registered ? "registered" : "missing"}
          />
        </dl>
      )}

      <form action={populateAction} className="mt-4">
        <button
          type="submit"
          disabled={populatePending}
          className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {populatePending
            ? "Populating…"
            : "Populate everything (official + Polymarket)"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-3">
        <form action={seedAction}>
          <button
            type="submit"
            disabled={seedPending}
            className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {seedPending ? "Seeding…" : "Seed official markets (~15)"}
          </button>
        </form>
        <form action={syncAction}>
          <button
            type="submit"
            disabled={syncPending}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {syncPending ? "Syncing…" : "Sync Polymarket mirrors (top 40)"}
          </button>
        </form>
      </div>

      <form action={botAction} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Platform bot user UUID
          <input
            name="botUserId"
            type="text"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-80 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
            required
          />
        </label>
        <button
          type="submit"
          disabled={botPending}
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {botPending ? "Saving…" : "Register platform bot"}
        </button>
      </form>
      <p className="mt-2 max-w-2xl text-xs text-zinc-500">
        Create a dedicated account (e.g.{" "}
        <code className="font-mono">platform-bot@yourdomain.com</code>), copy its
        UUID from Supabase Auth → Users, paste above. The bot wallet is funded
        from system mint and places small synthetic trades so charts + volume
        look alive. Mirror odds auto-refresh every ~15 min on page loads.
      </p>

      {populateState?.ok && (
        <p className="mt-3 text-xs text-emerald-300">{populateState.ok}</p>
      )}
      {populateState?.error && (
        <p className="mt-3 text-xs text-red-300">{populateState.error}</p>
      )}
      {seedState?.ok && (
        <p className="mt-3 text-xs text-emerald-300">{seedState.ok}</p>
      )}
      {seedState?.error && (
        <p className="mt-3 text-xs text-red-300">{seedState.error}</p>
      )}
      {syncState?.ok && (
        <p className="mt-3 text-xs text-emerald-300">{syncState.ok}</p>
      )}
      {syncState?.error && (
        <p className="mt-3 text-xs text-red-300">{syncState.error}</p>
      )}
      {botState?.ok && (
        <p className="mt-3 text-xs text-emerald-300">{botState.ok}</p>
      )}
      {botState?.error && (
        <p className="mt-3 text-xs text-red-300">{botState.error}</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/5 bg-zinc-950/50 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium tabular-nums text-zinc-200">{value}</dd>
    </div>
  );
}

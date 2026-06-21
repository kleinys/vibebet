import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import {
  getCreatorStats,
  getCreatorLeaderboard,
  getCreatorTopMarkets,
  getCreatorRecurringSeries,
  listMarketSuggestions,
} from "@/lib/creator-hub";
import { AccountNav } from "@/components/account-nav";
import { formatVibe } from "@/lib/utils";

export const revalidate = 0;

export default async function CreatorHubPage() {
  const enabled = await isEnabled("creator_hub_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Creator Hub off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">creator_hub_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/creator");

  const [stats, leaderboard, mySuggestions, topMarkets, series] =
    await Promise.all([
    getCreatorStats(user.id),
    getCreatorLeaderboard(15),
    listMarketSuggestions({ userId: user.id, limit: 10 }),
    getCreatorTopMarkets(user.id, 8),
    getCreatorRecurringSeries(user.id, 10),
  ]);

  const myRank = leaderboard.find((r) => r.user_id === user.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Creator Hub</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Track earnings from your markets and recurring series.
        </p>
      </header>

      <AccountNav active="/account/creator" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trade fees earned" value={formatVibe(stats?.fee_earned ?? 0)} hint="From recurring series bets" />
        <StatCard label="Volume bonuses" value={formatVibe(stats?.bonus_earned ?? 0)} hint="500 VIBE at 5k volume" />
        <StatCard label="Total bet volume" value={formatVibe(stats?.total_volume ?? 0)} hint="Across your markets" />
        <StatCard
          label="Markets / series"
          value={`${stats?.markets_created ?? 0} / ${stats?.recurring_series ?? 0}`}
          hint="One-shot · recurring"
        />
      </div>

      {(stats?.bonus_near_count ?? 0) > 0 && (
        <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {stats!.bonus_near_count} market(s) are close to the 5,000 VIBE volume
          bonus — keep promoting them!
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/markets/new"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500"
        >
          Create market
        </Link>
        <Link
          href="/markets/new/recurring"
          className="rounded-md border border-violet-500/40 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/10"
        >
          Recurring series
        </Link>
        <Link
          href="/markets/suggest"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Suggest a market
        </Link>
      </div>

      {(topMarkets.length > 0 || series.length > 0) && (
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {topMarkets.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-200">Your top markets</h2>
              <ul className="mt-3 space-y-2">
                {topMarkets.map((m) => (
                  <li key={m.market_id}>
                    <Link
                      href={`/markets/${m.market_id}`}
                      className="block rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-3 text-sm hover:border-violet-500/30"
                    >
                      <p className="truncate font-medium text-zinc-100">{m.question}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatVibe(m.volume)} VIBE volume · {m.status}
                        {m.is_recurring && " · recurring window"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {series.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-200">Recurring series</h2>
              <ul className="mt-3 space-y-2">
                {series.map((s) => (
                  <li
                    key={s.series_id}
                    className="rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-zinc-100">{s.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {s.fast_asset.toUpperCase()} · every {s.interval_sec >= 60 ? `${s.interval_sec / 60}m` : `${s.interval_sec}s`} ·{" "}
                      {s.windows_spawned} windows · fee {(s.creator_fee_bps / 100).toFixed(1)}%
                      {!s.enabled && " · paused"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-200">Creator leaderboard</h2>
        {myRank && (
          <p className="mt-1 text-xs text-zinc-500">
            You&apos;re #{myRank.rank} with {formatVibe(myRank.total_volume)} VIBE volume.
          </p>
        )}
        {leaderboard.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No creators yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Creator</th>
                  <th className="px-4 py-2 text-right">Volume</th>
                  <th className="px-4 py-2 text-right">Fees</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((r) => (
                  <tr
                    key={r.user_id}
                    className={r.user_id === user.id ? "bg-violet-500/5" : undefined}
                  >
                    <td className="px-4 py-2 text-zinc-500">{r.rank}</td>
                    <td className="px-4 py-2">
                      {r.display_name}
                      {r.user_id === user.id && (
                        <span className="ml-2 text-[10px] text-violet-400">you</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatVibe(r.total_volume)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-300">
                      {formatVibe(r.fee_earned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mySuggestions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-200">Your suggestions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {mySuggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-2"
              >
                <span className="truncate">{s.title}</span>
                <span className="ml-2 shrink-0 text-xs text-zinc-500">
                  {s.status} · ▲ {s.vote_count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

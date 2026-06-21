import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import {
  getActiveTournament,
  getLastTournamentResults,
  getTournamentLeaderboard,
} from "@/lib/tournaments";
import { formatVibe } from "@/lib/utils";

export const revalidate = 0;

export default async function TournamentsPage() {
  const enabled = await isEnabled("tournaments_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Tournaments off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">tournaments_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const payoutsOn = await isEnabled("tournament_payouts_enabled");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tournament, rows, lastResults] = await Promise.all([
    getActiveTournament(),
    getTournamentLeaderboard(30),
    payoutsOn ? getLastTournamentResults() : Promise.resolve(null),
  ]);

  const myRow = user ? rows.find((r) => r.user_id === user.id) : null;
  const splits = tournament?.prize_splits ?? [50, 30, 20];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/leaderboard" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Hall of Fame
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">Weekly Volume Classic</h1>
      {tournament ? (
        <>
          <p className="mt-1 text-sm text-zinc-400">{tournament.description}</p>
          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-lg font-semibold text-amber-100">
              {formatVibe(tournament.prize_pool)} VIBE prize pool
            </p>
            {tournament.sponsor_name && (
              <p className="mt-1 text-xs text-amber-200/80">
                Sponsored by {tournament.sponsor_name}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-400">
              Ends {new Date(tournament.ends_at).toLocaleString()}
              {payoutsOn && (
                <>
                  {" "}
                  · Payouts: {splits.map((s, i) => `#${i + 1} ${s}%`).join(" · ")}
                </>
              )}
            </p>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No active tournament this week.</p>
      )}

      {myRow && (
        <div className="mt-6 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 text-sm">
          You&apos;re #{myRow.rank} with {formatVibe(myRow.volume)} VIBE wagered
          this week.
          {payoutsOn && myRow.rank <= 3 && tournament && (
            <span className="ml-1 text-fuchsia-300">
              (on pace for ~{formatVibe(Math.floor(tournament.prize_pool * (splits[myRow.rank - 1] ?? 0) / 100))} VIBE)
            </span>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No scores yet. Every bet counts toward volume.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2 text-right">Volume</th>
                {payoutsOn && <th className="px-4 py-2 text-right">Est. prize</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr
                  key={r.user_id}
                  className={user?.id === r.user_id ? "bg-fuchsia-500/5" : undefined}
                >
                  <td className="px-4 py-2 text-zinc-500">{r.rank}</td>
                  <td className="px-4 py-2">
                    {r.display_name}
                    {user?.id === r.user_id && (
                      <span className="ml-2 text-[10px] text-fuchsia-400">you</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatVibe(r.volume)}
                  </td>
                  {payoutsOn && tournament && (
                    <td className="px-4 py-2 text-right tabular-nums text-amber-200">
                      {r.rank <= 3
                        ? formatVibe(
                            Math.floor(
                              tournament.prize_pool * (splits[r.rank - 1] ?? 0) / 100,
                            ),
                          )
                        : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastResults && lastResults.payouts.length > 0 && (
        <section className="mt-10 rounded-xl border border-white/5 bg-zinc-900/40 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Last week&apos;s winners
          </h2>
          {lastResults.sponsor_name && (
            <p className="mt-1 text-xs text-amber-200/80">
              Sponsored by {lastResults.sponsor_name}
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {lastResults.payouts.map((p) => (
              <li key={p.rank} className="flex justify-between">
                <span>
                  #{p.rank} {p.display_name}
                </span>
                <span className="tabular-nums text-amber-200">
                  +{formatVibe(p.amount)} VIBE
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/account/quests" className="text-fuchsia-400 hover:underline">
          Weekly quests →
        </Link>
      </p>
    </div>
  );
}

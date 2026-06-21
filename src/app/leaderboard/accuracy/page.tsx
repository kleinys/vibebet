import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getAccuracyLeaderboard, getAccuracyStats } from "@/lib/accuracy";
import { tierFromAccuracy } from "@/lib/accuracy-ranks";

export const revalidate = 0;

export default async function AccuracyLeaderboardPage() {
  const enabled = await isEnabled("accuracy_leaderboard_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Sharp Minds off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">accuracy_leaderboard_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [rows, myStats] = await Promise.all([
    getAccuracyLeaderboard(50),
    user ? getAccuracyStats(user.id) : Promise.resolve(null),
  ]);

  const myTier = myStats
    ? tierFromAccuracy(
        myStats.predictions_scored,
        myStats.accuracy_pct,
      )
    : null;
  const myRow = user ? rows.find((r) => r.user_id === user.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <nav className="flex gap-4 text-sm">
        <Link href="/leaderboard" className="text-zinc-400 hover:text-zinc-200">
          Hall of Fame
        </Link>
        <span className="font-medium text-fuchsia-300">Sharp Minds</span>
      </nav>

      <h1 className="mt-4 text-2xl font-semibold">Sharp Minds</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Ranked by prediction accuracy (min 5 resolved bets). Lower Brier score =
        better calibration.
      </p>

      {myStats && myStats.predictions_scored > 0 && (
        <div className="mt-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className={`text-lg font-semibold ${myTier?.colorClass}`}>
            {myTier?.emoji} {myTier?.title}
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {myStats.accuracy_pct}% accurate · {myStats.predictions_scored}{" "}
            scored bets
            {myStats.avg_brier != null && (
              <> · Brier {myStats.avg_brier}</>
            )}
            {myRow && (
              <span className="text-zinc-500"> · Rank #{myRow.rank}</span>
            )}
          </p>
          {myStats.predictions_scored < 5 && (
            <p className="mt-2 text-xs text-zinc-500">
              Need 5 resolved bets to appear on the public board.
            </p>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No scored predictions yet. Bet on markets that resolve to climb the board.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Predictor</th>
                <th className="px-4 py-2 text-right">Accuracy</th>
                <th className="px-4 py-2 text-right">Bets</th>
                <th className="px-4 py-2 text-right">Brier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => {
                const tier = tierFromAccuracy(
                  r.predictions_scored,
                  r.accuracy_pct,
                );
                const isMe = user?.id === r.user_id;
                return (
                  <tr
                    key={r.user_id}
                    className={isMe ? "bg-violet-500/5" : undefined}
                  >
                    <td className="px-4 py-2 text-zinc-500">{r.rank}</td>
                    <td className="px-4 py-2">
                      <span className={tier.colorClass}>{tier.emoji}</span>{" "}
                      {r.display_name}
                      {isMe && (
                        <span className="ml-2 text-[10px] text-violet-400">you</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-300">
                      {r.accuracy_pct}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                      {r.predictions_scored}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                      {r.avg_brier}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

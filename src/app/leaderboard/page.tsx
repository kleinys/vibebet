import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatVibe } from "@/lib/utils";
import {
  getLeaderboard,
  getStreaksForUsers,
  getUserLeaderboardStats,
} from "@/lib/leaderboard-stats";
import {
  getEquippedCosmeticsForUsers,
  getUsernamesForUsers,
} from "@/lib/cosmetics";
import { tierFromProfit } from "@/lib/ranks";
import { UserAvatarLink } from "@/components/user-avatar";

export const revalidate = 0;

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rows: Awaited<ReturnType<typeof getLeaderboard>> = [];
  let errorMessage: string | null = null;

  try {
    rows = await getLeaderboard(50);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Failed to load leaderboard.";
  }

  const userIds = rows.map((r) => r.user_id);
  const [streaks, myStats, cosmetics, usernames] = await Promise.all([
    getStreaksForUsers(userIds),
    user ? getUserLeaderboardStats(user.id) : Promise.resolve(null),
    getEquippedCosmeticsForUsers(userIds),
    getUsernamesForUsers(userIds),
  ]);

  const podium = rows.slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Hall of Fame</h1>
      <nav className="mt-3 flex gap-4 text-sm">
        <span className="font-medium text-fuchsia-300">Profit</span>
        <Link
          href="/leaderboard/accuracy"
          className="text-zinc-400 hover:text-zinc-200"
        >
          Sharp Minds →
        </Link>
        <Link
          href="/tournaments"
          className="text-zinc-400 hover:text-zinc-200"
        >
          Weekly Volume Classic →
        </Link>
      </nav>
      <p className="mt-1 text-sm text-zinc-400">
        Top traders by lifetime VIBE profit. Rank tiers unlock as your profit
        grows.
      </p>

      {myStats && (
        <div className="mt-6 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Your rank
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg">
                  {myStats.tier.emoji} {myStats.tier.title}
                </span>
                {myStats.rank != null && (
                  <span className="text-sm text-zinc-400">#{myStats.rank}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Profit
              </div>
              <div
                className={
                  myStats.profit > 0
                    ? "mt-1 text-lg font-semibold text-emerald-300"
                    : myStats.profit < 0
                      ? "mt-1 text-lg font-semibold text-rose-300"
                      : "mt-1 text-lg font-semibold text-zinc-300"
                }
              >
                {myStats.profit > 0 ? "+" : ""}
                {formatVibe(myStats.profit)} VIBE
              </div>
            </div>
          </div>
          {!myStats.onLeaderboard && myStats.marketsTraded > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              You&apos;re outside the top 50 — keep trading to climb in.
            </p>
          )}
          <Link
            href="/account/achievements"
            className="mt-3 inline-block text-xs text-fuchsia-400 hover:underline"
          >
            View achievements →
          </Link>
        </div>
      )}

      {errorMessage && (
        <p className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {errorMessage}
        </p>
      )}

      {podium.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {podium.map((r, i) => {
            const tier = tierFromProfit(r.profit);
            const medals = ["🥇", "🥈", "🥉"];
            const look = cosmetics.get(r.user_id);
            const username = usernames.get(r.user_id);
            const playerHref = username ? `/players/${username}` : null;
            return (
              <div
                key={r.user_id}
                className={`rounded-xl border p-4 ${
                  user?.id === r.user_id
                    ? "border-fuchsia-500/40 bg-fuchsia-500/5"
                    : "border-white/5 bg-zinc-900/40"
                }`}
              >
                <div className="text-2xl">{medals[i]}</div>
                <div className="mt-2 flex items-center gap-2">
                  {playerHref ? (
                    <UserAvatarLink
                      slug={look?.skin?.slug}
                      badgeSlug={look?.badge?.slug}
                      href={playerHref}
                      title={r.display_name}
                    />
                  ) : (
                    <UserAvatarLink
                      slug={look?.skin?.slug}
                      badgeSlug={look?.badge?.slug}
                      href="/leaderboard"
                      title={r.display_name}
                    />
                  )}
                  {playerHref ? (
                    <Link
                      href={playerHref}
                      className="font-medium text-zinc-100 hover:underline"
                    >
                      {r.display_name}
                    </Link>
                  ) : (
                    <div className="font-medium text-zinc-100">
                      {r.display_name}
                    </div>
                  )}
                </div>
                <div className={`mt-0.5 text-xs ${tier.colorClass}`}>
                  {tier.emoji} {tier.title}
                </div>
                <div className="mt-2 text-sm tabular-nums text-emerald-300">
                  +{formatVibe(r.profit)} VIBE
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          No trades yet. Be the first to place a bet.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Player</th>
                <th className="px-4 py-2 font-medium">Tier</th>
                <th className="px-4 py-2 text-right font-medium">Streak</th>
                <th className="px-4 py-2 text-right font-medium">Markets</th>
                <th className="px-4 py-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => {
                const tier = tierFromProfit(r.profit);
                const streak = streaks.get(r.user_id) ?? 0;
                const isMe = user?.id === r.user_id;
                const look = cosmetics.get(r.user_id);
                const username = usernames.get(r.user_id);
                const playerHref = username ? `/players/${username}` : null;
                return (
                  <tr
                    key={r.user_id}
                    className={isMe ? "bg-fuchsia-500/5" : undefined}
                  >
                    <td className="px-4 py-2 text-zinc-500">{r.rank}</td>
                    <td className="px-4 py-2 text-zinc-200">
                      <div className="flex items-center gap-2">
                        {playerHref ? (
                          <UserAvatarLink
                            slug={look?.skin?.slug}
                            badgeSlug={look?.badge?.slug}
                            href={playerHref}
                            title={r.display_name}
                          />
                        ) : (
                          <UserAvatarLink
                            slug={look?.skin?.slug}
                            badgeSlug={look?.badge?.slug}
                            href="/leaderboard"
                            title={r.display_name}
                          />
                        )}
                        {playerHref ? (
                          <Link href={playerHref} className="hover:underline">
                            {r.display_name}
                          </Link>
                        ) : (
                          r.display_name
                        )}
                        {isMe && (
                          <span className="text-[10px] text-fuchsia-400">
                            you
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-2 text-xs ${tier.colorClass}`}>
                      {tier.emoji} {tier.title}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                      {streak > 0 ? `🔥 ${streak}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                      {r.markets_traded}
                    </td>
                    <td
                      className={
                        r.profit > 0
                          ? "px-4 py-2 text-right tabular-nums text-emerald-300"
                          : r.profit < 0
                            ? "px-4 py-2 text-right tabular-nums text-rose-300"
                            : "px-4 py-2 text-right tabular-nums text-zinc-400"
                      }
                    >
                      {r.profit > 0 ? "+" : ""}
                      {formatVibe(r.profit)}
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

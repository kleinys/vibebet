import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllBalances } from "@/lib/ledger";
import { BalanceBadge } from "@/components/balance-badge";
import { AccountNav } from "@/components/account-nav";
import { WalletCurrencySection } from "@/components/wallet-currency-section";
import { formatVibe } from "@/lib/utils";
import { getStreakInfo, maybeRecordDailyActivity } from "@/lib/streaks";
import { getUserLeaderboardStats } from "@/lib/leaderboard-stats";
import { InventoryItemCard } from "@/components/inventory-item-card";
import type { ItemKind, Rarity } from "@/lib/supabase/types";
import { progressToNextTier } from "@/lib/ranks";

export const revalidate = 0;

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  await maybeRecordDailyActivity();

  const [balances, profileRes, inventoryRes, positionsRes, streak, rankStats] =
    await Promise.all([
    getAllBalances(user.id),
    supabase
      .from("profiles")
      .select("display_name, username, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_inventory")
      .select(
        "id, is_equipped, acquired_at, shop_items (slug, name, kind, rarity)",
      )
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: false }),
    supabase
      .from("positions")
      .select(
        "market_id, yes_shares, no_shares, total_cost, total_payout, total_proceeds, markets (id, question, status, resolved_outcome, outcome_yes_label, outcome_no_label)",
      )
      .eq("user_id", user.id),
    getStreakInfo(user.id),
    getUserLeaderboardStats(user.id),
  ]);

  const profile = profileRes.data;
  const inventory = inventoryRes.data ?? [];
  const positions = positionsRes.data ?? [];
  const rankProgress = progressToNextTier(rankStats.profit);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">
          {profile?.display_name ?? "Account"}
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {user.email} · Member since{" "}
          {profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString()
            : "—"}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <BalanceBadge currency="vibe" amount={balances.vibe} href="#wallet" />
          <BalanceBadge currency="gem" amount={balances.gem} href="#wallet" />
          {streak.currentStreak > 0 && (
            <Link
              href="/account/achievements"
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200"
            >
              🔥 {streak.currentStreak}-day streak
            </Link>
          )}
          {streak.streakShields > 0 && (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
              🛡 {streak.streakShields} shield{streak.streakShields === 1 ? "" : "s"}
            </span>
          )}
          <Link
            href="/leaderboard"
            className={`rounded-md border border-white/10 bg-zinc-900/60 px-3 py-1 text-sm ${rankStats.tier.colorClass}`}
          >
            {rankStats.tier.emoji} {rankStats.tier.title}
            {rankStats.rank != null && (
              <span className="ml-1 text-zinc-500">#{rankStats.rank}</span>
            )}
          </Link>
        </div>
      </header>

      <AccountNav active="/account" />

      <WalletCurrencySection userId={user.id} />

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Trader rank
            </h2>
            <p className={`mt-1 text-lg font-semibold ${rankStats.tier.colorClass}`}>
              {rankStats.tier.emoji} {rankStats.tier.title}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Lifetime profit:{" "}
              <span
                className={
                  rankStats.profit > 0
                    ? "text-emerald-300"
                    : rankStats.profit < 0
                      ? "text-rose-300"
                      : "text-zinc-300"
                }
              >
                {rankStats.profit > 0 ? "+" : ""}
                {formatVibe(rankStats.profit)} VIBE
              </span>
            </p>
          </div>
          {rankProgress.next && (
            <div className="min-w-[180px] flex-1">
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500">
                <span>Next: {rankProgress.next.emoji} {rankProgress.next.title}</span>
                <span>{Math.round(rankProgress.progress * 100)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-fuchsia-500"
                  style={{ width: `${rankProgress.progress * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-zinc-500">
                {formatVibe(rankProgress.next.minProfit - rankStats.profit)} VIBE
                profit to go
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Open positions
        </h2>
        {positions.filter((p) => p.yes_shares > 0 || p.no_shares > 0).length ===
        0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No open positions.{" "}
            <Link href="/markets" className="text-fuchsia-400 hover:underline">
              Browse markets
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {positions
              .filter((p) => p.yes_shares > 0 || p.no_shares > 0)
              .map((p) => {
                const m = Array.isArray(p.markets) ? p.markets[0] : p.markets;
                return (
                  <li
                    key={p.market_id}
                    className="rounded-lg border border-white/5 bg-zinc-900/40 p-3"
                  >
                    <Link
                      href={`/markets/${p.market_id}`}
                      className="text-sm font-medium text-zinc-100 hover:underline"
                    >
                      {m?.question ?? "Unknown market"}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
                      {p.yes_shares > 0 && (
                        <span>
                          {m?.outcome_yes_label ?? "YES"}:{" "}
                          <span className="tabular-nums text-emerald-300">
                            {formatVibe(p.yes_shares)}
                          </span>
                        </span>
                      )}
                      {p.no_shares > 0 && (
                        <span>
                          {m?.outcome_no_label ?? "NO"}:{" "}
                          <span className="tabular-nums text-rose-300">
                            {formatVibe(p.no_shares)}
                          </span>
                        </span>
                      )}
                      <span>
                        Spent:{" "}
                        <span className="tabular-nums">
                          {formatVibe(p.total_cost)}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Inventory
        </h2>
        {inventory.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Empty.{" "}
            <Link href="/shop" className="text-fuchsia-400 hover:underline">
              Visit the shop
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((inv) => {
              const item = Array.isArray(inv.shop_items)
                ? inv.shop_items[0]
                : inv.shop_items;
              if (!item) return null;
              return (
                <InventoryItemCard
                  key={inv.id}
                  inventoryId={inv.id}
                  slug={item.slug}
                  name={item.name}
                  kind={item.kind as ItemKind}
                  rarity={item.rarity as Rarity}
                  isEquipped={inv.is_equipped}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

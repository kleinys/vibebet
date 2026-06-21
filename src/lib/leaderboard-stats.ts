import "server-only";
import { createClient } from "@/lib/supabase/server";
import { tierFromProfit, type RankTier } from "@/lib/ranks";

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  total_cost: number;
  total_payout: number;
  total_proceeds: number;
  profit: number;
  markets_traded: number;
}

export interface UserLeaderboardStats {
  rank: number | null;
  profit: number;
  marketsTraded: number;
  tier: RankTier;
  onLeaderboard: boolean;
}

export async function getLeaderboard(
  limit = 50,
): Promise<LeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export async function getUserLeaderboardStats(
  userId: string,
): Promise<UserLeaderboardStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leaderboard", { p_limit: 500 });
  if (error) throw error;

  const rows = (data ?? []) as LeaderboardRow[];
  const row = rows.find((r) => r.user_id === userId);

  if (row) {
    return {
      rank: row.rank,
      profit: row.profit,
      marketsTraded: row.markets_traded,
      tier: tierFromProfit(row.profit),
      onLeaderboard: true,
    };
  }

  // User traded but isn't in top 500 — compute profit from positions.
  const { data: positions } = await supabase
    .from("positions")
    .select("total_cost, total_payout, total_proceeds, market_id")
    .eq("user_id", userId);

  let profit = 0;
  const marketIds = new Set<string>();
  for (const p of positions ?? []) {
    profit += p.total_payout + p.total_proceeds - p.total_cost;
    marketIds.add(p.market_id);
  }

  return {
    rank: null,
    profit,
    marketsTraded: marketIds.size,
    tier: tierFromProfit(profit),
    onLeaderboard: false,
  };
}

export async function getStreaksForUsers(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, current_streak")
    .in("id", userIds);

  return new Map(
    (data ?? []).map((p) => [p.id, p.current_streak ?? 0]),
  );
}

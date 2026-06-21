import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TradeSide } from "@/lib/supabase/types";

export interface FollowingRow {
  leader_id: string;
  display_name: string;
  username: string | null;
  max_stake: number;
  auto_copy: boolean;
  follower_count: number;
}

export interface CopyableTrade {
  trade_id: string;
  leader_id: string;
  display_name: string;
  market_id: string;
  market_question: string;
  side: TradeSide;
  stake: number;
  created_at: string;
}

export interface CopyLeaderRow {
  rank: number;
  user_id: string;
  display_name: string;
  username: string | null;
  follower_count: number;
  copies_received: number;
}

export async function getMyFollowing(): Promise<FollowingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_following");
  if (error) throw error;
  return (data ?? []) as FollowingRow[];
}

export async function getCopyableTrades(limit = 20): Promise<CopyableTrade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_copyable_trades", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as CopyableTrade[];
}

export async function getCopyTraderLeaderboard(
  limit = 15,
): Promise<CopyLeaderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_trader_leaderboard", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as CopyLeaderRow[];
}

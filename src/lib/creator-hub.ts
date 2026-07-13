import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { MarketCategory } from "@/lib/supabase/types";

export interface CreatorStats {
  markets_created: number;
  recurring_series: number;
  total_volume: number;
  fee_earned: number;
  bonus_earned: number;
  bonus_near_count: number;
}

export interface CreatorLeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  total_volume: number;
  fee_earned: number;
  markets_created: number;
  series_count: number;
}

export interface CreatorMarketRow {
  market_id: string;
  question: string;
  status: string;
  volume: number;
  fee_earned: number;
  is_recurring: boolean;
}

export interface CreatorSeriesRow {
  series_id: string;
  title: string;
  fast_asset: string;
  interval_sec: number;
  enabled: boolean;
  windows_spawned: number;
  creator_fee_bps: number;
}

export interface MarketSuggestion {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: MarketCategory;
  yes_label: string;
  no_label: string;
  status: "pending" | "approved" | "rejected" | "spawned";
  vote_count: number;
  market_id: string | null;
  admin_note: string | null;
  created_at: string;
  display_name?: string;
  user_voted?: boolean;
}

export async function getCreatorStats(userId?: string): Promise<CreatorStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_creator_stats", {
    p_user_id: userId ?? undefined,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[creator-hub] get_creator_stats:", error.message);
    }
    return null;
  }
  const raw = data as Record<string, number> | null;
  if (!raw) return null;
  return {
    markets_created: raw.markets_created ?? 0,
    recurring_series: raw.recurring_series ?? 0,
    total_volume: raw.total_volume ?? 0,
    fee_earned: raw.fee_earned ?? 0,
    bonus_earned: raw.bonus_earned ?? 0,
    bonus_near_count: raw.bonus_near_count ?? 0,
  };
}

export async function getCreatorLeaderboard(
  limit = 25,
): Promise<CreatorLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("creator_leaderboard", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as CreatorLeaderboardRow[];
}

export async function getCreatorTopMarkets(
  userId?: string,
  limit = 8,
): Promise<CreatorMarketRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_creator_top_markets", {
    p_user_id: userId ?? undefined,
    p_limit: limit,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[creator-hub] get_creator_top_markets:", error.message);
    }
    return [];
  }
  return (data ?? []) as CreatorMarketRow[];
}

export async function getCreatorRecurringSeries(
  userId?: string,
  limit = 10,
): Promise<CreatorSeriesRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_creator_recurring_series", {
    p_user_id: userId ?? undefined,
    p_limit: limit,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[creator-hub] get_creator_recurring_series:", error.message);
    }
    return [];
  }
  return (data ?? []) as CreatorSeriesRow[];
}

export async function listMarketSuggestions(opts?: {
  status?: MarketSuggestion["status"] | "open";
  limit?: number;
  userId?: string;
}): Promise<MarketSuggestion[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("market_suggestions")
    .select(
      "id, user_id, title, description, category, yes_label, no_label, status, vote_count, market_id, admin_note, created_at",
    )
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 30);

  if (opts?.status === "open") {
    query = query.in("status", ["pending", "approved"]);
  } else if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  if (opts?.userId) {
    query = query.eq("user_id", opts.userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const nameByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      nameByUser.set(p.id, p.display_name);
    }
  }

  let votedIds = new Set<string>();
  if (user && rows.length) {
    const { data: votes } = await supabase
      .from("market_suggestion_votes")
      .select("suggestion_id")
      .eq("user_id", user.id)
      .in(
        "suggestion_id",
        rows.map((s) => s.id),
      );
    votedIds = new Set((votes ?? []).map((v) => v.suggestion_id));
  }

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category as MarketCategory,
    yes_label: row.yes_label,
    no_label: row.no_label,
    status: row.status as MarketSuggestion["status"],
    vote_count: row.vote_count,
    market_id: row.market_id,
    admin_note: row.admin_note,
    created_at: row.created_at,
    display_name: nameByUser.get(row.user_id) ?? "Anonymous",
    user_voted: votedIds.has(row.id),
  }));
}

export async function listPendingSuggestionsForAdmin(): Promise<MarketSuggestion[]> {
  return listMarketSuggestions({ status: "pending", limit: 50 });
}

export interface ModuleSubmission {
  id: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  created_at: string;
}

export interface CreatorHub {
  install_count: number;
  pending_proposals: number;
  approved_proposals: number;
  submissions: ModuleSubmission[];
}

export async function getMyCreatorHub(): Promise<CreatorHub | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_creator_hub");
  if (error || !data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const submissions = Array.isArray(o.submissions)
    ? (o.submissions as Record<string, unknown>[]).map((s) => ({
        id: String(s.id ?? ""),
        slug: String(s.slug ?? ""),
        name: String(s.name ?? ""),
        kind: String(s.kind ?? ""),
        status: String(s.status ?? "pending"),
        created_at: String(s.created_at ?? ""),
      }))
    : [];
  return {
    install_count: Number(o.install_count ?? 0),
    pending_proposals: Number(o.pending_proposals ?? 0),
    approved_proposals: Number(o.approved_proposals ?? 0),
    submissions,
  };
}

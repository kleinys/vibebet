import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Database,
  MarketCategory,
  MarketSource,
  MarketStatus,
} from "@/lib/supabase/types";

export type MarketSummary = Database["public"]["Views"]["markets_view"]["Row"];

export type MarketSort = "trending" | "new" | "closing" | "volume" | "mirror_volume";

export async function listMarkets(opts?: {
  status?: MarketStatus | "all";
  /** Optional explicit set of statuses to include. Wins over `status` if set. */
  statuses?: MarketStatus[];
  /** Filter by market source (platform / community / polymarket_mirror). */
  source?: MarketSource;
  /** Exclude a source (e.g. hide community from trending). */
  excludeSource?: MarketSource;
  /** Only binary markets (default). Set false to include categorical. */
  binaryOnly?: boolean;
  kind?: "binary" | "categorical";
  category?: MarketCategory;
  /** Filter mirrors (or all) by Polymarket event slug. */
  eventSlug?: string;
  search?: string;
  sort?: MarketSort;
  featured?: boolean;
  limit?: number;
}): Promise<MarketSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("markets_view")
    .select("*")
    .limit(opts?.limit ?? 50);

  if (opts?.statuses && opts.statuses.length > 0) {
    query = query.in("status", opts.statuses);
  } else {
    const status = opts?.status ?? "open";
    if (status !== "all") {
      query = query.eq("status", status);
    }
  }

  if (opts?.category) {
    query = query.eq("category", opts.category);
  }
  if (opts?.eventSlug) {
    query = query.eq("external_event_slug", opts.eventSlug);
  }
  if (opts?.source) {
    query = query.eq("source", opts.source);
  }
  if (opts?.kind) {
    query = query.eq("kind", opts.kind);
  } else if (opts?.binaryOnly !== false) {
    query = query.eq("kind", "binary");
  }
  if (opts?.featured) {
    query = query.eq("is_featured", true);
  }
  if (opts?.search && opts.search.trim().length > 0) {
    // Case-insensitive substring on the question. We escape `%` and `,`.
    const term = opts.search.trim().slice(0, 100).replace(/[%,]/g, " ");
    query = query.ilike("question", `%${term}%`);
  }

  switch (opts?.sort ?? "new") {
    case "trending":
      query = query.order("volume_24h", { ascending: false });
      break;
    case "volume":
      query = query.order("volume", { ascending: false });
      break;
    case "mirror_volume":
      query = query.order("external_volume_24h_usd", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "closing":
      // Closing soonest first; nulls (no close date) last.
      query = query.order("closes_at", { ascending: true, nullsFirst: false });
      break;
    case "new":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = data ?? [];
  if (opts?.excludeSource) {
    rows = rows.filter((m) => m.source !== opts.excludeSource);
  }
  return rows;
}

/**
 * Markets with the largest absolute price move in the last 24h ("Breaking").
 * Returns markets sorted by |yes_price - yes_price_24h_ago| desc.
 * Filters out markets with no 24h activity.
 */
export async function listBreakingMarkets(limit = 6): Promise<MarketSummary[]> {
  // Fetch a wider pool then sort in JS by |delta|; doing this in SQL would
  // require a custom RPC. The pool size is bounded so latency is fine.
  const pool = await listMarkets({
    status: "open",
    sort: "mirror_volume",
    limit: 50,
    excludeSource: "community",
  });
  return pool
    .filter((m) => m.volume_24h > 0)
    .map((m) => ({ m, delta: Math.abs(m.yes_price - m.yes_price_24h_ago) }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit)
    .map(({ m }) => m);
}

export async function getMarket(id: string): Promise<MarketSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("markets_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getUserPosition(
  marketId: string,
  userId: string,
): Promise<{
  yesShares: number;
  noShares: number;
  totalCost: number;
  totalPayout: number;
  totalProceeds: number;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("positions")
    .select("yes_shares, no_shares, total_cost, total_payout, total_proceeds")
    .eq("market_id", marketId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    yesShares: data.yes_shares,
    noShares: data.no_shares,
    totalCost: data.total_cost,
    totalPayout: data.total_payout,
    totalProceeds: data.total_proceeds,
  };
}

export async function getRecentTrades(marketId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("id, side, cost, shares, created_at, user_id")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface PricePoint {
  /** Unix ms — convenient for Recharts XAxis. */
  t: number;
  /** YES price in [0, 1]. */
  yesPrice: number;
  /** |cost| of the trade that produced this point. */
  volume: number;
}

/**
 * Derives the YES-price time series for a market from `trades`. Each trade
 * stores the post-trade reserves, so price after that trade is
 *   reserve_no_after / (reserve_yes_after + reserve_no_after).
 *
 * We synthesize a leading point at market creation time with price 0.5
 * (initial subsidy is always equal on both sides), so a market with zero
 * trades still renders a flat baseline.
 *
 * Returns points oldest → newest, ready for a chart.
 */
export async function getPriceHistory(
  marketId: string,
  opts?: { limit?: number },
): Promise<PricePoint[]> {
  const supabase = await createClient();

  const [{ data: market }, { data: trades, error }] = await Promise.all([
    supabase
      .from("markets")
      .select("created_at")
      .eq("id", marketId)
      .maybeSingle(),
    supabase
      .from("trades")
      .select("cost, reserve_yes_after, reserve_no_after, created_at")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true })
      .limit(opts?.limit ?? 1000),
  ]);

  if (error) throw error;

  const points: PricePoint[] = [];
  if (market?.created_at) {
    points.push({
      t: new Date(market.created_at).getTime(),
      yesPrice: 0.5,
      volume: 0,
    });
  }

  for (const t of trades ?? []) {
    const sum = t.reserve_yes_after + t.reserve_no_after;
    const yesPrice = sum > 0 ? t.reserve_no_after / sum : 0.5;
    points.push({
      t: new Date(t.created_at).getTime(),
      yesPrice,
      volume: Math.abs(t.cost),
    });
  }

  return points;
}

export async function getCreatorName(creatorId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", creatorId)
    .maybeSingle();
  return data?.display_name ?? "Anonymous";
}

export interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  display_name: string;
}

export async function getComments(
  marketId: string,
  limit = 100,
): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_comments")
    .select("id, body, created_at, user_id")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const userIds = Array.from(new Set(data.map((c) => c.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return data.map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    user_id: c.user_id,
    display_name: byId.get(c.user_id) ?? "Anonymous",
  }));
}

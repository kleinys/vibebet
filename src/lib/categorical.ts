import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lmsrPrices } from "@/lib/lmsr";
import type { MarketCategory, MarketStatus } from "@/lib/supabase/types";

export interface CategoricalOutcome {
  outcome_index: number;
  label: string;
  image_url: string | null;
  shares: number;
  probability: number;
}

export interface CategoricalMarket {
  id: string;
  question: string;
  description: string | null;
  status: string;
  category: MarketCategory;
  creator_id: string;
  closes_at: string | null;
  lmsr_b: number;
  image_url: string | null;
  volume: number;
  trade_count: number;
  proposed_outcome_index: number | null;
  challenge_deadline: string | null;
  outcomes: CategoricalOutcome[];
}

function parseCategoricalRow(data: {
  id: string;
  question: string;
  description: string | null;
  status: string;
  category: string;
  creator_id: string;
  closes_at: string | null;
  lmsr_b: number | null;
  image_url: string | null;
  volume: number | null;
  trade_count: number | null;
  proposed_outcome_index?: number | null;
  challenge_deadline?: string | null;
  outcomes: unknown;
}): CategoricalMarket {
  const rawOutcomes = (data.outcomes ?? []) as Array<{
    outcome_index: number;
    label: string;
    image_url?: string | null;
    shares: number;
  }>;

  const q = rawOutcomes.map((o) => Number(o.shares ?? 0));
  const b = Number(data.lmsr_b ?? 1);
  const prices = lmsrPrices(q, b);

  const outcomes: CategoricalOutcome[] = rawOutcomes.map((o, i) => ({
    outcome_index: o.outcome_index,
    label: o.label,
    image_url: o.image_url ?? null,
    shares: Number(o.shares ?? 0),
    probability: prices[i] ?? 1 / Math.max(rawOutcomes.length, 1),
  }));

  return {
    id: data.id,
    question: data.question,
    description: data.description,
    status: data.status,
    category: data.category as MarketCategory,
    creator_id: data.creator_id,
    closes_at: data.closes_at,
    lmsr_b: b,
    image_url: data.image_url,
    volume: Number(data.volume ?? 0),
    trade_count: Number(data.trade_count ?? 0),
    proposed_outcome_index: data.proposed_outcome_index ?? null,
    challenge_deadline: data.challenge_deadline ?? null,
    outcomes,
  };
}

export async function listCategoricalMarkets(opts?: {
  status?: MarketStatus | "all";
  statuses?: MarketStatus[];
  category?: MarketCategory;
  search?: string;
  limit?: number;
}): Promise<CategoricalMarket[]> {
  const supabase = await createClient();
  let query = supabase
    .from("categorical_market_view")
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

  if (opts?.category) query = query.eq("category", opts.category);

  if (opts?.search?.trim()) {
    const term = opts.search.trim().slice(0, 100).replace(/[%,]/g, " ");
    query = query.ilike("question", `%${term}%`);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => parseCategoricalRow(row as never));
}

export async function getCategoricalMarket(
  id: string,
): Promise<CategoricalMarket | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorical_market_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return parseCategoricalRow(data as never);
}

export async function getCategoricalPosition(
  marketId: string,
  userId: string,
): Promise<Map<number, { shares: number; totalCost: number }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorical_positions")
    .select("outcome_index, shares, total_cost")
    .eq("market_id", marketId)
    .eq("user_id", userId);
  if (error) throw error;

  const map = new Map<number, { shares: number; totalCost: number }>();
  for (const row of data ?? []) {
    map.set(row.outcome_index, {
      shares: row.shares,
      totalCost: row.total_cost,
    });
  }
  return map;
}

export interface CategoricalPricePoint {
  t: number;
  prices: number[];
  volume: number;
}

/** Replays categorical trades to build an LMSR probability time series. */
export async function getCategoricalPriceHistory(
  marketId: string,
  outcomeCount: number,
  lmsrB: number,
  opts?: { limit?: number },
): Promise<CategoricalPricePoint[]> {
  const supabase = await createClient();

  const [{ data: market }, { data: trades, error }] = await Promise.all([
    supabase
      .from("markets")
      .select("created_at")
      .eq("id", marketId)
      .maybeSingle(),
    supabase
      .from("trades")
      .select("outcome_index, shares, cost, created_at")
      .eq("market_id", marketId)
      .not("outcome_index", "is", null)
      .order("created_at", { ascending: true })
      .limit(opts?.limit ?? 1000),
  ]);

  if (error) throw error;

  const q = new Array(outcomeCount).fill(0);
  const points: CategoricalPricePoint[] = [];

  if (market?.created_at) {
    points.push({
      t: new Date(market.created_at).getTime(),
      prices: lmsrPrices(q, lmsrB),
      volume: 0,
    });
  }

  for (const trade of trades ?? []) {
    const idx = trade.outcome_index;
    if (idx != null && idx >= 0 && idx < outcomeCount) {
      q[idx] += trade.shares;
    }
    points.push({
      t: new Date(trade.created_at).getTime(),
      prices: lmsrPrices([...q], lmsrB),
      volume: Math.abs(trade.cost),
    });
  }

  return points;
}

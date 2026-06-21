import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ProductMetrics {
  period_days: number;
  signups: number;
  first_bets: number;
  first_bet_rate_pct: number;
  d1_retention_pct: number;
  d7_retention_pct: number;
  disputes_opened: number;
  court_votes: number;
  votes_per_dispute: number;
  active_traders: number;
}

export async function getProductMetrics(days = 7): Promise<ProductMetrics | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_product_metrics", { p_days: days });
  if (error) return null;
  const raw = data as Record<string, unknown> | null;
  if (!raw) return null;
  return {
    period_days: Number(raw.period_days ?? days),
    signups: Number(raw.signups ?? 0),
    first_bets: Number(raw.first_bets ?? 0),
    first_bet_rate_pct: Number(raw.first_bet_rate_pct ?? 0),
    d1_retention_pct: Number(raw.d1_retention_pct ?? 0),
    d7_retention_pct: Number(raw.d7_retention_pct ?? 0),
    disputes_opened: Number(raw.disputes_opened ?? 0),
    court_votes: Number(raw.court_votes ?? 0),
    votes_per_dispute: Number(raw.votes_per_dispute ?? 0),
    active_traders: Number(raw.active_traders ?? 0),
  };
}

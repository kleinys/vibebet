import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface WeeklyDigest {
  week_start: string;
  week_label: string;
  trades_count: number;
  volume: number;
  wins: number;
  losses: number;
  profit_estimate: number;
  top_market: string | null;
  email_digest_enabled: boolean;
}

export async function getWeeklyDigest(): Promise<WeeklyDigest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_weekly_digest");
  if (error) return null;
  const raw = data as Record<string, unknown> | null;
  if (!raw) return null;
  return {
    week_start: String(raw.week_start),
    week_label: String(raw.week_label ?? ""),
    trades_count: Number(raw.trades_count ?? 0),
    volume: Number(raw.volume ?? 0),
    wins: Number(raw.wins ?? 0),
    losses: Number(raw.losses ?? 0),
    profit_estimate: Number(raw.profit_estimate ?? 0),
    top_market: (raw.top_market as string) ?? null,
    email_digest_enabled: Boolean(raw.email_digest_enabled),
  };
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  HustleEquityState,
  HustleShareLedgerEntry,
} from "@/lib/hustle/shared";

export type { HustleEquityState, HustleShareLedgerEntry } from "@/lib/hustle/shared";
export { formatShares } from "@/lib/hustle/shared";

export async function getHustleEquity(): Promise<HustleEquityState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hustle_equity");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as unknown as Record<string, unknown>;
  if (!row.authenticated) return null;

  const history = Array.isArray(row.history)
    ? (row.history as Record<string, unknown>[]).map((h) => ({
        id: String(h.id),
        delta_shares: Number(h.delta_shares),
        hustle_cash_delta: Number(h.hustle_cash_delta),
        kind: String(h.kind),
        created_at: String(h.created_at),
      }))
    : [];

  return {
    authenticated: true,
    hustle_shares: Number(row.hustle_shares ?? 0),
    hustle_cash: Number(row.hustle_cash ?? 0),
    hustle_tier: Number(row.hustle_tier ?? 1),
    floor_cash_value: Number(row.floor_cash_value ?? 0),
    convert_rate: Number(row.convert_rate ?? 100),
    floor_redeem_rate: Number(row.floor_redeem_rate ?? 90),
    max_shares: Number(row.max_shares ?? 100),
    min_convert_tier: Number(row.min_convert_tier ?? 3),
    min_redeem_tier: Number(row.min_redeem_tier ?? 4),
    daily_convert_limit: Number(row.daily_convert_limit ?? 5000),
    daily_converted_today: Number(row.daily_converted_today ?? 0),
    can_convert: Boolean(row.can_convert),
    can_redeem: Boolean(row.can_redeem),
    history,
  };
}

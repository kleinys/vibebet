import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  HustlePendingTransfer,
  HustleTransferDirection,
  HustleWalletState,
} from "@/lib/hustle/shared";

export type {
  HustlePendingTransfer,
  HustleTransferDirection,
  HustleWalletState,
} from "@/lib/hustle/shared";

export async function getHustleWallet(): Promise<HustleWalletState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hustle_wallet");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as unknown as Record<string, unknown>;
  if (!row.authenticated) return null;

  const pending = Array.isArray(row.pending_transfers)
    ? (row.pending_transfers as Record<string, unknown>[]).map((t) => ({
        id: String(t.id),
        direction: t.direction as HustleTransferDirection,
        amount: Number(t.amount),
        fee: Number(t.fee ?? 0),
        status: String(t.status),
        requested_at: String(t.requested_at),
        completes_at: t.completes_at ? String(t.completes_at) : null,
      }))
    : [];

  return {
    authenticated: true,
    hustle_cash: Number(row.hustle_cash ?? 0),
    play_balance: Number(row.play_balance ?? 0),
    daily_limit_earn_to_play: Number(row.daily_limit_earn_to_play ?? 1000),
    weekly_limit_earn_to_play: Number(row.weekly_limit_earn_to_play ?? 5000),
    daily_used_earn_to_play: Number(row.daily_used_earn_to_play ?? 0),
    daily_used_play_to_earn: Number(row.daily_used_play_to_earn ?? 0),
    self_exclude_until: row.self_exclude_until ? String(row.self_exclude_until) : null,
    pending_transfers: pending,
    cooling_threshold: Number(row.cooling_threshold ?? 50),
    earn_to_play_fee_pct: Number(row.earn_to_play_fee_pct ?? 0),
    play_to_earn_fee_pct: Number(row.play_to_earn_fee_pct ?? 5),
  };
}

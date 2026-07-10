import "server-only";
import { createClient } from "@/lib/supabase/server";

export type HustleTransferDirection = "earn_to_play" | "play_to_earn";

export interface HustlePendingTransfer {
  id: string;
  direction: HustleTransferDirection;
  amount: number;
  fee: number;
  status: string;
  requested_at: string;
  completes_at: string | null;
}

export interface HustleWalletState {
  authenticated: boolean;
  hustle_cash: number;
  play_balance: number;
  daily_limit_earn_to_play: number;
  weekly_limit_earn_to_play: number;
  daily_used_earn_to_play: number;
  daily_used_play_to_earn: number;
  self_exclude_until: string | null;
  pending_transfers: HustlePendingTransfer[];
  cooling_threshold: number;
  earn_to_play_fee_pct: number;
  play_to_earn_fee_pct: number;
}

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

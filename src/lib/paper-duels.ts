import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FastAsset } from "@/lib/fast-assets";

export interface OpenPaperDuel {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_asset: FastAsset;
  duration_sec: number;
  stake: number;
  created_at: string;
  expires_at: string;
}

export interface ActivePaperDuel {
  id: string;
  creator_name: string;
  opponent_name: string;
  creator_asset: FastAsset;
  opponent_asset: FastAsset;
  duration_sec: number;
  stake: number;
  creator_start_price: number;
  opponent_start_price: number;
  creator_return_pct: number | null;
  opponent_return_pct: number | null;
  started_at: string;
  ends_at: string;
}

export interface MyPaperDuel {
  id: string;
  creator_id: string;
  creator_name: string;
  opponent_id: string | null;
  opponent_name: string | null;
  creator_asset: FastAsset;
  opponent_asset: FastAsset | null;
  duration_sec: number;
  stake: number;
  status: string;
  creator_return_pct: number | null;
  opponent_return_pct: number | null;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  ends_at: string | null;
  settled_at: string | null;
}

export interface PaperDuelDetail {
  id: string;
  creator_id: string;
  creator_name: string;
  opponent_id: string | null;
  opponent_name: string | null;
  creator_asset: FastAsset;
  opponent_asset: FastAsset | null;
  duration_sec: number;
  stake: number;
  status: string;
  creator_start_price: number | null;
  opponent_start_price: number | null;
  creator_end_price: number | null;
  opponent_end_price: number | null;
  creator_return_pct: number | null;
  opponent_return_pct: number | null;
  winner_id: string | null;
  started_at: string | null;
  ends_at: string | null;
  settled_at: string | null;
}

export function computeReturnPct(start: number, current: number): number {
  if (!start || start <= 0) return 0;
  return ((current - start) / start) * 100;
}

export async function tickPaperDuels(
  prices: { asset: string; price: number }[],
): Promise<{ settled: number; expired: number } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("paper_duel_tick", {
      p_prices: prices,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[paper-duels] tick:", error.message);
      }
      return null;
    }
    const raw = data as { settled?: number; expired?: number } | null;
    return { settled: raw?.settled ?? 0, expired: raw?.expired ?? 0 };
  } catch {
    return null;
  }
}

export async function getOpenPaperDuels(limit = 20): Promise<OpenPaperDuel[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_open_paper_duels", {
      p_limit: limit,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[paper-duels] open:", error.message);
      }
      return [];
    }
    return (data ?? []) as OpenPaperDuel[];
  } catch {
    return [];
  }
}

export async function getActivePaperDuels(
  limit = 15,
): Promise<ActivePaperDuel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_paper_duels", {
    p_limit: limit,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[paper-duels] active:", error.message);
    }
    return [];
  }
  return (data ?? []) as ActivePaperDuel[];
}

export async function getMyPaperDuels(limit = 25): Promise<MyPaperDuel[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_my_paper_duels", {
      p_limit: limit,
    });
    if (error) return [];
    return (data ?? []) as MyPaperDuel[];
  } catch {
    return [];
  }
}

export async function getPaperDuel(id: string): Promise<PaperDuelDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_paper_duel", {
    p_duel_id: id,
  });
  if (error || !data) return null;
  const raw = data as Record<string, unknown>;
  return {
    id: String(raw.id),
    creator_id: String(raw.creator_id),
    creator_name: String(raw.creator_name ?? "Anonymous"),
    opponent_id: raw.opponent_id ? String(raw.opponent_id) : null,
    opponent_name: raw.opponent_name ? String(raw.opponent_name) : null,
    creator_asset: String(raw.creator_asset) as FastAsset,
    opponent_asset: raw.opponent_asset
      ? (String(raw.opponent_asset) as FastAsset)
      : null,
    duration_sec: Number(raw.duration_sec),
    stake: Number(raw.stake),
    status: String(raw.status),
    creator_start_price: raw.creator_start_price != null ? Number(raw.creator_start_price) : null,
    opponent_start_price: raw.opponent_start_price != null ? Number(raw.opponent_start_price) : null,
    creator_end_price: raw.creator_end_price != null ? Number(raw.creator_end_price) : null,
    opponent_end_price: raw.opponent_end_price != null ? Number(raw.opponent_end_price) : null,
    creator_return_pct: raw.creator_return_pct != null ? Number(raw.creator_return_pct) : null,
    opponent_return_pct: raw.opponent_return_pct != null ? Number(raw.opponent_return_pct) : null,
    winner_id: raw.winner_id ? String(raw.winner_id) : null,
    started_at: raw.started_at ? String(raw.started_at) : null,
    ends_at: raw.ends_at ? String(raw.ends_at) : null,
    settled_at: raw.settled_at ? String(raw.settled_at) : null,
  };
}

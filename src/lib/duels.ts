import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TradeSide } from "@/lib/supabase/types";

export interface OpenDuel {
  id: string;
  challenger_id: string;
  challenger_name: string;
  opponent_id: string | null;
  opponent_name: string | null;
  market_id: string;
  market_question: string;
  challenger_side: TradeSide;
  stake: number;
  status: string;
  created_at: string;
  expires_at: string;
  spectator_market_id: string | null;
}

export interface MyDuel extends OpenDuel {
  opponent_side: TradeSide | null;
  winner_id: string | null;
  accepted_at: string | null;
  settled_at: string | null;
}

export interface SpectatorDuel {
  duel_id: string;
  challenger_name: string;
  opponent_name: string;
  market_question: string;
  underlying_market_id: string;
  spectator_market_id: string;
  stake: number;
  accepted_at: string | null;
}

export async function getOpenDuels(limit = 20): Promise<OpenDuel[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_open_duels", { p_limit: limit });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[duels] open:", error.message);
      }
      return [];
    }
    return (data ?? []) as OpenDuel[];
  } catch {
    return [];
  }
}

export async function getMyDuels(limit = 30): Promise<MyDuel[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_my_duels", { p_limit: limit });
    if (error) return [];
    return (data ?? []) as MyDuel[];
  } catch {
    return [];
  }
}

export interface DuelDetail {
  id: string;
  status: string;
  challenger_id: string;
  challenger_name: string;
  opponent_id: string | null;
  opponent_name: string;
  challenger_side: TradeSide;
  opponent_side: TradeSide | null;
  stake: number;
  market_id: string;
  market_question: string;
  market_status: string;
  spectator_market_id: string | null;
  spectator_reserve_yes: number | null;
  spectator_reserve_no: number | null;
  spectator_yes_label: string | null;
  spectator_no_label: string | null;
  spectator_status: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export async function getDuel(id: string): Promise<DuelDetail | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_duel", { p_duel_id: id });
    if (error || !data) return null;
    return data as unknown as DuelDetail;
  } catch {
    return null;
  }
}

export async function getActiveSpectatorDuels(
  limit = 15,
): Promise<SpectatorDuel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_spectator_duels", {
    p_limit: limit,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[duels] get_active_spectator_duels:", error.message);
    }
    return [];
  }
  return (data ?? []) as SpectatorDuel[];
}

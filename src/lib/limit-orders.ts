import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TradeSide } from "@/lib/supabase/types";

export interface LimitOrderRow {
  id: string;
  market_id: string;
  market_question: string;
  side: TradeSide;
  limit_price: number;
  stake: number;
  status: string;
  created_at: string;
  expires_at: string;
  filled_at: string | null;
}

export async function getMyLimitOrders(limit = 30): Promise<LimitOrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_limit_orders", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as LimitOrderRow[];
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";
import type { MarketSummary } from "@/lib/markets";

export interface FastMarketTickResult {
  resolved: number;
  spawned: number;
}

export interface PriceTick {
  t: number;
  price: number;
}

async function getTickClient() {
  try {
    return createAdminClient();
  } catch {
    return createClient();
  }
}

export async function tickFastMarkets(
  prices?: Array<{ asset: string; price: number }>,
): Promise<FastMarketTickResult | null> {
  try {
    let payload: Array<{ asset: string; price: number }>;
    if (prices && prices.length > 0) {
      payload = prices;
    } else {
      const spot = await fetchCryptoSpotPrices();
      if (spot.length === 0) return null;
      payload = spot.map((p) => ({ asset: p.asset, price: p.price }));
    }

    const supabase = await getTickClient();
    const { data, error } = await supabase.rpc("record_fast_market_tick", {
      p_prices: payload,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[fast-markets] tick:", error.message);
      }
      return null;
    }
    const raw = data as { resolved?: number; spawned?: number } | null;
    return {
      resolved: raw?.resolved ?? 0,
      spawned: raw?.spawned ?? 0,
    };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fast-markets] tick:", e);
    }
    return null;
  }
}

export async function listFastMarkets(
  limit = 12,
  category?: "crypto" | "finance",
): Promise<MarketSummary[]> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("markets_view")
      .select("*")
      .not("fast_asset", "is", null)
      .eq("status", "open")
      .order("window_end", { ascending: true })
      .limit(limit);
    if (category) {
      query = query.eq("category", category);
    }
    const { data, error } = await query;
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[fast-markets] list:", error.message);
      }
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export async function getAssetPriceHistory(
  asset: string,
  sinceMs?: number,
): Promise<PriceTick[]> {
  const supabase = await createClient();
  let query = supabase
    .from("asset_price_ticks")
    .select("price_usd, recorded_at")
    .eq("asset", asset.toLowerCase())
    .order("recorded_at", { ascending: true })
    .limit(120);

  if (sinceMs) {
    query = query.gte("recorded_at", new Date(sinceMs).toISOString());
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => ({
    t: new Date(row.recorded_at).getTime(),
    price: Number(row.price_usd),
  }));
}

export function isFastMarket(
  market: Pick<
    MarketSummary,
    "fast_asset" | "window_end" | "strike_price"
  >,
): boolean {
  return market.fast_asset != null;
}

export function fastWindowRemainingMs(windowEnd: string | null): number {
  if (!windowEnd) return 0;
  return Math.max(0, new Date(windowEnd).getTime() - Date.now());
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics";
import { tryReferralFirstBetReward } from "@/lib/referrals";

const BuySchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(["yes", "no"]),
  cost: z.coerce.number().int().min(1).max(1_000_000),
});

const SellSchema = z.object({
  marketId: z.string().uuid(),
  side: z.enum(["yes", "no"]),
  shares: z.coerce.number().int().min(1).max(10_000_000_000),
});

export type TradeState =
  | { error: string }
  | { success: { kind: "buy"; shares: number; side: "yes" | "no" } }
  | { success: { kind: "sell"; proceeds: number; side: "yes" | "no" } }
  | { success: { kind: "quick_exit"; proceeds: number; side: "yes" | "no" } }
  | null;

export type CategoricalTradeState =
  | { error: string }
  | { success: { shares: number; outcomeIndex: number } }
  | null;

export async function placeCategoricalTrade(
  _prev: CategoricalTradeState,
  formData: FormData,
): Promise<CategoricalTradeState> {
  const schema = z.object({
    marketId: z.string().uuid(),
    outcomeIndex: z.coerce.number().int().min(0).max(7),
    cost: z.coerce.number().int().min(10).max(1_000_000),
  });
  const parsed = schema.safeParse({
    marketId: formData.get("marketId"),
    outcomeIndex: formData.get("outcomeIndex"),
    cost: formData.get("cost"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_categorical_trade", {
    p_market_id: parsed.data.marketId,
    p_outcome_index: parsed.data.outcomeIndex,
    p_cost: parsed.data.cost,
  });
  if (error) return { error: error.message };

  await supabase.rpc("check_achievements");
  await supabase.rpc("grant_battle_pass_xp", { p_amount: 10 });
  await supabase.rpc("maybe_grant_creator_bonus", {
    p_market_id: parsed.data.marketId,
  });

  revalidatePath(`/markets/${parsed.data.marketId}`);
  revalidatePath("/markets");
  revalidatePath("/");
  return {
    success: {
      shares: Number(data ?? 0),
      outcomeIndex: parsed.data.outcomeIndex,
    },
  };
}

export async function placeTrade(
  _prev: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const parsed = BuySchema.safeParse({
    marketId: formData.get("marketId"),
    side: formData.get("side"),
    cost: formData.get("cost"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_trade", {
    p_market_id: parsed.data.marketId,
    p_side: parsed.data.side,
    p_cost: parsed.data.cost,
  });

  if (error) return { error: error.message };

  await trackEvent("first_bet_placed", {
    market_id: parsed.data.marketId,
    side: parsed.data.side,
    cost: parsed.data.cost,
  });

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "Trade returned no result." };

  await supabase.rpc("check_achievements");
  await supabase.rpc("grant_battle_pass_xp", { p_amount: 10 });
  await supabase.rpc("maybe_grant_creator_bonus", {
    p_market_id: parsed.data.marketId,
  });
  await tryReferralFirstBetReward();

  revalidatePath(`/markets/${parsed.data.marketId}`);
  revalidatePath("/markets");
  revalidatePath("/");
  return {
    success: { kind: "buy", shares: row.shares_received, side: parsed.data.side },
  };
}

export async function sellShares(
  _prev: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const parsed = SellSchema.safeParse({
    marketId: formData.get("marketId"),
    side: formData.get("side"),
    shares: formData.get("shares"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sell_shares", {
    p_market_id: parsed.data.marketId,
    p_side: parsed.data.side,
    p_shares: parsed.data.shares,
  });

  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "Sell returned no result." };

  await supabase.rpc("check_achievements");
  await supabase.rpc("grant_battle_pass_xp", { p_amount: 10 });
  await supabase.rpc("maybe_grant_creator_bonus", {
    p_market_id: parsed.data.marketId,
  });

  revalidatePath(`/markets/${parsed.data.marketId}`);
  revalidatePath("/markets");
  revalidatePath("/");
  return {
    success: { kind: "sell", proceeds: row.proceeds, side: parsed.data.side },
  };
}

export async function quickExitShares(
  _prev: TradeState,
  formData: FormData,
): Promise<TradeState> {
  const parsed = SellSchema.safeParse({
    marketId: formData.get("marketId"),
    side: formData.get("side"),
    shares: formData.get("shares"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quick_exit_shares", {
    p_market_id: parsed.data.marketId,
    p_side: parsed.data.side,
    p_shares: parsed.data.shares,
  });

  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "Quick exit returned no result." };

  revalidatePath(`/markets/${parsed.data.marketId}`);
  revalidatePath("/markets");
  revalidatePath("/");
  return {
    success: {
      kind: "quick_exit",
      proceeds: row.proceeds,
      side: parsed.data.side,
    },
  };
}

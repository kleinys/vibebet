"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function createLimitOrder(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({
      marketId: z.string().uuid(),
      side: z.enum(["yes", "no"]),
      limitPct: z.coerce.number().min(1).max(99),
      stake: z.coerce.number().int().min(10).max(100_000),
      expiresDays: z.coerce.number().int().min(1).max(30).optional(),
    })
    .safeParse({
      marketId: formData.get("marketId"),
      side: formData.get("side"),
      limitPct: formData.get("limitPct"),
      stake: formData.get("stake"),
      expiresDays: formData.get("expiresDays") ?? 7,
    });
  if (!parsed.success) return { error: "Invalid limit order." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_limit_order", {
    p_market_id: parsed.data.marketId,
    p_side: parsed.data.side,
    p_limit_price: parsed.data.limitPct / 100,
    p_stake: parsed.data.stake,
    p_expires_days: parsed.data.expiresDays ?? 7,
  });
  if (error) return { error: error.message };

  revalidatePath("/limit-orders");
  revalidatePath(`/markets/${parsed.data.marketId}`);
  return { ok: "Limit order placed — VIBE escrowed until fill or cancel." };
}

export async function cancelLimitOrder(orderId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_limit_order", {
    p_order_id: orderId,
  });
  if (error) return { error: error.message };
  revalidatePath("/limit-orders");
  return {};
}

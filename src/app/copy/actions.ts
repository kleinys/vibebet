"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function followTrader(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({
      username: z.string().trim().min(2),
      maxStake: z.coerce.number().int().min(10).max(10_000),
      autoCopy: z
        .enum(["on", "off"])
        .transform((v) => v === "on")
        .optional(),
    })
    .safeParse({
      username: formData.get("username"),
      maxStake: formData.get("maxStake"),
      autoCopy: formData.get("autoCopy") ?? "off",
    });
  if (!parsed.success) return { error: "Invalid follow details." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("follow_trader", {
    p_username: parsed.data.username.replace(/^@/, ""),
    p_max_stake: parsed.data.maxStake,
    p_auto_copy: parsed.data.autoCopy ?? false,
  });
  if (error) return { error: error.message };

  revalidatePath("/copy");
  return { ok: `Now following @${parsed.data.username.replace(/^@/, "")}.` };
}

export async function unfollowTrader(leaderId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unfollow_trader", {
    p_leader_id: leaderId,
  });
  if (error) return { error: error.message };
  revalidatePath("/copy");
  return {};
}

export async function copyTrade(
  tradeId: string,
  stake?: number,
): Promise<{ error?: string; ok?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("copy_trade", {
    p_source_trade_id: tradeId,
    p_stake: stake ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/copy");
  revalidatePath("/markets");
  return { ok: "Bet copied!" };
}

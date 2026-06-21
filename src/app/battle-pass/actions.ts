"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type BattlePassState = { error?: string; ok?: string } | null;

export async function claimTierAction(
  _prev: BattlePassState,
  formData: FormData,
): Promise<BattlePassState> {
  const parsed = z
    .object({
      tier: z.coerce.number().int().min(1).max(30),
      premium: z.enum(["yes", "no"]),
    })
    .safeParse({
      tier: formData.get("tier"),
      premium: formData.get("premium"),
    });
  if (!parsed.success) return { error: "Invalid tier." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_battle_pass_tier", {
    p_tier: parsed.data.tier,
    p_premium: parsed.data.premium === "yes",
  });
  if (error) return { error: error.message };

  revalidatePath("/battle-pass");
  return { ok: `Claimed ${data} VIBE.` };
}

export async function unlockPremiumAction(): Promise<BattlePassState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_battle_pass_premium");
  if (error) return { error: error.message };
  revalidatePath("/battle-pass");
  return { ok: "Premium track unlocked." };
}

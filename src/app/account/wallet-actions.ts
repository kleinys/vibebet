"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function requestGemWithdrawal(gems: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_gem_withdrawal", {
    p_gems: gems,
    p_method: "paypal",
  });
  if (error) return { error: error.message };
  revalidatePath("/account");
  return { ok: `Withdrawal request submitted (${gems} Gems).`, id: String(data) };
}

export async function convertGemsToVibe(gems: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_gems_to_vibe", { p_gems: gems });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  const vibe = row?.vibe_received ?? gems * 10;
  revalidatePath("/account");
  return { ok: `Converted ${gems} Gems → ${Number(vibe).toLocaleString()} VIBE.` };
}

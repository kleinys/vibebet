"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimGuildQuestReward(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_guild_quest_reward");
  if (error) return { error: error.message };
  if (!(data as { ok?: boolean } | null)?.ok) {
    return { error: "Could not claim reward." };
  }
  revalidatePath("/guilds");
  revalidatePath("/account");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimQuest(
  questId: string,
): Promise<{ error?: string; reward?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_quest_reward", {
    p_quest_id: questId,
  });
  if (error) return { error: error.message };
  revalidatePath("/account/quests");
  revalidatePath("/account");
  return { reward: Number(data ?? 0) };
}

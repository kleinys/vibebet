"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimDailyHustleReward(
  taskId: string,
): Promise<{ error?: string; amount?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_daily_hustle_reward", {
    p_task_id: taskId,
  });
  if (error) return { error: error.message };

  revalidatePath("/play");
  revalidatePath("/account/hustle");
  revalidatePath("/account/quests");
  return { amount: Number(data) };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function installPlatformModule(
  slug: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("install_platform_module", {
    p_slug: slug,
  });
  if (error) return { error: error.message };
  revalidatePath("/apps");
  revalidatePath(`/apps/${slug}`);
  revalidatePath("/account/profile");
  return {};
}

export async function joinArenaRaid(): Promise<{
  error?: string;
  settled?: boolean;
  reward_per_user?: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_arena_raid");
  if (error) return { error: error.message };
  const row = data as Record<string, unknown> | null;
  revalidatePath("/play");
  return {
    settled: Boolean(row?.settled),
    reward_per_user:
      row?.reward_per_user != null ? Number(row.reward_per_user) : undefined,
  };
}

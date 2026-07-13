"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function dismissVibePass(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dismiss_vibe_pass");
  if (error) return { error: error.message };
  const raw = data as { error?: string } | null;
  if (raw?.error) return { error: raw.error };
  revalidatePath("/", "layout");
  return {};
}

export async function setCompanionName(
  name: string,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_companion_name", {
    p_name: name,
  });
  if (error) return { error: error.message };
  const raw = data as { error?: string; ok?: boolean } | null;
  if (raw?.error) return { error: raw.error };
  revalidatePath("/", "layout");
  return { ok: true };
}

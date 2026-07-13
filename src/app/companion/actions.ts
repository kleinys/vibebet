"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function startCompanionExpedition(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_companion_expedition");
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function claimCompanionExpedition(): Promise<{
  error?: string;
  claimed_vibe?: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_companion_expedition");
  if (error) return { error: error.message };
  const row = data as Record<string, unknown> | null;
  revalidatePath("/", "layout");
  return {
    claimed_vibe:
      row?.claimed_vibe != null ? Number(row.claimed_vibe) : undefined,
  };
}

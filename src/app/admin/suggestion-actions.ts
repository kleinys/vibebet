"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as Record<string, unknown>)?.role;
  if (!user || role !== "admin") {
    return { supabase, error: "Admin only." as const };
  }
  return { supabase, error: null };
}

export async function adminSpawnSuggestion(
  suggestionId: string,
): Promise<{ error?: string; marketId?: string }> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };

  const { data, error } = await supabase.rpc("admin_spawn_suggested_market", {
    p_suggestion_id: suggestionId,
    p_subsidy: 500,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/markets");
  revalidatePath("/markets/suggest");
  return { marketId: data as string };
}

export async function adminRejectSuggestion(
  suggestionId: string,
): Promise<{ error?: string }> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { error: authErr };

  const { error } = await supabase.rpc("admin_resolve_suggestion", {
    p_suggestion_id: suggestionId,
    p_action: "reject",
    p_note: null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/markets/suggest");
  return {};
}

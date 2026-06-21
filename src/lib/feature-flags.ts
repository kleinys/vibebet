import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Read a feature flag. Flags are public (RLS allows read by everyone) so we
 * can use the request-scoped client. Returns `false` if the flag does not
 * exist, which is the safe default for feature gates.
 *
 * For Phase 0 we hit the DB on every check. If this ever shows up on a hot
 * path, swap in an in-memory cache with a short TTL — but do NOT cache
 * `real_money_enabled` aggressively.
 */
export async function isEnabled(key: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  return data?.enabled ?? false;
}

export async function getAllFlags(): Promise<Record<string, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("key, enabled");
  const flags: Record<string, boolean> = {};
  for (const row of data ?? []) {
    flags[row.key] = row.enabled;
  }
  return flags;
}

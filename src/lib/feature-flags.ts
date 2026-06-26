import "server-only";
import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

const FLAGS_TAG = "feature-flags";

/** Public flag read — anon client, no cookies (safe inside unstable_cache). */
async function fetchAllFlags(): Promise<Record<string, boolean>> {
  const env = serverEnv();
  const supabase = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabase.from("feature_flags").select("key, enabled");
  const flags: Record<string, boolean> = {};
  for (const row of data ?? []) {
    flags[row.key] = row.enabled;
  }
  return flags;
}

const getCachedFlags = unstable_cache(fetchAllFlags, ["feature-flags-all"], {
  revalidate: 60,
  tags: [FLAGS_TAG],
});

/**
 * Read a feature flag. Cached ~60s — Admin toggles call revalidateTag so
 * changes apply immediately on the next request.
 */
export async function isEnabled(key: string): Promise<boolean> {
  const flags = await getCachedFlags();
  return flags[key] ?? false;
}

export async function getAllFlags(): Promise<Record<string, boolean>> {
  return getCachedFlags();
}

export { FLAGS_TAG };

import { createClient } from "@supabase/supabase-js";
import "server-only";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Service-role Supabase client. Bypasses RLS — use ONLY in trusted server
 * contexts (route handlers, webhooks, cron jobs).
 *
 * NEVER expose this client or its key to the browser. The `server-only` import
 * above causes the build to fail if this module is imported from client code.
 */
export function createAdminClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. " +
        "Admin client cannot be created.",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

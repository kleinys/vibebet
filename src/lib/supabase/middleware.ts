import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Refreshes the Supabase auth session on every request and forwards updated
 * cookies to the response. Wire this into `middleware.ts`.
 *
 * Returning the same response object (with mutated cookies) is critical —
 * do NOT create a fresh NextResponse downstream without copying cookies over.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = serverEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the user to trigger a token refresh if needed. Do NOT trust
  // getSession() server-side — it does not contact the auth server. getUser()
  // does, and is the correct primitive for server-side checks.
  await supabase.auth.getUser();

  return response;
}

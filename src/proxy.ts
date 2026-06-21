import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`. Same mechanics:
 * runs in front of every matched route, can read/write cookies, redirect, etc.
 *
 * We use it to refresh the Supabase auth session on each request so SSR pages
 * always see a fresh token.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static, _next/image, favicon, static assets
     * - the Stripe webhook (handles its own auth via signature)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

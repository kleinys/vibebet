import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Liveness + dependency check.
 *   200 — app + DB reachable
 *   503 — DB unreachable or env misconfigured
 *
 * Safe to expose publicly: returns no sensitive data, only OK/FAIL per check.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("feature_flags")
      .select("key")
      .limit(1);
    checks.db = error ? "fail" : "ok";
  } catch {
    checks.db = "fail";
  }

  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checks,
      version: process.env.npm_package_version ?? "0.0.0",
    },
    { status: ok ? 200 : 503 },
  );
}

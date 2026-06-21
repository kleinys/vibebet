import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyticsEventsToCsv,
  exportAnalyticsEvents,
} from "@/lib/analytics-admin";
import { isEnabled } from "@/lib/feature-flags";

export async function GET(request: Request) {
  const enabled = await isEnabled("analytics_dashboard_enabled");
  if (!enabled) {
    return NextResponse.json({ error: "Analytics dashboard disabled." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as Record<string, unknown> | undefined)?.role;
  if (!user || role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 7)));

  const rows = await exportAnalyticsEvents(days, 5000);
  const csv = analyticsEventsToCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vibebet-analytics-${stamp}.csv"`,
    },
  });
}

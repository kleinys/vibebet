import { NextResponse } from "next/server";
import { getActivityFeed } from "@/lib/activity-feed";
import { isEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isEnabled("live_feed_enabled"))) {
    return NextResponse.json([]);
  }
  const items = await getActivityFeed(20);
  return NextResponse.json(items);
}

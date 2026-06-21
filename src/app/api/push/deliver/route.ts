import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deliverPendingPushesForUser } from "@/lib/push";
import { isEnabled } from "@/lib/feature-flags";

export async function POST() {
  const enabled = await isEnabled("push_notifications_enabled");
  if (!enabled) {
    return NextResponse.json({ error: "Push disabled." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const sent = await deliverPendingPushesForUser();
  return NextResponse.json({ sent });
}

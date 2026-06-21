"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks notifications as read. Reads a single optional `ids` field from the
 * form data:
 *   - empty / missing → mark ALL caller's notifications read
 *   - comma-separated UUIDs → mark only those
 *
 * Designed for direct use as `<form action={markNotificationsRead}>`.
 * Returns void; the success state is reflected by revalidating the route.
 */
export async function markNotificationsRead(formData: FormData): Promise<void> {
  const raw = (formData.get("ids") as string | null) ?? "";
  const idArr =
    raw.trim().length > 0
      ? raw.split(",").map((s) => s.trim()).filter(uuidLike)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("mark_notifications_read", {
    p_notification_ids: idArr,
  });

  // Revalidate everything that shows the badge or the list.
  revalidatePath("/", "layout");
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidLike(s: string): boolean {
  return UUID_RE.test(s);
}

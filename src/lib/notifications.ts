import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type NotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];

/** Caller's unread count. Returns 0 if unauthenticated or on error. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unread_notification_count");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export interface ListNotificationsOpts {
  limit?: number;
  /** If true, only return is_read = false rows. */
  unreadOnly?: boolean;
}

export async function listNotifications(
  opts: ListNotificationsOpts = {},
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.unreadOnly) {
    query = query.eq("is_read", false);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Generate the in-app deep link for a notification. Falls back to /account
 * if `data` is missing the relevant id.
 */
export function notificationHref(n: NotificationRow): string {
  const data = n.data as {
    market_id?: string;
    comment_id?: string;
    dispute_id?: string;
  };
  // Court notifications: link to the dispute case (richer context than the
  // market detail page).
  if (
    (n.kind === "dispute_opened" || n.kind === "dispute_resolved") &&
    data.dispute_id
  ) {
    return `/court/${data.dispute_id}`;
  }
  if (data.market_id) return `/markets/${data.market_id}`;
  return "/account/notifications";
}

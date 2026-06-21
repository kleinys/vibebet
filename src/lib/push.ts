import "server-only";

import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export interface PushJob {
  outbox_id: string;
  notification_id: string;
  title: string;
  body: string;
  url: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:support@vibebet.app",
    publicKey,
    privateKey,
  );
  return true;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

export async function getPendingPushJobs(limit = 20): Promise<PushJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_pending_push_jobs", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    outbox_id: String(row.outbox_id),
    notification_id: String(row.notification_id),
    title: String(row.title),
    body: String(row.body ?? ""),
    url: String(row.url),
  }));
}

export async function getUserPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

export async function markPushJob(
  outboxId: string,
  status: "sent" | "failed" | "skipped",
  error?: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_push_job", {
    p_outbox_id: outboxId,
    p_status: status,
    p_error: error ?? null,
  });
}

export async function deliverPendingPushesForUser(): Promise<number> {
  if (!configureWebPush()) return 0;

  const [jobs, subscriptions] = await Promise.all([
    getPendingPushJobs(20),
    getUserPushSubscriptions(),
  ]);

  if (jobs.length === 0 || subscriptions.length === 0) {
    for (const job of jobs) {
      await markPushJob(job.outbox_id, "skipped", "No push subscription");
    }
    return 0;
  }

  let sent = 0;

  for (const job of jobs) {
    let delivered = false;
    let lastError: string | undefined;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: job.title,
            body: job.body,
            url: job.url,
          }),
        );
        delivered = true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Push send failed";
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          const supabase = await createClient();
          await supabase.rpc("remove_push_subscription", {
            p_endpoint: sub.endpoint,
          });
        }
      }
    }

    if (delivered) {
      await markPushJob(job.outbox_id, "sent");
      sent += 1;
    } else {
      await markPushJob(job.outbox_id, "failed", lastError);
    }
  }

  return sent;
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function savePushSubscription(
  subscription: unknown,
  userAgent?: string,
): Promise<{ error?: string; ok?: string }> {
  const parsed = subSchema.safeParse(subscription);
  if (!parsed.success) return { error: "Invalid push subscription." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: userAgent ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/notifications");
  return { ok: "Push notifications enabled on this device." };
}

export async function disablePushNotifications(): Promise<{ error?: string; ok?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_push_notifications_enabled", {
    p_enabled: false,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/notifications");
  return { ok: "Push notifications turned off." };
}

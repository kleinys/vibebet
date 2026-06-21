"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function createLiveEvent(
  _prev: { error?: string; ok?: string; eventId?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string; eventId?: string }> {
  const parsed = z
    .object({
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().optional(),
      category: z.enum(["sports", "poker", "chess", "esports", "other"]),
      streamUrl: z.string().trim().optional(),
      startsAt: z.string().optional(),
      yesLabel: z.string().trim().min(1).max(32).default("Side A"),
      noLabel: z.string().trim().min(1).max(32).default("Side B"),
      enableBet: z.enum(["true", "false"]).optional(),
    })
    .safeParse({
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      category: formData.get("category"),
      streamUrl: formData.get("streamUrl") || undefined,
      startsAt: formData.get("startsAt") || undefined,
      yesLabel: formData.get("yesLabel") || "Side A",
      noLabel: formData.get("noLabel") || "Side B",
      enableBet: formData.get("enableBet") || "true",
    });
  if (!parsed.success) return { error: "Invalid event details." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_live_event", {
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_category: parsed.data.category,
    p_stream_url: parsed.data.streamUrl ?? null,
    p_starts_at: parsed.data.startsAt
      ? new Date(parsed.data.startsAt).toISOString()
      : null,
    p_yes_label: parsed.data.yesLabel,
    p_no_label: parsed.data.noLabel,
    p_enable_bet: parsed.data.enableBet !== "false",
  });
  if (error) return { error: error.message };

  const eventId = String(data);
  revalidatePath("/live");
  revalidatePath("/games");
  redirect(`/live/${eventId}`);
}

export async function setLiveEventStatus(
  eventId: string,
  status: "scheduled" | "live" | "ended",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_live_event_status", {
    p_event_id: eventId,
    p_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath("/live");
  revalidatePath(`/live/${eventId}`);
  return {};
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  title: z.string().trim().max(120).optional(),
  asset: z.enum(["btc", "eth", "sol"]),
  intervalSec: z.coerce.number().int().refine((n) => n >= 60 && n <= 3600, {
    message: "Pick a window between 1 minute and 1 hour",
  }),
  creatorFeePercent: z.coerce.number().min(0).max(5).default(2),
});

export type RecurringSeriesState = { error?: string; ok?: string } | null;

export async function createRecurringSeries(
  _prev: RecurringSeriesState,
  formData: FormData,
): Promise<RecurringSeriesState> {
  const parsed = Schema.safeParse({
    title: formData.get("title") || undefined,
    asset: formData.get("asset"),
    intervalSec: formData.get("intervalSec"),
    creatorFeePercent: formData.get("creatorFeePercent") || 2,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const feeBps = Math.round(parsed.data.creatorFeePercent * 100);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/markets/new/recurring");

  const { data, error } = await supabase.rpc("create_recurring_series", {
    p_title: parsed.data.title ?? "",
    p_asset: parsed.data.asset,
    p_interval_sec: parsed.data.intervalSec,
    p_creator_fee_bps: feeBps,
  });

  if (error) return { error: error.message };

  await supabase.rpc("check_achievements");

  revalidatePath("/markets/fast");
  revalidatePath("/markets/new/recurring");
  revalidatePath("/account");

  return {
    ok: `Recurring series started (${parsed.data.asset.toUpperCase()} every ${parsed.data.intervalSec / 60 >= 1 ? `${parsed.data.intervalSec / 60}m` : `${parsed.data.intervalSec}s`}). Windows spawn automatically when the previous one ends.`,
  };
}

export async function toggleRecurringSeries(
  _prev: RecurringSeriesState,
  formData: FormData,
): Promise<RecurringSeriesState> {
  const seriesId = formData.get("seriesId");
  if (typeof seriesId !== "string") return { error: "Missing series." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/markets/new/recurring");

  const { data: row } = await supabase
    .from("recurring_market_series")
    .select("enabled")
    .eq("id", seriesId)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!row) return { error: "Series not found." };

  const { error } = await supabase
    .from("recurring_market_series")
    .update({ enabled: !row.enabled })
    .eq("id", seriesId)
    .eq("creator_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/markets/new/recurring");
  return { ok: row.enabled ? "Series paused." : "Series resumed." };
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics";
import { listMarkets } from "@/lib/markets";

export async function saveInterests(interests: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_onboarding_interests", {
    p_interests: interests,
  });
  if (error) return { error: error.message };
  await trackEvent("onboarding_interests_saved", { count: interests.length });
  revalidatePath("/onboarding");
  return {};
}

export async function finishOnboarding(skip = false): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("complete_onboarding", { p_skip: skip });
  await trackEvent(skip ? "onboarding_skipped" : "onboarding_completed");
  revalidatePath("/", "layout");
  redirect("/markets");
}

export async function getStarterMarketId(): Promise<string | null> {
  const markets = await listMarkets({
    status: "open",
    sort: "trending",
    limit: 5,
    excludeSource: "polymarket_mirror",
  });
  const pick =
    markets.find((m) => m.is_featured) ??
    markets.find((m) => m.source === "platform") ??
    markets[0];
  return pick?.id ?? null;
}

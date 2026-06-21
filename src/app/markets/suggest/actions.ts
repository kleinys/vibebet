"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKET_CATEGORIES } from "@/lib/supabase/types";

const SubmitSchema = z.object({
  title: z.string().trim().min(10).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(MARKET_CATEGORIES as [string, ...string[]]).default("other"),
  yesLabel: z.string().trim().min(1).max(32).default("Yes"),
  noLabel: z.string().trim().min(1).max(32).default("No"),
});

export type SuggestMarketState = { error?: string; ok?: string } | null;

export async function submitMarketSuggestion(
  _prev: SuggestMarketState,
  formData: FormData,
): Promise<SuggestMarketState> {
  const parsed = SubmitSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    yesLabel: formData.get("yesLabel") || undefined,
    noLabel: formData.get("noLabel") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to suggest a market." };

  const { error } = await supabase.rpc("submit_market_suggestion", {
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_category: parsed.data.category,
    p_yes_label: parsed.data.yesLabel,
    p_no_label: parsed.data.noLabel,
  });

  if (error) return { error: error.message };

  revalidatePath("/markets/suggest");
  return { ok: "Suggestion submitted — upvotes help it get noticed!" };
}

export async function toggleSuggestionVote(
  suggestionId: string,
): Promise<{ error?: string; voted?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to vote." };

  const { data, error } = await supabase.rpc("vote_market_suggestion", {
    p_suggestion_id: suggestionId,
  });
  if (error) return { error: error.message };

  revalidatePath("/markets/suggest");
  revalidatePath("/admin");
  return { voted: (data as { voted?: boolean })?.voted ?? false };
}

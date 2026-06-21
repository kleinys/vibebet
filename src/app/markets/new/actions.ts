"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKET_CATEGORIES } from "@/lib/supabase/types";

const Schema = z.object({
  question: z.string().trim().min(10).max(280),
  description: z.string().trim().max(2000).optional(),
  subsidy: z.coerce.number().int().min(100).max(1_000_000),
  closesAt: z.string().optional(),
  category: z.enum(MARKET_CATEGORIES as [string, ...string[]]).default("other"),
  yesLabel: z.string().trim().min(1).max(32).default("Yes"),
  noLabel: z.string().trim().min(1).max(32).default("No"),
});

export type CreateMarketState = { error?: string } | null;

export async function createMarket(
  _prev: CreateMarketState,
  formData: FormData,
): Promise<CreateMarketState> {
  const parsed = Schema.safeParse({
    question: formData.get("question"),
    description: formData.get("description") || undefined,
    subsidy: formData.get("subsidy"),
    closesAt: formData.get("closesAt") || undefined,
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
  if (!user) {
    redirect("/login?next=/markets/new");
  }

  const { data, error } = await supabase.rpc("create_market", {
    p_question: parsed.data.question,
    p_description: parsed.data.description ?? null,
    p_subsidy: parsed.data.subsidy,
    p_closes_at: parsed.data.closesAt
      ? new Date(parsed.data.closesAt).toISOString()
      : null,
    p_category: parsed.data.category as never,
    p_outcome_yes_label: parsed.data.yesLabel,
    p_outcome_no_label: parsed.data.noLabel,
  });

  if (error) {
    return { error: error.message };
  }

  await supabase.rpc("check_achievements");

  revalidatePath("/markets");
  revalidatePath("/");
  redirect(`/markets/${data as unknown as string}`);
}

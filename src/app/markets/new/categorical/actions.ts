"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MARKET_CATEGORIES } from "@/lib/supabase/types";

const Schema = z.object({
  question: z.string().trim().min(10).max(280),
  description: z.string().trim().max(2000).optional(),
  subsidy: z.coerce.number().int().min(100).max(100_000),
  closesAt: z.string().optional(),
  category: z.enum(MARKET_CATEGORIES as [string, ...string[]]).default("other"),
  outcomes: z
    .string()
    .trim()
    .min(1)
    .transform((raw) =>
      raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .refine((labels) => labels.length >= 2 && labels.length <= 8, {
      message: "Enter 2–8 outcome labels (one per line).",
    })
    .refine(
      (labels) => new Set(labels.map((l) => l.toLowerCase())).size === labels.length,
      { message: "Outcome labels must be unique." },
    ),
});

export type CreateCategoricalState = { error?: string } | null;

export async function createCategoricalMarket(
  _prev: CreateCategoricalState,
  formData: FormData,
): Promise<CreateCategoricalState> {
  const parsed = Schema.safeParse({
    question: formData.get("question"),
    description: formData.get("description") || undefined,
    subsidy: formData.get("subsidy"),
    closesAt: formData.get("closesAt") || undefined,
    category: formData.get("category") || undefined,
    outcomes: formData.get("outcomes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/markets/new/categorical");

  const { data, error } = await supabase.rpc("create_categorical_market", {
    p_question: parsed.data.question,
    p_description: parsed.data.description ?? null,
    p_outcome_labels: parsed.data.outcomes,
    p_subsidy: parsed.data.subsidy,
    p_closes_at: parsed.data.closesAt
      ? new Date(parsed.data.closesAt).toISOString()
      : null,
    p_category: parsed.data.category as never,
    p_image_url: null,
  });
  if (error) return { error: error.message };

  await supabase.rpc("check_achievements");

  revalidatePath("/markets");
  revalidatePath("/");
  redirect(`/markets/${data as unknown as string}`);
}

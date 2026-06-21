"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  marketId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export type CommentState = { error?: string; ok?: string } | null;

export async function postComment(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const parsed = Schema.safeParse({
    marketId: formData.get("marketId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to comment." };

  const { error } = await supabase.from("market_comments").insert({
    market_id: parsed.data.marketId,
    user_id: user.id,
    body: parsed.data.body,
  });
  if (error) return { error: error.message };

  await supabase.rpc("check_achievements");

  revalidatePath(`/markets/${parsed.data.marketId}`);
  return { ok: "Posted." };
}

export async function deleteComment(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  const marketId = z.string().uuid().safeParse(formData.get("marketId"));
  if (!id.success || !marketId.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("market_comments")
    .delete()
    .eq("id", id.data);
  if (error) return { error: error.message };

  revalidatePath(`/markets/${marketId.data}`);
  return { ok: "Deleted." };
}

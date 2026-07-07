"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateStreamBetState = {
  error?: string;
  ok?: string;
  marketId?: string;
} | null;

export async function createStreamWatchBet(
  _prev: CreateStreamBetState,
  formData: FormData,
): Promise<CreateStreamBetState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create a stream bet." };

  const provider = String(formData.get("provider") ?? "other");
  const externalId = String(formData.get("externalId") ?? "").trim();
  const streamTitle = String(formData.get("streamTitle") ?? "").trim();
  const question = String(formData.get("question") ?? "").trim();
  const yesLabel = String(formData.get("yesLabel") ?? "Yes").trim() || "Yes";
  const noLabel = String(formData.get("noLabel") ?? "No").trim() || "No";
  const loginNext = String(formData.get("loginNext") ?? "/live/watch");

  if (!externalId) return { error: "Missing stream id." };
  if (question.length < 8) return { error: "Question must be at least 8 characters." };

  const { data, error } = await supabase.rpc("create_stream_watch_bet", {
    p_provider: provider,
    p_external_id: externalId,
    p_question: question,
    p_yes_label: yesLabel,
    p_no_label: noLabel,
    p_stream_title: streamTitle || null,
  });

  if (error) return { error: error.message };

  const marketId = String(data);
  const revalidateUrl = loginNext.split("?")[0] || "/live/watch";
  revalidatePath(revalidateUrl);

  return { ok: "Stream bet created!", marketId };
}

export type StreamCommentState = { error?: string; ok?: string } | null;

export async function postStreamWatchComment(
  _prev: StreamCommentState,
  formData: FormData,
): Promise<StreamCommentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to comment." };

  const provider = String(formData.get("provider") ?? "other").toLowerCase().trim();
  const externalId = String(formData.get("externalId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const loginNext = String(formData.get("loginNext") ?? "/live/watch");

  if (!externalId) return { error: "Missing stream." };
  if (body.length < 1) return { error: "Write a comment first." };

  const { error } = await supabase.from("stream_watch_comments").insert({
    stream_provider: provider,
    stream_external_id: externalId,
    user_id: user.id,
    body: body.slice(0, 500),
  });
  if (error) return { error: error.message };

  revalidatePath(loginNext.split("?")[0] || "/live/watch");
  return { ok: "Posted." };
}

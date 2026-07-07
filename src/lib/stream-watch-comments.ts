import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StreamWatchComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
};

function normalizeProvider(provider: string): string {
  const p = provider.toLowerCase().trim();
  if (p === "youtube" || p === "twitch" || p === "kick") return p;
  return "other";
}

export async function getStreamWatchComments(
  provider: string,
  externalId: string,
  limit = 40,
): Promise<StreamWatchComment[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_stream_watch_comments", {
      p_provider: normalizeProvider(provider),
      p_external_id: externalId.trim(),
      p_limit: limit,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[stream-watch-comments]", error.message);
      }
      return [];
    }

    return ((data ?? []) as Array<{
      id: string;
      body: string;
      author_name: string;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      body: row.body,
      authorName: row.author_name,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ActivityFeedItem {
  id: string;
  kind: string;
  user_id: string | null;
  market_id: string | null;
  display_name: string | null;
  market_question: string | null;
  amount: number;
  side: string | null;
  created_at: string;
}

export async function getActivityFeed(
  limit = 20,
): Promise<ActivityFeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_feed", {
    p_limit: limit,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[activity-feed]", error.message);
    }
    return [];
  }
  return (data ?? []) as ActivityFeedItem[];
}

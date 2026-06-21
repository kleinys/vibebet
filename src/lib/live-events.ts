import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface LiveEventSummary {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  description: string | null;
  category: string;
  stream_url: string | null;
  status: string;
  betting_market_id: string | null;
  duel_id: string | null;
  paper_duel_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export async function getLiveEvents(limit = 30): Promise<LiveEventSummary[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_live_events", {
      p_limit: limit,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[live-events] list:", error.message);
      }
      return [];
    }
    return (data ?? []) as LiveEventSummary[];
  } catch {
    return [];
  }
}

export async function getLiveEvent(
  id: string,
): Promise<LiveEventSummary | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_live_event", {
      p_event_id: id,
    });
    if (error || !data) return null;
    return data as unknown as LiveEventSummary;
  } catch {
    return null;
  }
}

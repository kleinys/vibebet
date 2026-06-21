import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AccuracyStats {
  predictions_scored: number;
  correct_predictions: number;
  accuracy_pct: number | null;
  avg_brier: number | null;
}

export interface AccuracyLeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  predictions_scored: number;
  accuracy_pct: number;
  avg_brier: number;
}

export async function getAccuracyStats(
  userId?: string,
): Promise<AccuracyStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_accuracy_stats", {
    p_user_id: userId ?? undefined,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[accuracy]", error.message);
    }
    return null;
  }
  const raw = data as Record<string, number | null> | null;
  if (!raw) return null;
  return {
    predictions_scored: raw.predictions_scored ?? 0,
    correct_predictions: raw.correct_predictions ?? 0,
    accuracy_pct: raw.accuracy_pct ?? null,
    avg_brier: raw.avg_brier ?? null,
  };
}

export async function getAccuracyLeaderboard(
  limit = 25,
): Promise<AccuracyLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accuracy_leaderboard", {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as AccuracyLeaderboardRow[];
}

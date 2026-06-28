import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakShields: number;
}

export async function maybeRecordDailyActivity(): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_daily_activity");
    if (error && process.env.NODE_ENV === "development") {
      console.warn(
        "[streaks] record_daily_activity:",
        error.code,
        error.message,
      );
    }
  } catch {
    // Never break page render.
  }
}

export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, last_active_date, streak_shields")
    .eq("id", userId)
    .maybeSingle();

  return {
    currentStreak: data?.current_streak ?? 0,
    longestStreak: data?.longest_streak ?? 0,
    lastActiveDate: data?.last_active_date ?? null,
    streakShields: data?.streak_shields ?? 0,
  };
}

export async function getUnlockedAchievementIds(
  userId: string,
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  return new Set((data ?? []).map((r) => r.achievement_id));
}

export async function refreshAchievements(userId: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("check_achievements", { p_user_id: userId });
  } catch {
    // Ignore.
  }
}

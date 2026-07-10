import "server-only";
import { createClient } from "@/lib/supabase/server";

export type HustleTaskKind = "daily" | "spark" | "flash";

export interface DailyHustleTask {
  task_id: string;
  title: string;
  description: string;
  target: number;
  reward_vibe: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  task_kind: HustleTaskKind;
  metric: string;
  min_hustle_tier: number;
  tier_locked: boolean;
}

function mapHustleRow(row: Record<string, unknown>): DailyHustleTask {
  return {
    task_id: String(row.task_id),
    title: String(row.title),
    description: String(row.description),
    target: Number(row.target),
    reward_vibe: Number(row.reward_vibe),
    progress: Number(row.progress),
    completed: Boolean(row.completed),
    claimed: Boolean(row.claimed),
    task_kind: (row.task_kind === "flash"
      ? "flash"
      : row.task_kind === "spark"
        ? "spark"
        : "daily") as HustleTaskKind,
    metric: String(row.metric),
    min_hustle_tier: Number(row.min_hustle_tier ?? 1),
    tier_locked: Boolean(row.tier_locked),
  };
}

export async function getHustleTasks(
  taskKind?: HustleTaskKind | null,
): Promise<DailyHustleTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_hustle", {
    p_task_kind: taskKind ?? null,
  });
  if (error) throw error;
  return (data ?? []).map((row) => mapHustleRow(row as Record<string, unknown>));
}

export async function getDailyHustle(): Promise<DailyHustleTask[]> {
  return getHustleTasks("daily");
}

export async function getSparkHustle(): Promise<DailyHustleTask[]> {
  return getHustleTasks("spark");
}

export async function getFlashHustle(): Promise<DailyHustleTask[]> {
  return getHustleTasks("flash");
}

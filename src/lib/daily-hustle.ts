import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface DailyHustleTask {
  task_id: string;
  title: string;
  description: string;
  target: number;
  reward_vibe: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export async function getDailyHustle(): Promise<DailyHustleTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_hustle");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    task_id: String(row.task_id),
    title: String(row.title),
    description: String(row.description),
    target: Number(row.target),
    reward_vibe: Number(row.reward_vibe),
    progress: Number(row.progress),
    completed: Boolean(row.completed),
    claimed: Boolean(row.claimed),
  }));
}

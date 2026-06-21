import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface WeeklyQuest {
  quest_id: string;
  title: string;
  description: string;
  target: number;
  reward_vibe: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export async function getWeeklyQuests(): Promise<WeeklyQuest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_weekly_quests");
  if (error) throw error;
  return (data ?? []) as WeeklyQuest[];
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface GuildQuestStatus {
  enabled: boolean;
  inGuild?: boolean;
  weekStart?: string;
  targetVolume: number;
  currentVolume: number;
  completed: boolean;
  claimed: boolean;
  rewardVibe: number;
}

export async function getGuildQuestStatus(): Promise<GuildQuestStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guild_quest_status");
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[guild-quest]", error.message);
    }
    return null;
  }
  const raw = data as Record<string, unknown> | null;
  if (!raw || raw.skipped) return null;
  if (!raw.enabled) {
    return {
      enabled: false,
      targetVolume: 0,
      currentVolume: 0,
      completed: false,
      claimed: false,
      rewardVibe: 0,
    };
  }
  return {
    enabled: true,
    inGuild: Boolean(raw.in_guild),
    weekStart: raw.week_start as string | undefined,
    targetVolume: Number(raw.target_volume ?? 50000),
    currentVolume: Number(raw.current_volume ?? 0),
    completed: Boolean(raw.completed),
    claimed: Boolean(raw.claimed),
    rewardVibe: Number(raw.reward_vibe ?? 250),
  };
}

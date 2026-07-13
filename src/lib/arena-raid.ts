import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ArenaRaidState {
  raid_id: string;
  status: string;
  participant_count: number;
  participant_cap: number;
  reward_per_user: number;
  joined: boolean;
}

export async function getActiveArenaRaid(): Promise<ArenaRaidState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_active_arena_raid");
  if (error || !data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    raid_id: String(o.raid_id ?? ""),
    status: String(o.status ?? "open"),
    participant_count: Number(o.participant_count ?? 0),
    participant_cap: Number(o.participant_cap ?? 5),
    reward_per_user: Number(o.reward_per_user ?? 25),
    joined: Boolean(o.joined),
  };
}

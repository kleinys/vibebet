import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HustleRegion, HustleWellnessState } from "@/lib/hustle/shared";

export type { HustleRegion, HustleWellnessState } from "@/lib/hustle/shared";
export { HUSTLE_REGIONS } from "@/lib/hustle/shared";

export async function getHustleWellness(): Promise<HustleWellnessState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hustle_wellness");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as unknown as Record<string, unknown>;
  if (!row.authenticated) return null;

  return {
    authenticated: true,
    recovery_mode: Boolean(row.recovery_mode),
    recovery_until: row.recovery_until ? String(row.recovery_until) : null,
    self_exclude_until: row.self_exclude_until ? String(row.self_exclude_until) : null,
    daily_earn_cap: row.daily_earn_cap != null ? Number(row.daily_earn_cap) : null,
    earned_today: Number(row.earned_today ?? 0),
    earn_cap_remaining:
      row.earn_cap_remaining != null ? Number(row.earn_cap_remaining) : null,
    region: (row.region as HustleRegion) ?? "global",
    region_label: String(row.region_label ?? "Global"),
    blocks_play_bridge: Boolean(row.blocks_play_bridge),
    regional_gig_count: Number(row.regional_gig_count ?? 0),
  };
}

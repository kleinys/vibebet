import "server-only";
import { createClient } from "@/lib/supabase/server";

export type HustleRegion = "global" | "eu" | "us" | "mena" | "latam";

export interface HustleWellnessState {
  authenticated: boolean;
  recovery_mode: boolean;
  recovery_until: string | null;
  self_exclude_until: string | null;
  daily_earn_cap: number | null;
  earned_today: number;
  earn_cap_remaining: number | null;
  region: HustleRegion;
  region_label: string;
  blocks_play_bridge: boolean;
  regional_gig_count: number;
}

export const HUSTLE_REGIONS: { id: HustleRegion; label: string; hint: string }[] = [
  { id: "global", label: "Global", hint: "Default platform gigs worldwide" },
  { id: "eu", label: "Europe", hint: "Privacy-first labeling tasks" },
  { id: "us", label: "United States", hint: "Election & finance research gigs" },
  { id: "mena", label: "MENA", hint: "Arabic-friendly caption tasks" },
  { id: "latam", label: "Latin America", hint: "Spanish/Portuguese share tasks" },
];

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

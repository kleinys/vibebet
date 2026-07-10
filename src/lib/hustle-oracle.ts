import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HustleOracleProfile, HustleTierLabel } from "@/lib/hustle/shared";

export type { HustleOracleProfile, HustleTierLabel } from "@/lib/hustle/shared";
export { HUSTLE_TIER_LADDER } from "@/lib/hustle/shared";

const TIER_LABELS: HustleTierLabel[] = ["Spark", "Flash", "Gig", "Pro", "Elite"];

function tierLabel(tier: number): HustleTierLabel {
  return TIER_LABELS[Math.max(1, Math.min(5, tier)) - 1] ?? "Spark";
}

export function hustleTierDisplayName(tier: number): HustleTierLabel {
  return tierLabel(tier);
}

export async function getHustleOracle(): Promise<HustleOracleProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hustle_oracle");
  if (error) throw error;
  if (!data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  if (!row.authenticated) return null;

  return {
    authenticated: true,
    trust_score: Number(row.trust_score ?? 500),
    hustle_tier: Number(row.hustle_tier ?? 1),
    tier_label: tierLabel(Number(row.hustle_tier ?? 1)),
    spark_claims_lifetime: Number(row.spark_claims_lifetime ?? 0),
    platform_fee_pct: Number(row.platform_fee_pct ?? 15),
    current_streak: Number(row.current_streak ?? 0),
    next_tier: row.next_tier != null ? Number(row.next_tier) : null,
    next_tier_label:
      row.next_tier != null ? tierLabel(Number(row.next_tier)) : null,
    next_tier_spark_target:
      row.next_tier_spark_target != null ? Number(row.next_tier_spark_target) : null,
    next_tier_spark_progress:
      row.next_tier_spark_progress != null ? Number(row.next_tier_spark_progress) : null,
    next_tier_trust_gate:
      row.next_tier_trust_gate != null ? Number(row.next_tier_trust_gate) : null,
  };
}

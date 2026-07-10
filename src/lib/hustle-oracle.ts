import "server-only";
import { createClient } from "@/lib/supabase/server";

export type HustleTierLabel = "Spark" | "Flash" | "Gig" | "Pro" | "Elite";

export interface HustleOracleProfile {
  authenticated: boolean;
  trust_score: number;
  hustle_tier: number;
  tier_label: HustleTierLabel;
  spark_claims_lifetime: number;
  platform_fee_pct: number;
  current_streak: number;
  next_tier: number | null;
  next_tier_label: HustleTierLabel | null;
  next_tier_spark_target: number | null;
  next_tier_spark_progress: number | null;
  next_tier_trust_gate: number | null;
}

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

export const HUSTLE_TIER_LADDER: {
  tier: number;
  label: HustleTierLabel;
  trustGate: number;
  sparkGate: number;
  description: string;
}[] = [
  { tier: 1, label: "Spark", trustGate: 0, sparkGate: 0, description: "30-second micro-tasks" },
  { tier: 2, label: "Flash", trustGate: 550, sparkGate: 20, description: "Faster gigs, higher rewards" },
  { tier: 3, label: "Gig", trustGate: 650, sparkGate: 35, description: "Multi-step earn tasks" },
  { tier: 4, label: "Pro", trustGate: 750, sparkGate: 50, description: "Premium client-style work" },
  { tier: 5, label: "Elite", trustGate: 850, sparkGate: 80, description: "Top reputation lane" },
];

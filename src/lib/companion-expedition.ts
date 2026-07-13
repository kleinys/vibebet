import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CompanionExpeditionStatus = {
  authenticated?: boolean;
  active: boolean;
  can_start: boolean;
  can_claim: boolean;
  reward_vibe: number | null;
  ends_at: string | null;
  cooldown_ends_at: string | null;
  claimed_vibe?: number;
};

function parseStatus(raw: unknown): CompanionExpeditionStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    authenticated: o.authenticated === false ? false : true,
    active: Boolean(o.active),
    can_start: Boolean(o.can_start),
    can_claim: Boolean(o.can_claim),
    reward_vibe: o.reward_vibe != null ? Number(o.reward_vibe) : null,
    ends_at: typeof o.ends_at === "string" ? o.ends_at : null,
    cooldown_ends_at:
      typeof o.cooldown_ends_at === "string" ? o.cooldown_ends_at : null,
    claimed_vibe: o.claimed_vibe != null ? Number(o.claimed_vibe) : undefined,
  };
}

export async function getCompanionExpeditionStatus(): Promise<CompanionExpeditionStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_companion_expedition_status");
  if (error) {
    console.error("get_companion_expedition_status:", error.message);
    return null;
  }
  return parseStatus(data);
}

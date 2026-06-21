import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ReferralStats {
  referral_code: string | null;
  referred_by: string | null;
  invite_count: number;
  total_vibe_earned: number;
  recent_invites: { display_name: string; joined_at: string }[];
}

export async function getMyReferralStats(): Promise<ReferralStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_referral_stats");
  if (error) return null;
  const raw = data as Record<string, unknown> | null;
  if (!raw) return null;
  const invites = Array.isArray(raw.recent_invites) ? raw.recent_invites : [];
  return {
    referral_code: (raw.referral_code as string) ?? null,
    referred_by: (raw.referred_by as string) ?? null,
    invite_count: Number(raw.invite_count ?? 0),
    total_vibe_earned: Number(raw.total_vibe_earned ?? 0),
    recent_invites: invites.map((i) => {
      const row = i as Record<string, unknown>;
      return {
        display_name: String(row.display_name ?? "Player"),
        joined_at: String(row.joined_at),
      };
    }),
  };
}

export async function applyReferralCode(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_referral_code", {
    p_code: code,
  });
  if (error) return { ok: false, error: error.message };
  const raw = data as Record<string, unknown> | null;
  if (!raw?.ok) {
    return { ok: false, error: String(raw?.error ?? "Could not apply code.") };
  }
  return { ok: true };
}

export async function tryReferralFirstBetReward(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("try_referral_first_bet_reward");
}

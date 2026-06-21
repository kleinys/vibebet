import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface BattlePassSeason {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  max_tier: number;
  xp_per_tier: number;
}

export interface BattlePassProgress {
  xp: number;
  tier: number;
  premium_unlocked: boolean;
  claimed_free: number[];
  claimed_premium: number[];
}

export async function getActiveSeason(): Promise<BattlePassSeason | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("battle_pass_seasons")
    .select("*")
    .lte("starts_at", new Date().toISOString())
    .gt("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getBattlePassProgress(
  userId: string,
  seasonId: string,
): Promise<BattlePassProgress | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_battle_pass")
    .select("xp, premium_unlocked, claimed_free, claimed_premium")
    .eq("user_id", userId)
    .eq("season_id", seasonId)
    .maybeSingle();
  if (!data) return null;
  const season = await supabase
    .from("battle_pass_seasons")
    .select("xp_per_tier, max_tier")
    .eq("id", seasonId)
    .maybeSingle();
  const xpPer = season.data?.xp_per_tier ?? 100;
  const maxTier = season.data?.max_tier ?? 30;
  return {
    xp: data.xp,
    tier: Math.min(maxTier, Math.floor(data.xp / xpPer)),
    premium_unlocked: data.premium_unlocked,
    claimed_free: data.claimed_free ?? [],
    claimed_premium: data.claimed_premium ?? [],
  };
}

export async function isProUser(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_pro, pro_expires_at")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_pro) return false;
  if (data.pro_expires_at && new Date(data.pro_expires_at) < new Date()) {
    return false;
  }
  return true;
}

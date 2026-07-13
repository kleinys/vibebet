import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SmartBetDefaults {
  recommendedSide: "yes" | "no";
  recommendedStake: number;
  reason: string;
}

export function computeRecommendedSide(
  yesPrice: number,
  noPrice: number,
): { side: "yes" | "no"; reason: string } {
  const underdogThreshold = 0.38;
  if (yesPrice <= underdogThreshold) {
    return {
      side: "yes",
      reason: `Yes is the underdog at ${Math.round(yesPrice * 100)}¢ — higher upside if you're right.`,
    };
  }
  if (noPrice <= underdogThreshold) {
    return {
      side: "no",
      reason: `No is the underdog at ${Math.round(noPrice * 100)}¢ — higher upside if you're right.`,
    };
  }
  const side = yesPrice <= noPrice ? "yes" : "no";
  const price = side === "yes" ? yesPrice : noPrice;
  return {
    side,
    reason: `${side === "yes" ? "Yes" : "No"} leads at ${Math.round(price * 100)}¢ — crowd favorite.`,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

export function computeRecommendedStake(
  vibeBalance: number,
  recentBuyCosts: number[],
): number {
  if (vibeBalance < 1) return 0;

  let stake: number;
  if (recentBuyCosts.length >= 2) {
    stake = median(recentBuyCosts);
  } else {
    stake = Math.floor(vibeBalance * 0.05);
  }

  stake = Math.max(25, Math.min(500, stake));
  return Math.min(vibeBalance, stake);
}

export async function getSmartBetDefaults(
  userId: string,
  yesPrice: number,
  noPrice: number,
  vibeBalance: number,
): Promise<SmartBetDefaults> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trades")
    .select("cost")
    .eq("user_id", userId)
    .gt("cost", 0)
    .order("created_at", { ascending: false })
    .limit(12);

  const recentBuyCosts = (data ?? []).map((r) => r.cost);
  const { side, reason } = computeRecommendedSide(yesPrice, noPrice);
  const recommendedStake = computeRecommendedStake(vibeBalance, recentBuyCosts);

  return { recommendedSide: side, recommendedStake, reason };
}

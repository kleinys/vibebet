import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEquippedCosmetics } from "@/lib/cosmetics";
import { getStreakInfo } from "@/lib/streaks";
import type { CompanionInput } from "@/lib/vibe-companion";

export async function getCompanionInput(
  userId: string,
): Promise<CompanionInput> {
  const supabase = await createClient();
  const [streak, cosmetics, inventoryRes] = await Promise.all([
    getStreakInfo(userId),
    getEquippedCosmetics(userId),
    supabase
      .from("user_inventory")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    currentStreak: streak.currentStreak,
    streakShields: streak.streakShields,
    inventoryCount: inventoryRes.count ?? 0,
    equippedSkinSlug: cosmetics.skin?.slug,
    equippedBadgeSlug: cosmetics.badge?.slug,
    skinRarity: cosmetics.skin?.rarity,
    badgeRarity: cosmetics.badge?.rarity,
  };
}

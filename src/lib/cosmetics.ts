import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Rarity } from "@/lib/supabase/types";

export interface EquippedCosmetic {
  slug: string;
  name: string;
  kind: string;
  rarity: Rarity;
}

export async function getEquippedCosmetic(
  userId: string,
): Promise<EquippedCosmetic | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_inventory")
    .select("shop_items (slug, name, kind, rarity)")
    .eq("user_id", userId)
    .eq("is_equipped", true)
    .limit(1)
    .maybeSingle();

  if (!data?.shop_items) return null;
  const item = Array.isArray(data.shop_items)
    ? data.shop_items[0]
    : data.shop_items;
  if (!item) return null;
  return {
    slug: item.slug,
    name: item.name,
    kind: item.kind,
    rarity: item.rarity as Rarity,
  };
}

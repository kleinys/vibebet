import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Rarity } from "@/lib/supabase/types";

export interface EquippedCosmetic {
  slug: string;
  name: string;
  kind: string;
  rarity: Rarity;
}

export interface EquippedCosmetics {
  skin: EquippedCosmetic | null;
  badge: EquippedCosmetic | null;
}

export interface PublicProfile {
  user_id: string;
  username: string;
  display_name: string;
  skin_slug: string;
  badge_slug: string | null;
  current_streak: number;
  longest_streak: number;
  streak_shields: number;
  is_pro: boolean;
  profit: number;
  rank: number | null;
  member_since: string;
}

type InventoryWithItem = {
  user_id?: string;
  shop_items:
    | { slug: string; name: string; kind: string; rarity: string }
    | { slug: string; name: string; kind: string; rarity: string }[]
    | null;
};

function parseItem(row: InventoryWithItem): EquippedCosmetic | null {
  if (!row.shop_items) return null;
  const item = Array.isArray(row.shop_items) ? row.shop_items[0] : row.shop_items;
  if (!item) return null;
  return {
    slug: item.slug,
    name: item.name,
    kind: item.kind,
    rarity: item.rarity as Rarity,
  };
}

export async function getEquippedCosmetics(
  userId: string,
): Promise<EquippedCosmetics> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_inventory")
    .select("shop_items (slug, name, kind, rarity)")
    .eq("user_id", userId)
    .eq("is_equipped", true);

  let skin: EquippedCosmetic | null = null;
  let badge: EquippedCosmetic | null = null;

  for (const row of data ?? []) {
    const item = parseItem(row);
    if (!item) continue;
    if (item.kind === "skin" && !skin) skin = item;
    if (item.kind === "badge" && !badge) badge = item;
  }

  return { skin, badge };
}

/** @deprecated Use getEquippedCosmetics */
export async function getEquippedCosmetic(
  userId: string,
): Promise<EquippedCosmetic | null> {
  const { skin } = await getEquippedCosmetics(userId);
  return skin;
}

export async function getEquippedCosmeticsForUsers(
  userIds: string[],
): Promise<Map<string, EquippedCosmetics>> {
  const result = new Map<string, EquippedCosmetics>();
  if (userIds.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_inventory")
    .select("user_id, shop_items (slug, name, kind, rarity)")
    .in("user_id", userIds)
    .eq("is_equipped", true);

  for (const id of userIds) {
    result.set(id, { skin: null, badge: null });
  }

  for (const row of data ?? []) {
    const item = parseItem(row);
    if (!item) continue;
    const entry = result.get(row.user_id) ?? { skin: null, badge: null };
    if (item.kind === "skin" && !entry.skin) entry.skin = item;
    if (item.kind === "badge" && !entry.badge) entry.badge = item;
    result.set(row.user_id, entry);
  }

  return result;
}

export async function getPublicProfile(
  username: string,
): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_profile", {
    p_username: username,
  });
  if (error || !data) return null;
  return data as unknown as PublicProfile;
}

export async function getUsernamesForUsers(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds)
    .not("username", "is", null);

  return new Map(
    (data ?? [])
      .filter((p) => p.username)
      .map((p) => [p.id, p.username!]),
  );
}

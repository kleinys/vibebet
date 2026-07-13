import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConsumableSlug } from "@/lib/consumables";

export async function getMyConsumables(): Promise<
  { slug: ConsumableSlug; quantity: number }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_consumables");
  if (error || !Array.isArray(data)) return [];

  return (data as { slug: string; quantity: number }[])
    .filter((r) => r.quantity > 0)
    .map((r) => ({
      slug: r.slug as ConsumableSlug,
      quantity: Number(r.quantity),
    }));
}

export async function getAdrenalineTokenCount(): Promise<number> {
  const items = await getMyConsumables();
  return items.find((i) => i.slug === "adrenaline_token")?.quantity ?? 0;
}

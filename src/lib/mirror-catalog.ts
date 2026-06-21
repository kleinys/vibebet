import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MarketCategory } from "@/lib/supabase/types";

export interface MirrorCategoryCount {
  category: MarketCategory;
  count: number;
}

export interface MirrorEventGroup {
  slug: string;
  title: string;
  market_count: number;
  volume_24h_usd: number;
}

export interface MirrorCatalogSidebar {
  total_open: number;
  categories: MirrorCategoryCount[];
  events: MirrorEventGroup[];
}

export async function getMirrorCatalogSidebar(): Promise<MirrorCatalogSidebar | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_mirror_catalog_sidebar");
    if (error || !data) return null;

    const raw = data as {
      total_open?: number;
      categories?: Array<{ category: string; count: number }>;
      events?: Array<{
        slug: string;
        title: string;
        market_count: number;
        volume_24h_usd: number;
      }>;
    };

    return {
      total_open: raw.total_open ?? 0,
      categories: (raw.categories ?? []).map((c) => ({
        category: c.category as MarketCategory,
        count: c.count,
      })),
      events: raw.events ?? [],
    };
  } catch {
    return null;
  }
}

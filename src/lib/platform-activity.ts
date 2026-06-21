import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEnabled } from "@/lib/feature-flags";
import { tickFastMarkets } from "@/lib/fast-markets";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";
import {
  fetchTrendingPolymarketMarkets,
  fetchPolymarketMarketsByIds,
  polymarketMarketUrl,
  type PolymarketMarket,
} from "@/lib/polymarket";

const MIRROR_SYNC_LIMIT = 250;

export { MIRROR_SYNC_LIMIT };

export interface CatalogStats {
  platform: number;
  polymarket_mirror: number;
  community: number;
  categorical: number;
  bot_registered: boolean;
  last_polymarket_sync: string | null;
}

export function buildPolymarketPayload(markets: PolymarketMarket[]) {
  return markets.map((m) => ({
    external_id: m.id,
    question: m.question,
    description: m.description || "",
    yes_price: m.outcomePrices[0] ?? 0.5,
    closes_at: m.endDate,
    category: m.category,
    yes_label: m.outcomes[0] ?? "Yes",
    no_label: m.outcomes[1] ?? "No",
    external_url: polymarketMarketUrl(m),
    external_vol: m.volumeNum,
    external_vol_24h: m.volume24hr,
    image_url: m.image,
    external_event_id: m.eventId,
    external_event_slug: m.eventSlug,
    external_event_title: m.eventTitle,
    external_tags: m.tags,
  }));
}

/** Prefer service-role client so background sync never depends on user JWT. */
async function getBackgroundClient() {
  try {
    return createAdminClient();
  } catch {
    return createClient();
  }
}

function logSyncError(label: string, err: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.error(`[platform-sync] ${label}:`, err);
  }
}

export async function getCatalogStats(): Promise<CatalogStats | null> {
  try {
    const supabase = await getBackgroundClient();
    const { data, error } = await supabase.rpc("get_market_catalog_stats");
    if (error) {
      logSyncError("getCatalogStats", error);
      return null;
    }
    return data as unknown as CatalogStats;
  } catch (e) {
    logSyncError("getCatalogStats", e);
    return null;
  }
}

export async function maybeBootstrapCatalog(): Promise<number> {
  try {
    const supabase = await getBackgroundClient();
    const { data, error } = await supabase.rpc("bootstrap_market_catalog");
    if (error) {
      logSyncError("bootstrap_market_catalog", error);
      return 0;
    }
    const seeded = (data as { seeded?: number } | null)?.seeded ?? 0;
    return seeded;
  } catch (e) {
    logSyncError("bootstrap", e);
    return 0;
  }
}

export async function maybeTickPlatformActivity(limit = 2): Promise<void> {
  try {
    const supabase = await getBackgroundClient();
    await supabase.rpc("platform_activity_tick", { p_limit: limit });
  } catch (e) {
    logSyncError("platform_activity_tick", e);
  }
}

export async function syncPolymarketMirrorsBatch(opts?: {
  force?: boolean;
  limit?: number;
}): Promise<{ synced: number; fetched: number; error?: string }> {
  try {
    const markets = await fetchTrendingPolymarketMarkets(
      opts?.limit ?? MIRROR_SYNC_LIMIT,
    );
    const payload = buildPolymarketPayload(markets);

    const supabase = await getBackgroundClient();
    const { data, error } = await supabase.rpc("refresh_polymarket_mirrors", {
      p_payload: payload,
      p_force: opts?.force ?? false,
    });

    if (error) {
      logSyncError("refresh_polymarket_mirrors", error);
      return {
        synced: 0,
        fetched: markets.length,
        error: error.message,
      };
    }

    return {
      synced: Number(data ?? 0),
      fetched: markets.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Polymarket sync failed";
    logSyncError("syncPolymarketMirrorsBatch", e);
    return { synced: 0, fetched: 0, error: message };
  }
}

export async function maybeSyncPolymarketMirrors(): Promise<void> {
  const stats = await getCatalogStats();
  const force = (stats?.polymarket_mirror ?? 0) === 0;
  await syncPolymarketMirrorsBatch({ force });
}

export async function syncPolymarketResolutions(): Promise<number> {
  try {
    const supabase = await getBackgroundClient();
    const { data, error } = await supabase
      .from("markets")
      .select("external_id")
      .eq("source", "polymarket_mirror")
      .eq("status", "open")
      .not("external_id", "is", null)
      .limit(400);

    if (error || !data?.length) return 0;

    const ids = data
      .map((r) => r.external_id)
      .filter((id): id is string => Boolean(id));
    const statuses = await fetchPolymarketMarketsByIds(ids);
    const closed = statuses.filter((s) => s.closed);
    if (closed.length === 0) return 0;

    const { data: count, error: rpcErr } = await supabase.rpc(
      "finalize_polymarket_mirrors",
      { p_updates: closed },
    );
    if (rpcErr) {
      logSyncError("finalize_polymarket_mirrors", rpcErr);
      return 0;
    }
    return Number(count ?? 0);
  } catch (e) {
    logSyncError("syncPolymarketResolutions", e);
    return 0;
  }
}

/** Bootstrap catalog, sync Polymarket odds, light bot activity. */
export async function runPlatformBackgroundTicks(opts?: {
  activityLimit?: number;
}): Promise<void> {
  await maybeBootstrapCatalog();
  const sync = await syncPolymarketMirrorsBatch({
    force: false,
    limit: MIRROR_SYNC_LIMIT,
  });

  // If catalog still empty after sync, force one more attempt (cold start).
  if (sync.synced === 0 && !sync.error) {
    const stats = await getCatalogStats();
    if ((stats?.polymarket_mirror ?? 0) === 0) {
      await syncPolymarketMirrorsBatch({ force: true, limit: MIRROR_SYNC_LIMIT });
    }
  } else if (sync.error && process.env.NODE_ENV === "development") {
    console.error("[platform-sync] mirror sync:", sync.error);
  }

  const resolved = await syncPolymarketResolutions();
  if (resolved > 0 && process.env.NODE_ENV === "development") {
    console.info(`[platform-sync] PM-2 resolved ${resolved} mirror(s)`);
  }

  await maybeTickPlatformActivity(opts?.activityLimit ?? 3);

  try {
    if (await isEnabled("fast_markets_enabled")) {
      const prices = await fetchCryptoSpotPrices();
      await tickFastMarkets(prices);
      if (await isEnabled("paper_trading_duels_enabled")) {
        const { tickPaperDuels } = await import("@/lib/paper-duels");
        const payload = prices.map((p) => ({ asset: p.asset, price: p.price }));
        await tickPaperDuels(payload);
      }
    }
  } catch (e) {
    logSyncError("fast_markets_tick", e);
  }
}

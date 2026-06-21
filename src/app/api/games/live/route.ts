import { NextResponse } from "next/server";
import { listFastMarkets, tickFastMarkets } from "@/lib/fast-markets";
import { getActiveSpectatorDuels } from "@/lib/duels";
import { getActivePaperDuels, tickPaperDuels } from "@/lib/paper-duels";
import { isEnabled } from "@/lib/feature-flags";
import {
  fetchLiveArenaPrices,
  pricesToTickPayload,
} from "@/lib/live-arena-prices";

export const dynamic = "force-dynamic";

/** Pollable feed for the Live Arena — prices, crypto windows, duel spectators, return races. */
export async function GET() {
  try {
    const [fastOn, equitiesOn, duelsOn, spectatorOn, paperOn] =
      await Promise.all([
        isEnabled("fast_markets_enabled"),
        isEnabled("equities_enabled"),
        isEnabled("duels_enabled"),
        isEnabled("duel_spectator_markets_enabled"),
        isEnabled("paper_trading_duels_enabled"),
      ]);

    const prices = await fetchLiveArenaPrices({
      cryptoOn: fastOn || paperOn,
      equitiesOn,
    });
    const payload = pricesToTickPayload(prices);

    if ((fastOn || equitiesOn) && payload.length > 0) {
      await tickFastMarkets(payload);
    }
    if (paperOn && payload.length > 0) {
      await tickPaperDuels(payload);
    }

    const [windows, equityWindows, duels, paperRaces] = await Promise.all([
      fastOn ? listFastMarkets(24, "crypto") : Promise.resolve([]),
      equitiesOn ? listFastMarkets(12, "finance") : Promise.resolve([]),
      duelsOn && spectatorOn ? getActiveSpectatorDuels(12) : Promise.resolve([]),
      paperOn ? getActivePaperDuels(12) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      at: Date.now(),
      prices: prices.map((p) => ({
        asset: p.asset,
        label: p.label,
        price: p.price,
        kind: ["aapl", "tsla", "nvda"].includes(p.asset) ? "equity" : "crypto",
      })),
      windows: windows.map((m) => ({
        id: m.id,
        question: m.question,
        asset: m.fast_asset,
        intervalSec: m.fast_interval_sec,
        strikePrice: m.strike_price,
        windowEnd: m.window_end,
        yesPrice: m.yes_price,
        isCommunity: Boolean(m.recurring_series_id),
        kind: "crypto" as const,
      })),
      equityWindows: equityWindows.map((m) => ({
        id: m.id,
        question: m.question,
        asset: m.fast_asset,
        intervalSec: m.fast_interval_sec,
        strikePrice: m.strike_price,
        windowEnd: m.window_end,
        yesPrice: m.yes_price,
        kind: "equity" as const,
      })),
      duels: duels.map((d) => ({
        duelId: d.duel_id,
        challenger: d.challenger_name,
        opponent: d.opponent_name,
        question: d.market_question,
        spectatorMarketId: d.spectator_market_id,
        stake: d.stake,
        acceptedAt: d.accepted_at,
      })),
      paperRaces: paperRaces.map((r) => ({
        id: r.id,
        creator: r.creator_name,
        opponent: r.opponent_name,
        creatorAsset: r.creator_asset,
        opponentAsset: r.opponent_asset,
        stake: r.stake,
        durationSec: r.duration_sec,
        endsAt: r.ends_at,
      })),
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[api/games/live]", e);
    }
    return NextResponse.json(
      {
        at: Date.now(),
        prices: [],
        windows: [],
        equityWindows: [],
        duels: [],
        paperRaces: [],
        error: "live_feed_unavailable",
      },
      { status: 200 },
    );
  }
}

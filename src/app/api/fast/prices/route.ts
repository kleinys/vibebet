import { NextRequest, NextResponse } from "next/server";
import { getAssetPriceHistory, tickFastMarkets } from "@/lib/fast-markets";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const asset = (req.nextUrl.searchParams.get("asset") ?? "btc").toLowerCase();
  const since = Number(req.nextUrl.searchParams.get("since") ?? "0");

  const prices = await fetchCryptoSpotPrices();
  await tickFastMarkets(prices);

  const assetPrice = prices.find((p) => p.asset === asset)?.price;
  const ticks = await getAssetPriceHistory(
    asset,
    since > 0 ? since : Date.now() - 15 * 60_000,
  );

  return NextResponse.json({
    asset,
    current: assetPrice ?? ticks.at(-1)?.price ?? null,
    ticks,
  });
}

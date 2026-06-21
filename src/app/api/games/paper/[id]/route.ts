import { NextResponse } from "next/server";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";
import {
  computeReturnPct,
  getPaperDuel,
  tickPaperDuels,
} from "@/lib/paper-duels";
import { isEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!(await isEnabled("paper_trading_duels_enabled"))) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  const prices = await fetchCryptoSpotPrices();
  const payload = prices.map((p) => ({ asset: p.asset, price: p.price }));
  await tickPaperDuels(payload);

  const duel = await getPaperDuel(id);
  if (!duel) return NextResponse.json({ error: "not found" }, { status: 404 });

  const priceMap = new Map(payload.map((p) => [p.asset, p.price]));

  let liveCreatorReturn: number | null = null;
  let liveOpponentReturn: number | null = null;

  if (duel.status === "active") {
    const cNow = priceMap.get(duel.creator_asset);
    const oNow = duel.opponent_asset ? priceMap.get(duel.opponent_asset) : null;
    if (cNow != null && duel.creator_start_price) {
      liveCreatorReturn = computeReturnPct(duel.creator_start_price, cNow);
    }
    if (oNow != null && duel.opponent_start_price) {
      liveOpponentReturn = computeReturnPct(duel.opponent_start_price, oNow);
    }
  }

  return NextResponse.json({
    duel,
    liveCreatorReturn,
    liveOpponentReturn,
    prices: payload,
  });
}

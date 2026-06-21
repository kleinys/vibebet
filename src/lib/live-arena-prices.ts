import "server-only";
import { fetchCryptoSpotPrices, type AssetPrice } from "@/lib/crypto-prices";
import {
  fetchEquitySpotPrices,
  isUsEquitySessionOpen,
  type EquityPrice,
} from "@/lib/equity-prices";

export type LiveArenaPrice = AssetPrice | EquityPrice;

export async function fetchLiveArenaPrices(opts: {
  cryptoOn: boolean;
  equitiesOn: boolean;
}): Promise<LiveArenaPrice[]> {
  const tasks: Promise<LiveArenaPrice[]>[] = [];
  if (opts.cryptoOn) {
    tasks.push(
      fetchCryptoSpotPrices().catch(() => [] as LiveArenaPrice[]),
    );
  }
  if (opts.equitiesOn && isUsEquitySessionOpen()) {
    tasks.push(
      fetchEquitySpotPrices().catch(() => [] as LiveArenaPrice[]),
    );
  }
  if (tasks.length === 0) return [];
  const chunks = await Promise.all(tasks);
  return chunks.flat();
}

export function pricesToTickPayload(prices: LiveArenaPrice[]) {
  return prices.map((p) => ({ asset: p.asset, price: p.price }));
}

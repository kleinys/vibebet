import "server-only";
import type { FastAsset } from "@/lib/fast-assets";
import { FAST_ASSET_LABELS } from "@/lib/fast-assets";

export type { FastAsset } from "@/lib/fast-assets";
export { FAST_ASSET_ICONS } from "@/lib/fast-assets";

export interface AssetPrice {
  asset: FastAsset;
  price: number;
  label: string;
}

const COINGECKO_IDS: Record<FastAsset, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
};

const LABELS = FAST_ASSET_LABELS;

/** Fetch spot USD prices for fast-market assets (CoinGecko public API). */
export async function fetchCryptoSpotPrices(
  assets: FastAsset[] = ["btc", "eth", "sol"],
): Promise<AssetPrice[]> {
  const ids = assets.map((a) => COINGECKO_IDS[a]).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  const res = await fetch(url, { next: { revalidate: 5 } });
  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[crypto-prices] CoinGecko ${res.status}`);
    }
    return [];
  }

  const raw = (await res.json()) as Record<string, { usd?: number }>;
  const out: AssetPrice[] = [];

  for (const asset of assets) {
    const price = raw[COINGECKO_IDS[asset]]?.usd;
    if (price && price > 0) {
      out.push({ asset, price, label: LABELS[asset] });
    }
  }

  return out;
}

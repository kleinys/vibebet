import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prices = await fetchCryptoSpotPrices();
    const btc = prices.find((p) => p.asset === "btc");
    if (!btc?.price) {
      return NextResponse.json({ error: "no_price" }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: settledCount } = await supabase.rpc("tick_lightning_duels", {
      p_btc_price: btc.price,
    });

    return NextResponse.json({
      price: btc.price,
      settled: (settledCount ?? 0) > 0,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";
import {
  computeReturnPct,
  getPaperDuel,
  tickPaperDuels,
} from "@/lib/paper-duels";
import { PaperDuelLiveView } from "../paper-duel-live-view";

export const revalidate = 0;

export default async function PaperDuelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enabled = await isEnabled("paper_trading_duels_enabled");
  if (!enabled) redirect("/games");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prices = await fetchCryptoSpotPrices();
  const payload = prices.map((p) => ({ asset: p.asset, price: p.price }));
  await tickPaperDuels(payload);

  const duel = await getPaperDuel(id);
  if (!duel) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Race not found</h1>
        <Link href="/games/paper" className="mt-4 inline-block text-sm text-cyan-400 hover:underline">
          ← Return Races
        </Link>
      </div>
    );
  }

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PaperDuelLiveView
        duelId={id}
        userId={user?.id ?? null}
        initial={{ duel, liveCreatorReturn, liveOpponentReturn, prices: payload }}
      />
    </div>
  );
}

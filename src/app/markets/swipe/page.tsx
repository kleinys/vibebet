import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { listMarkets } from "@/lib/markets";
import { getAllBalances } from "@/lib/ledger";
import { computeRecommendedStake } from "@/lib/smart-bet-defaults";
import { toSwipeDeckMarket } from "@/lib/swipe-deck";
import { FeatureOffPanel } from "@/components/feature-off-panel";
import { ChunkPulse } from "@/components/chunk-pulse";

const SwipeDeck = dynamic(
  () => import("@/components/swipe-deck").then((m) => m.SwipeDeck),
  { loading: () => <ChunkPulse className="h-[70vh] w-full" /> },
);

export const revalidate = 0;

export default async function MarketsSwipePage() {
  const [marketsOn, swipeOn] = await Promise.all([
    isEnabled("markets_enabled"),
    isEnabled("swipe_deck_enabled"),
  ]);

  if (!marketsOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <FeatureOffPanel
          title="Markets are off"
          body="The markets_enabled flag is currently disabled."
          ctaHref="/"
          ctaLabel="Home"
        />
      </div>
    );
  }

  if (!swipeOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <FeatureOffPanel
          title="Swipe deck"
          body="Gesture trading is coming soon — keep the classic grid for now."
          ctaHref="/markets"
          ctaLabel="Browse markets"
        />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const markets = await listMarkets({
    status: "open",
    kind: "binary",
    sort: "trending",
    limit: 24,
  });

  let vibeBalance = 0;
  let recommendedStake = 50;
  if (user) {
    const balances = await getAllBalances(user.id).catch(() => ({ vibe: 0, gem: 0 }));
    vibeBalance = balances.vibe;
    const { data: recent } = await supabase
      .from("trades")
      .select("cost")
      .eq("user_id", user.id)
      .gt("cost", 0)
      .order("created_at", { ascending: false })
      .limit(12);
    recommendedStake = computeRecommendedStake(
      vibeBalance,
      (recent ?? []).map((r) => r.cost),
    );
  }

  const deck = markets.map(toSwipeDeckMarket);

  if (deck.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">No open markets</h1>
        <p className="mt-2 text-sm text-zinc-400">Check back when new markets go live.</p>
        <Link href="/markets" className="mt-6 inline-block text-sm text-fuchsia-300 hover:underline">
          Markets grid →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
        <Link href="/markets" className="hover:text-zinc-300">
          ← Grid
        </Link>
        {!user && (
          <Link href="/login?next=/markets/swipe" className="text-fuchsia-300 hover:underline">
            Log in
          </Link>
        )}
      </div>
      <SwipeDeck
        markets={deck}
        vibeBalance={vibeBalance}
        recommendedStake={recommendedStake}
        isLoggedIn={Boolean(user)}
      />
    </div>
  );
}

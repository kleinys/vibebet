import "server-only";

import { getActiveSpectatorDuels } from "@/lib/duels";
import { isEnabled } from "@/lib/feature-flags";
import { getLiveEvents } from "@/lib/live-events";
import { getMarket, getUserPosition, listMarkets } from "@/lib/markets";

export type WatchBetMarket = {
  id: string;
  question: string;
  tag: "Duel" | "Live" | "Trending" | "Stream";
  reserveYes: number;
  reserveNo: number;
  yesLabel: string;
  noLabel: string;
  yesShares: number;
  noShares: number;
  totalCost: number;
  yesPrice: number;
  creatorName?: string;
  createdAt?: string;
};

function relevanceScore(
  question: string,
  category: string,
  context: { title: string; channel: string; game?: string },
): number {
  const hay = `${context.title} ${context.channel} ${context.game ?? ""}`.toLowerCase();
  let score = 0;
  for (const word of question.toLowerCase().split(/\W+/)) {
    if (word.length < 4) continue;
    if (hay.includes(word)) score += 2;
  }
  const game = (context.game ?? "").toLowerCase();
  if (game && hay.includes(game)) score += 4;
  if (/valorant|league|cs2|dota|fortnite|fifa|nba|nfl|ufc/i.test(hay)) {
    if (category === "sports" || category === "entertainment") score += 1;
  }
  return score;
}

async function marketToWatchBet(
  marketId: string,
  tag: WatchBetMarket["tag"],
  userId: string | null,
): Promise<WatchBetMarket | null> {
  const market = await getMarket(marketId);
  if (!market || market.status !== "open" || market.kind === "categorical") return null;

  const position =
    userId != null ? await getUserPosition(market.id, userId) : null;

  return {
    id: market.id,
    question: market.question,
    tag,
    reserveYes: market.reserve_yes,
    reserveNo: market.reserve_no,
    yesLabel: market.outcome_yes_label,
    noLabel: market.outcome_no_label,
    yesShares: position?.yesShares ?? 0,
    noShares: position?.noShares ?? 0,
    totalCost: position?.totalCost ?? 0,
    yesPrice: market.yes_price,
  };
}

/** Open markets to bet on while watching a stream (duels, live events, trending). */
export async function getWatchBetMarkets(opts?: {
  userId?: string | null;
  title?: string;
  channel?: string;
  game?: string;
  limit?: number;
}): Promise<WatchBetMarket[]> {
  const limit = opts?.limit ?? 8;
  const context = {
    title: opts?.title ?? "",
    channel: opts?.channel ?? "",
    game: opts?.game,
  };

  const [duelsOn, spectatorOn, liveOn, trending] = await Promise.all([
    isEnabled("duels_enabled"),
    isEnabled("duel_spectator_markets_enabled"),
    isEnabled("live_events_enabled"),
    listMarkets({ status: "open", sort: "trending", limit: 12, excludeSource: "community" }),
  ]);

  const [duels, events] = await Promise.all([
    duelsOn && spectatorOn ? getActiveSpectatorDuels(8) : Promise.resolve([]),
    liveOn ? getLiveEvents(20) : Promise.resolve([]),
  ]);

  const orderedIds: Array<{ id: string; tag: WatchBetMarket["tag"] }> = [];
  const seen = new Set<string>();

  function push(id: string | null | undefined, tag: WatchBetMarket["tag"]) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    orderedIds.push({ id, tag });
  }

  if (duelsOn && spectatorOn) {
    for (const d of duels) push(d.spectator_market_id, "Duel");
  }

  if (liveOn) {
    for (const e of events) {
      if (e.status === "live" || e.status === "scheduled") {
        push(e.betting_market_id, "Live");
      }
    }
  }

  const rankedTrending = [...trending].sort((a, b) => {
    const sa = relevanceScore(a.question, a.category, context);
    const sb = relevanceScore(b.question, b.category, context);
    return sb - sa || b.volume_24h - a.volume_24h;
  });

  for (const m of rankedTrending) push(m.id, "Trending");

  const markets = (
    await Promise.all(
      orderedIds.slice(0, limit + 4).map(({ id, tag }) =>
        marketToWatchBet(id, tag, opts?.userId ?? null),
      ),
    )
  ).filter((m): m is WatchBetMarket => m != null);

  return markets
    .sort((a, b) => {
      const tagOrder = { Stream: 4, Duel: 3, Live: 2, Trending: 1 };
      const ta = tagOrder[a.tag];
      const tb = tagOrder[b.tag];
      if (ta !== tb) return tb - ta;
      return (
        relevanceScore(b.question, "", context) -
        relevanceScore(a.question, "", context)
      );
    })
    .slice(0, limit);
}

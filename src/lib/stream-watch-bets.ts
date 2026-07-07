import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUserPosition } from "@/lib/markets";
import type { WatchBetMarket } from "@/lib/watch-bet-markets";

export type StreamWatchContext = {
  provider: string;
  externalId: string;
  title?: string;
};

function normalizeProvider(provider: string): string {
  const p = provider.toLowerCase().trim();
  if (p === "youtube" || p === "twitch" || p === "kick") return p;
  return "other";
}

export async function getStreamWatchBets(
  ctx: StreamWatchContext,
  userId: string | null,
): Promise<WatchBetMarket[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_stream_watch_bets", {
      p_provider: normalizeProvider(ctx.provider),
      p_external_id: ctx.externalId.trim(),
      p_limit: 30,
    });
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[stream-watch-bets] list:", error.message);
      }
      return [];
    }

    const rows = (data ?? []) as Array<{
      bet_id: string;
      market_id: string;
      question: string;
      yes_label: string;
      no_label: string;
      creator_name: string;
      created_at: string;
      market_status: string;
      reserve_yes: number;
      reserve_no: number;
      yes_price: number;
    }>;

    const markets = await Promise.all(
      rows.map(async (row) => {
        const position =
          userId != null ? await getUserPosition(row.market_id, userId) : null;
        return {
          id: row.market_id,
          question: row.question,
          tag: "Stream" as const,
          reserveYes: Number(row.reserve_yes),
          reserveNo: Number(row.reserve_no),
          yesLabel: row.yes_label,
          noLabel: row.no_label,
          yesShares: position?.yesShares ?? 0,
          noShares: position?.noShares ?? 0,
          totalCost: position?.totalCost ?? 0,
          yesPrice: Number(row.yes_price),
          creatorName: row.creator_name,
          createdAt: row.created_at,
        };
      }),
    );

    return markets;
  } catch {
    return [];
  }
}

export type StreamWatchBetMarket = WatchBetMarket & {
  creatorName?: string;
  createdAt?: string;
};

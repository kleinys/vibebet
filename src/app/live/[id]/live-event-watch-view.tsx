"use client";

import Link from "next/link";
import { StreamEmbed } from "@/components/stream-embed";
import { TradePanel } from "@/components/trade-panel";
import { LIVE_EVENT_CATEGORIES } from "@/lib/stream-url";
import { formatVibe } from "@/lib/utils";
import type { LiveEventSummary } from "@/lib/live-events";
import { LiveEventHostControls } from "../live-event-host-controls";

export function LiveEventWatchView({
  event,
  isHost,
  vibeBalance,
  yesShares,
  noShares,
  totalCost,
  yesLabel,
  noLabel,
  reserveYes,
  reserveNo,
  bettingOpen,
  quickExitEnabled,
}: {
  event: LiveEventSummary;
  isHost: boolean;
  vibeBalance: number;
  yesShares: number;
  noShares: number;
  totalCost: number;
  yesLabel: string;
  noLabel: string;
  reserveYes: number;
  reserveNo: number;
  bettingOpen: boolean;
  quickExitEnabled: boolean;
}) {
  const cat =
    LIVE_EVENT_CATEGORIES.find((c) => c.id === event.category) ??
    LIVE_EVENT_CATEGORIES[4];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/live" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Watch hub
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {event.status === "live" && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
                Live
              </span>
            )}
            <span className="text-xs text-zinc-500">
              {cat.icon} {cat.label}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{event.title}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hosted by {event.creator_name}
            {event.starts_at &&
              ` · ${new Date(event.starts_at).toLocaleString()}`}
          </p>
        </div>
        {isHost && (
          <LiveEventHostControls eventId={event.id} status={event.status} />
        )}
      </div>

      {event.description && (
        <p className="mt-4 max-w-3xl text-sm text-zinc-300">{event.description}</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <StreamEmbed streamUrl={event.stream_url} title={event.title} />

          {event.duel_id && (
            <Link
              href={`/duels/${event.duel_id}`}
              className="block rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200 hover:bg-violet-500/15"
            >
              Linked prediction duel — view match details →
            </Link>
          )}
          {event.paper_duel_id && (
            <Link
              href={`/games/paper/${event.paper_duel_id}`}
              className="block rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200 hover:bg-cyan-500/15"
            >
              Linked return race — watch live scores →
            </Link>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
            <h2 className="text-sm font-semibold">Place a bet</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Bet while you watch. Market resolves when the host settles the outcome.
            </p>
            {!event.betting_market_id ? (
              <p className="mt-4 text-sm text-zinc-500">No betting market on this event.</p>
            ) : !bettingOpen ? (
              <p className="mt-4 text-sm text-zinc-500">Betting closed.</p>
            ) : vibeBalance >= 0 ? (
              <div className="mt-4">
                <TradePanel
                  marketId={event.betting_market_id}
                  reserveYes={reserveYes}
                  reserveNo={reserveNo}
                  vibeBalance={vibeBalance}
                  yesShares={yesShares}
                  noShares={noShares}
                  totalCost={totalCost}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                  quickExitEnabled={quickExitEnabled}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-400">
                <Link href={`/login?next=/live/${event.id}`} className="text-fuchsia-400 hover:underline">
                  Sign in
                </Link>{" "}
                to bet.
              </p>
            )}
          </div>

          {(yesShares > 0 || noShares > 0) && (
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Your position
              </h3>
              <p className="mt-2 text-zinc-300">
                {yesLabel}: {formatVibe(yesShares)} · {noLabel}: {formatVibe(noShares)}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

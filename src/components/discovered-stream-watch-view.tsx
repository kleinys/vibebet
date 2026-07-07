"use client";

import Link from "next/link";
import { StreamEmbed } from "@/components/stream-embed";
import { WatchBetSidebar } from "@/components/watch-bet-sidebar";
import { streamProviderLabel, type StreamProvider } from "@/lib/stream-url";
import type { WatchBetMarket } from "@/lib/watch-bet-markets";

export function DiscoveredStreamWatchView({
  watchUrl,
  title,
  channel,
  provider,
  streamExternalId,
  streamBets,
  otherMarkets,
  vibeBalance,
  quickExitEnabled,
  signedIn,
  loginNext,
  defaultMarketId,
}: {
  watchUrl: string;
  title: string;
  channel: string;
  provider: string;
  streamExternalId: string;
  streamBets: WatchBetMarket[];
  otherMarkets: WatchBetMarket[];
  vibeBalance: number;
  quickExitEnabled: boolean;
  signedIn: boolean;
  loginNext: string;
  defaultMarketId?: string | null;
}) {
  const label =
    provider in { youtube: 1, twitch: 1, kick: 1 }
      ? streamProviderLabel(provider as StreamProvider)
      : provider;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link href="/live" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Watch hub
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            {label} · in-app player
          </span>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{title}</h1>
          {channel && <p className="mt-1 text-sm text-zinc-400">{channel}</p>}
        </div>
        <Link
          href="/games/duels"
          className="rounded-md border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
        >
          Duel hub
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <aside className="order-2 lg:order-1 lg:sticky lg:top-20 lg:self-start">
          <WatchBetSidebar
            streamBets={streamBets}
            otherMarkets={otherMarkets}
            streamContext={{
              provider,
              externalId: streamExternalId,
              title,
            }}
            vibeBalance={vibeBalance}
            quickExitEnabled={quickExitEnabled}
            signedIn={signedIn}
            loginNext={loginNext}
            defaultMarketId={defaultMarketId}
          />
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <StreamEmbed
            streamUrl={watchUrl}
            title={title}
            className="shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          />
          <p className="mt-4 text-xs text-zinc-500">
            Stream plays here — no jump to YouTube, Twitch, or Kick. Create stream bets on the
            left or trade on polls others posted for this stream.
          </p>
        </div>
      </div>
    </div>
  );
}

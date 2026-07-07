"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CreateStreamBetForm } from "@/components/create-stream-bet-form";
import { TradePanel } from "@/components/trade-panel";
import { formatProbability } from "@/lib/cpmm";
import { formatVibe } from "@/lib/utils";
import type { WatchBetMarket } from "@/lib/watch-bet-markets";

const TAG_STYLES: Record<WatchBetMarket["tag"], string> = {
  Stream: "bg-fuchsia-500/20 text-fuchsia-300",
  Duel: "bg-violet-500/20 text-violet-300",
  Live: "bg-rose-500/20 text-rose-300",
  Trending: "bg-sky-500/20 text-sky-300",
};

export function WatchBetSidebar({
  streamBets,
  otherMarkets = [],
  streamContext,
  vibeBalance,
  quickExitEnabled,
  signedIn,
  loginNext,
  defaultMarketId,
}: {
  streamBets: WatchBetMarket[];
  otherMarkets?: WatchBetMarket[];
  streamContext: {
    provider: string;
    externalId: string;
    title: string;
  };
  vibeBalance: number;
  quickExitEnabled: boolean;
  signedIn: boolean;
  loginNext: string;
  defaultMarketId?: string | null;
}) {
  const router = useRouter();
  const allMarkets = useMemo(
    () => [...streamBets, ...otherMarkets],
    [streamBets, otherMarkets],
  );

  const initialId =
    (defaultMarketId && allMarkets.some((m) => m.id === defaultMarketId)
      ? defaultMarketId
      : streamBets[0]?.id ?? otherMarkets[0]?.id) ?? "";

  const [selectedId, setSelectedId] = useState(initialId);
  const [showOther, setShowOther] = useState(false);

  const selected = useMemo(
    () => allMarkets.find((m) => m.id === selectedId) ?? streamBets[0] ?? otherMarkets[0] ?? null,
    [allMarkets, streamBets, otherMarkets, selectedId],
  );

  const onBetCreated = useCallback(
    (marketId: string) => {
      setSelectedId(marketId);
      router.refresh();
    },
    [router],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Bet while you watch</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Stream bets are polls for this stream. Pick one and trade Yes or No.
        </p>

        <div className="mt-4">
          <CreateStreamBetForm
            provider={streamContext.provider}
            externalId={streamContext.externalId}
            streamTitle={streamContext.title}
            signedIn={signedIn}
            loginNext={loginNext}
            onCreated={onBetCreated}
          />
        </div>

        <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Stream bets
          {streamBets.length > 0 && (
            <span className="ml-1.5 font-normal normal-case text-zinc-500">
              ({streamBets.length} active)
            </span>
          )}
        </label>

        {streamBets.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center text-[11px] leading-relaxed text-zinc-500">
            No stream bets yet. Be the first — post a poll above about something that could
            happen in this stream.
          </p>
        ) : (
          <div className="mt-1.5 max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            {streamBets.map((m) => (
              <MarketPickButton
                key={m.id}
                market={m}
                active={m.id === selected?.id}
                onSelect={() => setSelectedId(m.id)}
              />
            ))}
          </div>
        )}

        {otherMarkets.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => setShowOther((v) => !v)}
              className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-300"
            >
              <span>Other markets</span>
              <span>{showOther ? "−" : "+"}</span>
            </button>
            {showOther && (
              <div className="mt-1.5 max-h-36 space-y-1.5 overflow-y-auto pr-0.5">
                {otherMarkets.map((m) => (
                  <MarketPickButton
                    key={m.id}
                    market={m}
                    active={m.id === selected?.id}
                    onSelect={() => setSelectedId(m.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {selected && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="text-xs font-medium leading-snug text-zinc-300">{selected.question}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-500">
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                {selected.yesLabel}: {formatProbability(selected.yesPrice)}
              </span>
              <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-300">
                {selected.noLabel}: {formatProbability(1 - selected.yesPrice)}
              </span>
            </div>
            {selected.creatorName && selected.tag === "Stream" && (
              <p className="mt-1.5 text-[10px] text-zinc-500">
                Posted by {selected.creatorName}
              </p>
            )}

            {!signedIn ? (
              <p className="mt-4 text-sm text-zinc-400">
                <Link
                  href={`/login?next=${encodeURIComponent(loginNext)}`}
                  className="text-fuchsia-400 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to place a bet.
              </p>
            ) : (
              <div className="mt-4">
                <TradePanel
                  key={selected.id}
                  marketId={selected.id}
                  reserveYes={selected.reserveYes}
                  reserveNo={selected.reserveNo}
                  vibeBalance={vibeBalance}
                  yesShares={selected.yesShares}
                  noShares={selected.noShares}
                  totalCost={selected.totalCost}
                  yesLabel={selected.yesLabel}
                  noLabel={selected.noLabel}
                  quickExitEnabled={quickExitEnabled}
                />
              </div>
            )}

            <Link
              href={`/markets/${selected.id}`}
              className="mt-3 inline-block text-xs text-sky-400 hover:underline"
            >
              Open full market →
            </Link>
          </div>
        )}
      </div>

      {selected && signedIn && (selected.yesShares > 0 || selected.noShares > 0) && (
        <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your position
          </h3>
          <p className="mt-2 text-zinc-300">
            {selected.yesLabel}: {formatVibe(selected.yesShares)} · {selected.noLabel}:{" "}
            {formatVibe(selected.noShares)}
          </p>
        </div>
      )}
    </div>
  );
}

function MarketPickButton({
  market,
  active,
  onSelect,
}: {
  market: WatchBetMarket;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
        active
          ? "border-fuchsia-500/40 bg-fuchsia-500/10"
          : "border-white/5 bg-black/20 hover:border-white/10 hover:bg-black/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${TAG_STYLES[market.tag]}`}
        >
          {market.tag}
        </span>
        <span className="text-[10px] tabular-nums text-emerald-300">
          {formatProbability(market.yesPrice)} {market.yesLabel}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-zinc-200">
        {market.question}
      </p>
    </button>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CreateStreamBetForm } from "@/components/create-stream-bet-form";
import { StreamWatchComments } from "@/components/stream-watch-comments";
import { TradePanel } from "@/components/trade-panel";
import { formatProbability } from "@/lib/cpmm";
import type { StreamWatchComment } from "@/lib/stream-watch-comments";
import { formatVibe } from "@/lib/utils";
import type { WatchBetMarket } from "@/lib/watch-bet-markets";

function formatBetTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export function WatchBetSidebar({
  streamBets,
  streamComments,
  streamContext,
  vibeBalance,
  quickExitEnabled,
  signedIn,
  loginNext,
  defaultMarketId,
}: {
  streamBets: WatchBetMarket[];
  streamComments: StreamWatchComment[];
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

  const initialId =
    (defaultMarketId && streamBets.some((m) => m.id === defaultMarketId)
      ? defaultMarketId
      : streamBets[0]?.id) ?? "";

  const [selectedId, setSelectedId] = useState(initialId);

  const selected = useMemo(
    () => streamBets.find((m) => m.id === selectedId) ?? streamBets[0] ?? null,
    [streamBets, selectedId],
  );

  const onBetCreated = useCallback(
    (marketId: string) => {
      setSelectedId(marketId);
      router.refresh();
    },
    [router],
  );

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-white/5 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Stream bets</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Polls for this stream only — create one or trade on existing bets.
        </p>

        <div className="mt-3 shrink-0">
          <CreateStreamBetForm
            provider={streamContext.provider}
            externalId={streamContext.externalId}
            streamTitle={streamContext.title}
            signedIn={signedIn}
            loginNext={loginNext}
            onCreated={onBetCreated}
          />
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <label className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/90">
            Active stream bets
            {streamBets.length > 0 && (
              <span className="ml-1.5 font-normal normal-case text-zinc-500">
                ({streamBets.length})
              </span>
            )}
          </label>

          {streamBets.length === 0 ? (
            <p className="mt-2 flex-1 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-6 text-center text-[11px] leading-relaxed text-zinc-500">
              No bets yet for this stream. Post a poll above — e.g. &quot;Will they clutch
              this round?&quot;
            </p>
          ) : (
            <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {streamBets.map((m) => {
                const active = m.id === selected?.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      active
                        ? "border-fuchsia-500/45 bg-fuchsia-500/12 shadow-[0_0_20px_rgba(217,70,239,0.08)]"
                        : "border-white/5 bg-black/25 hover:border-white/10 hover:bg-black/35"
                    }`}
                  >
                    <p className="text-sm font-medium leading-snug text-zinc-100">{m.question}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300">
                        {m.yesLabel} {formatProbability(m.yesPrice)}
                      </span>
                      <span className="rounded bg-rose-500/15 px-2 py-0.5 font-medium text-rose-300">
                        {m.noLabel} {formatProbability(1 - m.yesPrice)}
                      </span>
                    </div>
                    {m.creatorName && (
                      <p className="mt-1.5 text-[10px] text-zinc-500">
                        by {m.creatorName}
                        {m.createdAt ? ` · ${formatBetTime(m.createdAt)}` : ""}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-4 shrink-0 border-t border-white/5 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Trade on selected bet
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-300">{selected.question}</p>

            {!signedIn ? (
              <p className="mt-3 text-sm text-zinc-400">
                <Link
                  href={`/login?next=${encodeURIComponent(loginNext)}`}
                  className="text-fuchsia-400 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to place a bet.
              </p>
            ) : (
              <div className="mt-3">
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
              className="mt-2 inline-block text-[11px] text-sky-400 hover:underline"
            >
              Open full market →
            </Link>
          </div>
        )}
      </div>

      {selected && signedIn && (selected.yesShares > 0 || selected.noShares > 0) && (
        <div className="shrink-0 rounded-xl border border-white/5 bg-zinc-900/40 p-3 text-sm">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Your position
          </h3>
          <p className="mt-1.5 text-xs text-zinc-300">
            {selected.yesLabel}: {formatVibe(selected.yesShares)} · {selected.noLabel}:{" "}
            {formatVibe(selected.noShares)}
          </p>
        </div>
      )}

      <div className="shrink-0">
        <StreamWatchComments
          provider={streamContext.provider}
          externalId={streamContext.externalId}
          comments={streamComments}
          signedIn={signedIn}
          loginNext={loginNext}
        />
      </div>
    </div>
  );
}

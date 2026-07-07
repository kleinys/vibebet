"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TradePanel } from "@/components/trade-panel";
import { formatProbability } from "@/lib/cpmm";
import { formatVibe } from "@/lib/utils";
import type { WatchBetMarket } from "@/lib/watch-bet-markets";

export function WatchBetSidebar({
  markets,
  vibeBalance,
  quickExitEnabled,
  signedIn,
  loginNext,
  defaultMarketId,
}: {
  markets: WatchBetMarket[];
  vibeBalance: number;
  quickExitEnabled: boolean;
  signedIn: boolean;
  loginNext: string;
  defaultMarketId?: string | null;
}) {
  const initialId =
    (defaultMarketId && markets.some((m) => m.id === defaultMarketId)
      ? defaultMarketId
      : markets[0]?.id) ?? "";

  const [selectedId, setSelectedId] = useState(initialId);

  const selected = useMemo(
    () => markets.find((m) => m.id === selectedId) ?? markets[0] ?? null,
    [markets, selectedId],
  );

  if (markets.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Bet while you watch</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          No open markets right now. Check the{" "}
          <Link href="/markets" className="text-fuchsia-400 hover:underline">
            markets hub
          </Link>{" "}
          or start a{" "}
          <Link href="/games/duels" className="text-violet-400 hover:underline">
            duel
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Bet while you watch</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Pick a market, choose Yes or No, and set your VIBE amount.
        </p>

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Market
        </label>
        <div className="mt-1.5 max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
          {markets.map((m) => {
            const active = m.id === selected?.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-fuchsia-500/40 bg-fuchsia-500/10"
                    : "border-white/5 bg-black/20 hover:border-white/10 hover:bg-black/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      m.tag === "Duel"
                        ? "bg-violet-500/20 text-violet-300"
                        : m.tag === "Live"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-sky-500/20 text-sky-300"
                    }`}
                  >
                    {m.tag}
                  </span>
                  <span className="text-[10px] tabular-nums text-emerald-300">
                    {formatProbability(m.yesPrice)} Yes
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-zinc-200">
                  {m.question}
                </p>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="text-xs font-medium leading-snug text-zinc-300">{selected.question}</p>
            <div className="mt-2 flex gap-2 text-[10px] text-zinc-500">
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                {selected.yesLabel}: {formatProbability(selected.yesPrice)}
              </span>
              <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-300">
                {selected.noLabel}: {formatProbability(1 - selected.yesPrice)}
              </span>
            </div>

            {!signedIn ? (
              <p className="mt-4 text-sm text-zinc-400">
                <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="text-fuchsia-400 hover:underline">
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

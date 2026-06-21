"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { formatVibe } from "@/lib/utils";
import { TradePanel } from "@/components/trade-panel";
import type { DuelDetail } from "@/lib/duels";
import { acceptDuel, cancelDuel } from "@/app/duels/actions";

export function DuelWatchView({
  duel,
  userId,
  vibeBalance,
  yesShares,
  noShares,
  totalCost,
  quickExitEnabled,
}: {
  duel: DuelDetail;
  userId: string | null;
  vibeBalance: number;
  yesShares: number;
  noShares: number;
  totalCost: number;
  quickExitEnabled: boolean;
}) {
  const [pending, start] = useTransition();
  const isChallenger = userId === duel.challenger_id;
  const isOpponent = userId === duel.opponent_id;
  const canAccept =
    duel.status === "pending" &&
    userId &&
    !isChallenger &&
    (duel.opponent_id === null || duel.opponent_id === userId);

  const specOpen =
    duel.spectator_market_id &&
    duel.spectator_status === "open" &&
    duel.spectator_reserve_yes != null &&
    duel.spectator_reserve_no != null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duels
      </Link>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wider text-violet-400">
          Prediction duel · {duel.status}
        </p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
          {duel.challenger_name}{" "}
          <span className="text-zinc-500">vs</span> {duel.opponent_name}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">{duel.market_question}</p>
        <p className="mt-1 text-xs text-amber-200">
          Stake: {formatVibe(duel.stake)} VIBE each · Challenger on{" "}
          {duel.challenger_side.toUpperCase()}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
            <h2 className="text-sm font-semibold text-violet-100">Match</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Challenger</dt>
                <dd className="font-medium">{duel.challenger_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Opponent</dt>
                <dd className="font-medium">{duel.opponent_name}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Underlying market</dt>
                <dd>
                  <Link
                    href={`/markets/${duel.market_id}`}
                    className="text-fuchsia-400 hover:underline"
                  >
                    View market →
                  </Link>
                </dd>
              </div>
            </dl>

            {canAccept && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await acceptDuel(duel.id);
                    if (r.error) toast.error(r.error);
                    else toast.success("Duel accepted!");
                  })
                }
                className="mt-4 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Accept duel ({formatVibe(duel.stake)} VIBE)
              </button>
            )}

            {duel.status === "pending" && isChallenger && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await cancelDuel(duel.id);
                    if (r.error) toast.error(r.error);
                    else toast.success("Duel cancelled.");
                  })
                }
                className="mt-4 rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:border-white/20 disabled:opacity-50"
              >
                Cancel challenge
              </button>
            )}
          </div>

          {duel.status === "pending" && (
            <p className="text-sm text-zinc-500">
              Spectator betting opens once someone accepts this duel
              {duel.spectator_market_id ? "" : " (if duel_spectator_markets_enabled is on)"}.
            </p>
          )}
        </div>

        <aside>
          {specOpen && duel.spectator_market_id ? (
            <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
              <h2 className="text-sm font-semibold">Bet on who wins</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Spectator market — resolves with the duel outcome.
              </p>
              {userId ? (
                <div className="mt-4">
                  <TradePanel
                    marketId={duel.spectator_market_id}
                    reserveYes={duel.spectator_reserve_yes!}
                    reserveNo={duel.spectator_reserve_no!}
                    vibeBalance={vibeBalance}
                    yesShares={yesShares}
                    noShares={noShares}
                    totalCost={totalCost}
                    yesLabel={duel.spectator_yes_label ?? duel.challenger_name}
                    noLabel={duel.spectator_no_label ?? duel.opponent_name}
                    quickExitEnabled={quickExitEnabled}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">
                  <Link
                    href={`/login?next=/duels/${duel.id}`}
                    className="text-fuchsia-400 hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to bet.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm text-zinc-500">
              {duel.status === "accepted"
                ? "No spectator market yet. Enable duel_spectator_markets_enabled and re-accept, or bet on the underlying market."
                : "Spectator betting not available for this duel yet."}
              <Link
                href={`/markets/${duel.market_id}`}
                className="mt-3 block text-fuchsia-400 hover:underline"
              >
                Bet on underlying market →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

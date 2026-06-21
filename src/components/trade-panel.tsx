"use client";

import { useActionState, useMemo, useState } from "react";
import {
  placeTrade,
  quickExitShares,
  sellShares,
  type TradeState,
} from "@/app/markets/[id]/actions";
import { formatVibe } from "@/lib/utils";
import {
  averagePrice,
  quoteProceedsForSell,
  quoteSharesOut,
} from "@/lib/cpmm";
import { CANCEL_BET_PAYOUT_RATIO, quoteCancelBet } from "@/lib/cancel-bet";

type Props = {
  marketId: string;
  reserveYes: number;
  reserveNo: number;
  disabled?: boolean;
  vibeBalance: number;
  yesShares: number;
  noShares: number;
  totalCost?: number;
  yesLabel?: string;
  noLabel?: string;
  quickExitEnabled?: boolean;
  defaultMode?: "buy" | "sell" | "cancel";
};

export function TradePanel({
  marketId,
  reserveYes,
  reserveNo,
  disabled,
  vibeBalance,
  yesShares,
  noShares,
  totalCost = 0,
  yesLabel = "Yes",
  noLabel = "No",
  quickExitEnabled = false,
  defaultMode = "buy",
}: Props) {
  const [mode, setMode] = useState<"buy" | "sell" | "cancel">(defaultMode);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("100");

  const [buyState, buyAction, buyPending] = useActionState(placeTrade, null);
  const [sellState, sellAction, sellPending] = useActionState(
    sellShares,
    null,
  );
  const [exitState, exitAction, exitPending] = useActionState(
    quickExitShares,
    null,
  );

  const state: TradeState = buyState ?? sellState ?? exitState;
  const pending = buyPending || sellPending || exitPending;

  const sellable = side === "yes" ? yesShares : noShares;
  const totalHeld = yesShares + noShares;

  const buyQuote = useMemo(() => {
    const cost = parseInt(amount, 10);
    if (!Number.isFinite(cost) || cost < 1) return null;
    const pool = { reserveYes, reserveNo };
    const sharesOut = quoteSharesOut(pool, side, cost);
    return {
      sharesOut,
      avgPrice: averagePrice(cost, sharesOut),
    };
  }, [amount, reserveYes, reserveNo, side]);

  const sellQuote = useMemo(() => {
    const shares = parseInt(amount, 10);
    if (!Number.isFinite(shares) || shares < 1) return null;
    const proceeds = quoteProceedsForSell(
      { reserveYes, reserveNo },
      side,
      shares,
    );
    return { proceeds };
  }, [amount, reserveYes, reserveNo, side]);

  const cancelQuote = useMemo(() => {
    const shares = parseInt(amount, 10);
    if (
      !Number.isFinite(shares) ||
      shares < 1 ||
      totalHeld <= 0 ||
      totalCost <= 0
    )
      return null;
    const costBasis = Math.floor((totalCost * shares) / totalHeld);
    const { proceeds, fee } = quoteCancelBet(costBasis);
    return { costBasis, proceeds, fee };
  }, [amount, totalCost, totalHeld]);

  const showCancelBet =
    quickExitEnabled && totalHeld > 0 && totalCost > 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-zinc-950/80 p-1">
        <button
          type="button"
          onClick={() => setMode("buy")}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
            mode === "buy"
              ? "bg-fuchsia-500/20 text-fuchsia-300"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setMode("sell")}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
            mode === "sell"
              ? "bg-fuchsia-500/20 text-fuchsia-300"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Sell
        </button>
        {showCancelBet && (
          <button
            type="button"
            onClick={() => setMode("cancel")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition sm:text-sm ${
              mode === "cancel"
                ? "bg-rose-500/20 text-rose-300"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Cancel and get 50% of what you paid back"
          >
            Cancel bet
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSide("yes")}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
            side === "yes"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 text-zinc-400 hover:border-white/20"
          }`}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          onClick={() => setSide("no")}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
            side === "no"
              ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
              : "border-white/10 text-zinc-400 hover:border-white/20"
          }`}
        >
          {noLabel}
        </button>
      </div>

      {mode === "buy" ? (
        <form action={buyAction} className="space-y-3">
          <input type="hidden" name="marketId" value={marketId} />
          <input type="hidden" name="side" value={side} />
          <label className="block text-xs text-zinc-400">
            VIBE to spend
            <input
              name="cost"
              type="number"
              min={1}
              max={vibeBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </label>
          {buyQuote && (
            <p className="text-xs text-zinc-500">
              ≈ {formatVibe(buyQuote.sharesOut)} shares · avg{" "}
              {(buyQuote.avgPrice * 100).toFixed(1)}¢
            </p>
          )}
          <button
            type="submit"
            disabled={disabled || pending || vibeBalance < 1}
            className="w-full rounded-md bg-fuchsia-500 py-2 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-40"
          >
            {pending ? "…" : `Buy ${side === "yes" ? yesLabel : noLabel}`}
          </button>
        </form>
      ) : mode === "sell" ? (
        <form action={sellAction} className="space-y-3">
          <input type="hidden" name="marketId" value={marketId} />
          <input type="hidden" name="side" value={side} />
          <label className="block text-xs text-zinc-400">
            Shares to sell (you hold {formatVibe(sellable)})
            <input
              name="shares"
              type="number"
              min={1}
              max={sellable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </label>
          {sellQuote && (
            <p className="text-xs text-zinc-500">
              ≈ {formatVibe(sellQuote.proceeds)} VIBE proceeds
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(sellable / 2)))}
              className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setAmount(String(sellable))}
              className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Max
            </button>
          </div>
          <button
            type="submit"
            disabled={disabled || pending || sellable < 1}
            className="w-full rounded-md bg-zinc-700 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-40"
          >
            {pending ? "…" : `Sell at market`}
          </button>
        </form>
      ) : (
        <form action={exitAction} className="space-y-3">
          <input type="hidden" name="marketId" value={marketId} />
          <input type="hidden" name="side" value={side} />
          <p className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-200/90">
            Cancel returns <strong>{Math.round(CANCEL_BET_PAYOUT_RATIO * 100)}%</strong> of
            what you paid for those shares — you forfeit the other half. Not the
            same as selling at current odds — use{" "}
            <button
              type="button"
              onClick={() => setMode("sell")}
              className="underline hover:text-rose-100"
            >
              Sell
            </button>{" "}
            for market price.
          </p>
          <label className="block text-xs text-zinc-400">
            Shares to exit (you hold {formatVibe(sellable)})
            <input
              name="shares"
              type="number"
              min={1}
              max={sellable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </label>
          {cancelQuote && (
            <p className="text-xs text-zinc-500">
              Paid {formatVibe(cancelQuote.costBasis)} →{" "}
              <span className="text-rose-300">
                {formatVibe(cancelQuote.proceeds)} VIBE back
              </span>{" "}
              (forfeit {formatVibe(cancelQuote.fee)})
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(sellable / 2)))}
              className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setAmount(String(sellable))}
              className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Max
            </button>
          </div>
          <button
            type="submit"
            disabled={disabled || pending || sellable < 1}
            className="w-full rounded-md bg-rose-700 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-40"
          >
            {pending ? "…" : `Cancel bet (${Math.round(CANCEL_BET_PAYOUT_RATIO * 100)}% back)`}
          </button>
        </form>
      )}

      {state && "error" in state && (
        <p className="text-sm text-rose-400">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-sm text-emerald-400">
          {state.success.kind === "buy" &&
            `Bought ${formatVibe(state.success.shares)} ${state.success.side} shares.`}
          {state.success.kind === "sell" &&
            `Sold for ${formatVibe(state.success.proceeds)} VIBE.`}
          {state.success.kind === "quick_exit" &&
            `Cancelled: ${formatVibe(state.success.proceeds)} VIBE returned (${Math.round(CANCEL_BET_PAYOUT_RATIO * 100)}%).`}
        </p>
      )}
    </div>
  );
}

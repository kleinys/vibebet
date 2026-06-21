"use client";

import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { formatProbability } from "@/lib/cpmm";
import { formatVibe } from "@/lib/utils";
import type { LimitOrderRow } from "@/lib/limit-orders";
import { cancelLimitOrder, createLimitOrder } from "@/app/limit-orders/actions";

export function LimitOrderForm({
  marketId,
  yesLabel,
  noLabel,
  currentYesPrice,
  currentNoPrice,
  disabled,
}: {
  marketId: string;
  yesLabel: string;
  noLabel: string;
  currentYesPrice: number;
  currentNoPrice: number;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(createLimitOrder, null);

  return (
    <form
      action={action}
      className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5"
    >
      <input type="hidden" name="marketId" value={marketId} />
      <h2 className="text-sm font-semibold text-sky-100">Limit order</h2>
      <p className="mt-1 text-[11px] text-sky-200/70">
        Buy when odds hit your target. VIBE is escrowed until filled or cancelled.
      </p>
      <p className="mt-2 text-[10px] text-zinc-500">
        Now: {yesLabel} {formatProbability(currentYesPrice)} · {noLabel}{" "}
        {formatProbability(currentNoPrice)}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-zinc-400">Side</span>
          <select
            name="side"
            required
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
          >
            <option value="yes">{yesLabel}</option>
            <option value="no">{noLabel}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Max price (¢)</span>
          <input
            name="limitPct"
            type="number"
            min={1}
            max={99}
            defaultValue={40}
            required
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Stake (VIBE)</span>
          <input
            name="stake"
            type="number"
            min={10}
            max={100000}
            defaultValue={50}
            required
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Expires (days)</span>
          <input
            name="expiresDays"
            type="number"
            min={1}
            max={30}
            defaultValue={7}
            disabled={disabled}
            className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm tabular-nums"
          />
        </label>
      </div>

      {state?.error && <p className="mt-3 text-xs text-red-300">{state.error}</p>}
      {state?.ok && <p className="mt-3 text-xs text-emerald-300">{state.ok}</p>}

      <button
        type="submit"
        disabled={pending || disabled}
        className="mt-4 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "Placing…" : "Place limit order"}
      </button>
    </form>
  );
}

export function LimitOrderList({ orders }: { orders: LimitOrderRow[] }) {
  const [pending, startTransition] = useTransition();

  if (orders.length === 0) {
    return (
      <p className="mt-6 text-sm text-zinc-500">
        No limit orders yet. Set one on any open market.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {orders.map((o) => (
        <li
          key={o.id}
          className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-zinc-100">
                {o.side.toUpperCase()} @ {(o.limit_price * 100).toFixed(1)}¢ ·{" "}
                {formatVibe(o.stake)} VIBE
              </p>
              <p className="mt-1 text-zinc-400">{o.market_question}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {o.status}
                {o.status === "open" && (
                  <> · expires {new Date(o.expires_at).toLocaleDateString()}</>
                )}
                {o.filled_at && (
                  <> · filled {new Date(o.filled_at).toLocaleString()}</>
                )}
              </p>
            </div>
            {o.status === "open" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const r = await cancelLimitOrder(o.id);
                    if (r.error) toast.error(r.error);
                    else toast.success("Order cancelled, VIBE refunded.");
                  });
                }}
                className="rounded-md border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:border-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  convertHustleCashToShares,
  redeemHustleSharesToCash,
} from "@/app/play/actions";
import type { HustleEquityState } from "@/lib/hustle-equity";
import { formatShares } from "@/lib/hustle-equity";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";

export function HustleSharesPanel({
  equity,
  onUpdate,
}: {
  equity: HustleEquityState;
  onUpdate: () => void;
}) {
  const [mode, setMode] = useState<"buy" | "redeem">("buy");
  const [amount, setAmount] = useState("100");
  const [pending, startTransition] = useTransition();

  const parsed = Number(amount);
  const sharesFromBuy =
    Number.isFinite(parsed) && parsed > 0 ? parsed / equity.convert_rate : 0;
  const cashFromRedeem =
    Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed) * equity.floor_redeem_rate
      : 0;

  function submit() {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    startTransition(async () => {
      if (mode === "buy") {
        const result = await convertHustleCashToShares(parsed);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(`Minted ${formatShares(result.shares_minted ?? 0)} shares`);
      } else {
        const result = await redeemHustleSharesToCash(parsed);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(
          `Redeemed for ${formatVibe(result.hustle_cash_received ?? 0)} Hustle Cash`,
        );
      }
      onUpdate();
    });
  }

  return (
    <section className="hustle-shares-panel">
      <div className="hustle-shares-panel__header">
        <div>
          <p className="hustle-shares-panel__eyebrow">Hustle Shares</p>
          <h3 className="hustle-shares-panel__title">Earn equity, not just cash</h3>
          <p className="hustle-shares-panel__sub">
            Convert Hustle Cash into capped shares (max {equity.max_shares}). Floor redeem
            returns Hustle Cash only — no USD yet.
          </p>
        </div>
        <div className="hustle-shares-panel__stat">
          <span className="text-[10px] uppercase tracking-wider text-emerald-200/80">
            Your shares
          </span>
          <span className="text-xl font-bold tabular-nums text-emerald-100">
            {formatShares(equity.hustle_shares)}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
            <CurrencyIconVibe className="h-3 w-3" />
            Floor ~{formatVibe(equity.floor_cash_value)} Hustle Cash
          </span>
        </div>
      </div>

      <div className="hustle-shares-panel__tabs">
        <button
          type="button"
          className={mode === "buy" ? "is-active" : ""}
          onClick={() => setMode("buy")}
        >
          Cash → Shares
        </button>
        <button
          type="button"
          className={mode === "redeem" ? "is-active" : ""}
          onClick={() => setMode("redeem")}
        >
          Shares → Cash
        </button>
      </div>

      {!equity.can_convert && mode === "buy" && (
        <p className="hustle-shares-panel__hint hustle-shares-panel__hint--warn">
          Unlock Gig tier ({equity.min_convert_tier}) to buy shares.
        </p>
      )}
      {!equity.can_redeem && mode === "redeem" && (
        <p className="hustle-shares-panel__hint hustle-shares-panel__hint--warn">
          Unlock Pro tier ({equity.min_redeem_tier}) to redeem at floor rate.
        </p>
      )}

      <div className="hustle-shares-panel__form">
        <input
          type="number"
          min={mode === "buy" ? 100 : 1}
          step={mode === "buy" ? 100 : 1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="hustle-shares-panel__input tabular-nums"
          placeholder={mode === "buy" ? "Hustle Cash (×100)" : "Whole shares"}
        />
        <button
          type="button"
          disabled={
            pending ||
            (mode === "buy" && !equity.can_convert) ||
            (mode === "redeem" && !equity.can_redeem)
          }
          onClick={submit}
          className="hustle-shares-panel__submit"
        >
          {mode === "buy" ? "Convert" : "Redeem"}
        </button>
      </div>

      <p className="hustle-shares-panel__hint">
        {mode === "buy" ? (
          <>
            {equity.convert_rate} Hustle Cash = 1 share · you get ~
            {formatShares(sharesFromBuy)} shares · daily cap{" "}
            {formatVibe(equity.daily_convert_limit)} (
            {formatVibe(equity.daily_converted_today)} used)
          </>
        ) : (
          <>
            1 share = {formatVibe(equity.floor_redeem_rate)} Hustle Cash floor · you receive ~
            {formatVibe(cashFromRedeem)}
          </>
        )}
      </p>

      {equity.history.length > 0 && (
        <ul className="hustle-shares-panel__history">
          {equity.history.slice(0, 5).map((h) => (
            <li key={h.id}>
              <span className="text-zinc-300">
                {h.kind === "cash_to_shares" && "Bought shares"}
                {h.kind === "shares_to_cash" && "Redeemed shares"}
                {h.kind === "tier_bonus" && "Pro tier bonus"}
                {h.kind === "gig_bonus" && "Gig bonus"}
              </span>
              <span className="tabular-nums text-emerald-200">
                {h.delta_shares > 0 ? "+" : ""}
                {formatShares(h.delta_shares)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

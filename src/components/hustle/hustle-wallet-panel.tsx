"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelHustleTransfer,
  requestHustleTransfer,
} from "@/app/play/actions";
import type { HustleWalletState } from "@/lib/hustle-wallet";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";

export function HustleWalletPanel({
  wallet,
  blocksPlayBridge,
  recoveryUntil,
  onUpdate,
}: {
  wallet: HustleWalletState;
  blocksPlayBridge?: boolean;
  recoveryUntil?: string | null;
  onUpdate: () => void;
}) {
  const [amount, setAmount] = useState("100");
  const [direction, setDirection] = useState<"earn_to_play" | "play_to_earn">(
    "earn_to_play",
  );
  const [pending, startTransition] = useTransition();

  const parsed = Number(amount);
  const playToEarnNet =
    Number.isFinite(parsed) && parsed > 0
      ? Math.floor(parsed * (1 - wallet.play_to_earn_fee_pct / 100))
      : 0;

  function submit() {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (
      direction === "earn_to_play" &&
      parsed > wallet.cooling_threshold &&
      !window.confirm(
        `Transfers over ${wallet.cooling_threshold} VIBE have a 24-hour cooling-off period. Continue?`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await requestHustleTransfer(direction, parsed);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        direction === "earn_to_play" && parsed > wallet.cooling_threshold
          ? "Transfer queued — completes in 24h (cancel anytime)"
          : "Transfer completed",
      );
      onUpdate();
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      const result = await cancelHustleTransfer(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Transfer cancelled — Hustle Cash refunded");
      onUpdate();
    });
  }

  return (
    <div className="hustle-wallet-panel">
      <p className="hustle-wallet-panel__title">Earn ↔ Play bridge</p>

      {blocksPlayBridge && (
        <div className="hustle-wallet-panel__recovery-banner">
          <strong>Recovery mode</strong> — Earn → Play transfers are locked
          {recoveryUntil && (
            <span> until {new Date(recoveryUntil).toLocaleDateString()}</span>
          )}
          . Play → Earn still works.
        </div>
      )}

      <div className="hustle-wallet-panel__balances">
        <div className="hustle-wallet-panel__balance hustle-wallet-panel__balance--earn">
          <span className="text-[10px] uppercase tracking-wider text-amber-200/80">
            Hustle Cash
          </span>
          <span className="flex items-center gap-1 text-lg font-bold tabular-nums text-amber-100">
            <CurrencyIconVibe className="h-4 w-4" />
            {formatVibe(wallet.hustle_cash)}
          </span>
          <span className="text-[10px] text-zinc-500">From task claims</span>
        </div>
        <div className="hustle-wallet-panel__balance hustle-wallet-panel__balance--play">
          <span className="text-[10px] uppercase tracking-wider text-violet-200/80">
            Play VIBE
          </span>
          <span className="flex items-center gap-1 text-lg font-bold tabular-nums text-violet-100">
            <CurrencyIconVibe className="h-4 w-4" />
            {formatVibe(wallet.play_balance)}
          </span>
          <span className="text-[10px] text-zinc-500">Duels, arena, markets</span>
        </div>
      </div>

      <div className="hustle-wallet-panel__direction">
        <button
          type="button"
          className={direction === "earn_to_play" ? "is-active" : ""}
          onClick={() => setDirection("earn_to_play")}
          disabled={blocksPlayBridge}
        >
          Earn → Play (1:1)
        </button>
        <button
          type="button"
          className={direction === "play_to_earn" ? "is-active" : ""}
          onClick={() => setDirection("play_to_earn")}
        >
          Play → Earn (5% fee)
        </button>
      </div>

      <div className="hustle-wallet-panel__form">
        <input
          type="number"
          min={direction === "earn_to_play" ? 50 : 100}
          max={direction === "earn_to_play" ? 500 : 2000}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="hustle-wallet-panel__input tabular-nums"
          placeholder="Amount (VIBE)"
        />
        <button
          type="button"
          disabled={pending || (direction === "earn_to_play" && blocksPlayBridge)}
          onClick={submit}
          className="hustle-wallet-panel__submit"
        >
          Transfer
        </button>
      </div>

      <p className="hustle-wallet-panel__hint">
        {direction === "earn_to_play" ? (
          <>
            Min 50 · max 500 · daily {formatVibe(wallet.daily_limit_earn_to_play)}.
            Over {wallet.cooling_threshold} VIBE = 24h cooling-off.
          </>
        ) : (
          <>
            Min 100 · max 2000 · you receive ~{formatVibe(playToEarnNet)} VIBE after fee.
          </>
        )}
      </p>

      {wallet.pending_transfers.length > 0 && (
        <ul className="hustle-wallet-panel__pending">
          {wallet.pending_transfers.map((t) => (
            <li key={t.id}>
              <div>
                <p className="text-xs font-medium text-zinc-200">
                  {t.direction === "earn_to_play" ? "Earn → Play" : "Play → Earn"}{" "}
                  {formatVibe(t.amount)} VIBE
                </p>
                {t.completes_at && (
                  <p className="text-[10px] text-zinc-500">
                    Completes {new Date(t.completes_at).toLocaleString()}
                  </p>
                )}
              </div>
              {t.direction === "earn_to_play" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => cancel(t.id)}
                  className="text-[10px] font-semibold text-rose-300 hover:text-rose-200"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

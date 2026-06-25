"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { requestGemWithdrawal } from "@/app/account/wallet-actions";

export function WalletCashoutPanel({
  gems,
  cashoutEnabled,
  minGems,
}: {
  gems: number;
  cashoutEnabled: boolean;
  minGems: number;
}) {
  const [pending, startTransition] = useTransition();
  const usdEquiv = (gems / 100).toFixed(2);

  if (!cashoutEnabled) {
    return (
      <section className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h2 className="text-sm font-semibold text-amber-100">Cash out (coming soon)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Real-money Gem withdrawals require identity verification, payment partners, and legal
          licensing. Vibebet is currently <strong className="font-medium text-zinc-300">play-money
          only</strong> — Gems buy cosmetics and have no cash value until this feature launches with
          full compliance.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Your Gems: {gems.toLocaleString()} (display equivalent ~${usdEquiv} at 100 Gems = $1).
        </p>
        <Link href="/shop" className="mt-3 inline-block text-xs text-fuchsia-400 hover:underline">
          Buy Gem bundles →
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <h2 className="text-sm font-semibold text-emerald-100">Cash out Gems</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Minimum {minGems} Gems · 100 Gems = $1.00 · KYC required for first withdrawal
      </p>
      <p className="mt-2 text-sm text-zinc-300">Balance: {gems.toLocaleString()} Gems (~${usdEquiv})</p>
      <button
        type="button"
        disabled={pending || gems < minGems}
        onClick={() =>
          startTransition(async () => {
            const r = await requestGemWithdrawal(minGems);
            if (r.error) toast.error(r.error);
            else toast.success(r.ok ?? "Withdrawal requested");
          })
        }
        className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        Request ${(minGems / 100).toFixed(2)} withdrawal
      </button>
    </section>
  );
}

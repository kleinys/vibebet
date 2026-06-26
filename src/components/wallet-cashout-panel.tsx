"use client";

import Link from "next/link";

export function WalletCashoutPanel({
  gems,
  minGems,
}: {
  gems: number;
  minGems: number;
}) {
  const usdEquiv = (gems / 100).toFixed(2);

  return (
    <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
      <h2 className="text-sm font-semibold text-amber-100">
        Cash out Gems to real money (planned — not available)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">
          You cannot exchange Gems back into USD, EUR, GBP, yen, or any other
          currency yet.
        </strong>{" "}
        Vibebet is in early beta and we don&apos;t have enough players signed up
        to offer regulated withdrawals. That&apos;s intentional — cash-out needs a
        bigger community plus identity checks, payout partners, and legal
        licensing in each country.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        <strong className="font-medium text-zinc-300">Important:</strong>{" "}
        <span className="text-amber-200/90">VIBE ◉</span> is play money only and{" "}
        <strong className="font-medium text-zinc-300">will never</strong> convert
        to cash. If cash-out ever launches, it would only apply to{" "}
        <span className="text-fuchsia-300/90">Gems ◆</span> you bought in the Shop.
      </p>
      <p className="mt-3 text-sm text-zinc-400">
        What works today:{" "}
        <strong className="font-medium text-zinc-300">cash → Gems</strong> in the{" "}
        <Link href="/shop" className="text-fuchsia-400 hover:underline">
          Shop
        </Link>
        , spend Gems on cosmetics, or optionally convert Gems → VIBE (one-way)
        below.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Your Gems: {gems.toLocaleString()} (reference ~${usdEquiv} at 100 Gems =
        $1 — not redeemable yet). If we launch payouts later, we may require at
        least {minGems} Gems per withdrawal.
      </p>
    </section>
  );
}

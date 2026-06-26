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
      <h2 className="text-sm font-semibold text-amber-100">Cash out to USD (not yet)</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Vibebet is still in early beta with a small community.{" "}
        <strong className="font-medium text-zinc-300">
          You cannot exchange Gems back into real money yet
        </strong>{" "}
        — we need more players signed up, plus identity verification, payment
        partners, and legal licensing before withdrawals can go live.
      </p>
      <p className="mt-2 text-sm text-zinc-400">
        What works today:{" "}
        <strong className="font-medium text-zinc-300">USD → Gems</strong> in the{" "}
        <Link href="/shop" className="text-fuchsia-400 hover:underline">
          Shop
        </Link>
        , then spend Gems on cosmetics or optionally convert Gems → VIBE (one-way)
        below. VIBE is never sold for cash.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Your Gems: {gems.toLocaleString()} (display reference ~${usdEquiv} at 100
        Gems = $1 — not redeemable yet). Planned minimum withdrawal: {minGems}{" "}
        Gems when we launch.
      </p>
    </section>
  );
}

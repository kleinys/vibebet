import Link from "next/link";

/** Shared copy — how money flows in Vibebet today (early beta). */
export function CurrencyModelNote({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-zinc-500">
        Real money → Gems only (Shop). Optional Gems → VIBE (one-way). No cash
        withdrawals yet —{" "}
        <Link href="/account#wallet" className="text-fuchsia-400 hover:underline">
          Wallet
        </Link>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/30 p-4 text-xs text-zinc-500">
      <p className="font-medium text-zinc-300">How payments work (early beta)</p>
      <ul className="mt-2 list-inside list-disc space-y-1.5">
        <li>
          <span className="text-zinc-400">Real money → Gems</span> — buy Gem
          bundles in the Shop (Stripe). This is the only way to spend USD on
          Vibebet today.
        </li>
        <li>
          <span className="text-zinc-400">Gems → cosmetics</span> — skins,
          badges, streak shields in the Shop.
        </li>
        <li>
          <span className="text-zinc-400">Gems → VIBE</span> (optional, one-way)
          — convert premium Gems into play-money VIBE for betting when enabled in
          Wallet. Cannot convert back.
        </li>
        <li>
          <span className="text-zinc-400">VIBE</span> — earned free from signup,
          wins, quests, and battle pass. Used for all markets and duels.{" "}
          <strong className="font-medium text-zinc-400">
            Not sold for cash and not withdrawable.
          </strong>
        </li>
        <li>
          <span className="text-zinc-400">Gems → real money</span> —{" "}
          <strong className="font-medium text-amber-200/90">not available yet</strong>.
          Cash-out needs more users, payment partners, identity checks, and legal
          licensing. We&apos;re play-money first while the community grows.
        </li>
      </ul>
      <p className="mt-3 text-[11px] text-zinc-600">
        No peer-to-peer transfers · VIBE cannot be bought directly with USD
      </p>
    </div>
  );
}

import Link from "next/link";

/** Shared copy — how money flows in Vibebet today (early beta). */
export function CurrencyModelNote({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-zinc-500">
        Real money → Gems only (Shop). Optional Gems → VIBE (one-way). Gem cash-out
        to USD/EUR/etc. planned later — not enough users yet.{" "}
        <Link href="/account#wallet" className="text-fuchsia-400 hover:underline">
          Wallet
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/5 bg-zinc-900/30 p-4 text-xs text-zinc-500">
        <p className="font-medium text-zinc-300">How payments work today</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>
            <span className="text-zinc-400">Real money → Gems</span> — buy Gem
            bundles in the Shop (Stripe, USD pricing today). This is the{" "}
            <strong className="font-medium text-zinc-400">only</strong> way to
            spend cash on Vibebet right now.
          </li>
          <li>
            <span className="text-zinc-400">Gems → cosmetics</span> — skins,
            badges, streak shields in the Shop.
          </li>
          <li>
            <span className="text-zinc-400">Gems → VIBE</span> (optional, one-way)
            — convert Gems into play-money VIBE for betting when enabled in Wallet.
            Cannot convert back.
          </li>
          <li>
            <span className="text-zinc-400">VIBE ◉</span> — free play currency
            (signup, wins, quests). Used for all markets and duels.{" "}
            <strong className="font-medium text-zinc-400">
              Never sold for cash and never withdrawable — by design.
            </strong>
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-zinc-500">
        <p className="font-medium text-violet-200">What we&apos;re planning (not live yet)</p>
        <p className="mt-2 leading-relaxed text-zinc-400">
          We want Gem holders to cash out to real currency one day —{" "}
          <strong className="font-medium text-zinc-300">
            USD, EUR, GBP, JPY
          </strong>
          , and other major fiat — but{" "}
          <strong className="font-medium text-amber-200/90">
            not while the community is this small
          </strong>
          . There aren&apos;t enough people signed up yet to run regulated
          withdrawals safely. Before that can happen we still need:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>A larger active player base</li>
          <li>Identity verification (KYC) and anti-fraud checks</li>
          <li>Licensed payment / payout partners</li>
          <li>Legal review in each region we support</li>
        </ul>
        <p className="mt-3 leading-relaxed text-zinc-500">
          <strong className="font-medium text-zinc-400">VIBE will stay play-money only.</strong>{" "}
          Even when cash-out launches, it would apply to{" "}
          <span className="text-zinc-400">Gems ◆</span> — not VIBE. You cannot
          exchange VIBE coins into dollars, euros, pounds, or yen.
        </p>
        <p className="mt-2 text-[11px] text-zinc-600">
          Nothing here is a promise or financial offer — timelines depend on
          growth and regulation.
        </p>
      </div>

      <p className="text-[11px] text-zinc-600">
        No peer-to-peer transfers · No VIBE → cash · No USD → VIBE direct purchase
      </p>
    </div>
  );
}

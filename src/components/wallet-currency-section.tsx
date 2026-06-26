import Link from "next/link";
import { getAllBalances } from "@/lib/ledger";
import { isEnabled } from "@/lib/feature-flags";
import { BalanceBadge } from "@/components/balance-badge";
import { WalletCashoutPanel } from "@/components/wallet-cashout-panel";
import { WalletGemConvertPanel } from "@/components/wallet-gem-convert-panel";
import { CurrencyModelNote } from "@/components/currency-model-note";

const MIN_CASHOUT_GEMS = 500;

export async function WalletCurrencySection({ userId }: { userId: string }) {
  const [balances, convertOn, shopOn] = await Promise.all([
    getAllBalances(userId),
    isEnabled("gem_to_vibe_conversion_enabled"),
    isEnabled("shop_enabled"),
  ]);

  return (
    <section id="wallet" className="mt-8 scroll-mt-24 space-y-6">
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Your wallet</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tap ◉ or ◆ in the header anytime to jump here.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <BalanceBadge currency="vibe" amount={balances.vibe} />
            <p className="mt-2 max-w-xs text-xs text-zinc-500">
              Play money for bets and duels. Earned from wins, quests, and battle pass.{" "}
              <span className="text-zinc-400">Not sold for USD · not withdrawable.</span>
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <BalanceBadge currency="gem" amount={balances.gem} />
            <p className="mt-2 max-w-xs text-zinc-500">
              Premium currency from the Shop (real money → Gems). Spend on cosmetics.{" "}
              <span className="text-zinc-400">
                Cash-out to USD not available yet while we&apos;re in early beta.
              </span>
            </p>
          </div>
        </div>
        {shopOn && (
          <Link
            href="/shop"
            className="mt-4 inline-block text-sm text-fuchsia-400 hover:underline"
          >
            Buy Gem bundles →
          </Link>
        )}
      </div>

      <WalletCashoutPanel gems={balances.gem} minGems={MIN_CASHOUT_GEMS} />

      <WalletGemConvertPanel gems={balances.gem} conversionEnabled={convertOn} />

      <CurrencyModelNote />
    </section>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllBalances } from "@/lib/ledger";
import { isEnabled } from "@/lib/feature-flags";
import { BalanceBadge } from "@/components/balance-badge";
import { WalletCashoutPanel } from "@/components/wallet-cashout-panel";
import { WalletGemConvertPanel } from "@/components/wallet-gem-convert-panel";

const MIN_CASHOUT_GEMS = 500;

export async function WalletCurrencySection({ userId }: { userId: string }) {
  const [balances, cashoutOn, convertOn, shopOn] = await Promise.all([
    getAllBalances(userId),
    isEnabled("gems_cashout_enabled"),
    isEnabled("gem_to_vibe_conversion_enabled"),
    isEnabled("shop_enabled"),
  ]);

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Your balances</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <BalanceBadge currency="vibe" amount={balances.vibe} />
            <p className="mt-2 max-w-xs text-xs text-zinc-500">
              Play money for bets and duels. Earned from wins, quests, and battle pass.{" "}
              <span className="text-zinc-400">Not withdrawable.</span>
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
            <BalanceBadge currency="gem" amount={balances.gem} />
            <p className="mt-2 max-w-xs text-xs text-zinc-500">
              Premium currency from the shop. Spend on cosmetics.{" "}
              {cashoutOn ? (
                <span className="text-emerald-400">Withdrawable when verified.</span>
              ) : (
                <span className="text-zinc-400">No cash value while in beta.</span>
              )}
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

      <WalletCashoutPanel gems={balances.gem} cashoutEnabled={cashoutOn} minGems={MIN_CASHOUT_GEMS} />

      <WalletGemConvertPanel gems={balances.gem} conversionEnabled={convertOn} />

      <div className="rounded-xl border border-white/5 p-4 text-xs text-zinc-500">
        <p className="font-medium text-zinc-400">How the two-currency model works</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>VIBE — free/play currency for all betting and ranked duels</li>
          <li>Gems — purchased with real money; cosmetics today, optional cashout when licensed</li>
          <li>Optional: convert Gems → VIBE at 10:1 (one-way, when enabled in admin)</li>
          <li>No peer-to-peer transfers · No VIBE → cash conversion</li>
        </ul>
      </div>
    </section>
  );
}

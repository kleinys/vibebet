import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllBalances } from "@/lib/ledger";
import { isEnabled } from "@/lib/feature-flags";
import { isProUser } from "@/lib/battle-pass";
import { BundleCard } from "@/components/bundle-card";
import { ShopItemCard } from "@/components/shop-item-card";
import { BalanceBadge } from "@/components/balance-badge";
import { ProCheckoutButton } from "@/components/pro-checkout-button";
import { CurrencyModelNote } from "@/components/currency-model-note";
import { getStreakInfo } from "@/lib/streaks";

export const revalidate = 0;

export default async function ShopPage() {
  const enabled = await isEnabled("shop_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Shop is off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The <code className="font-mono">shop_enabled</code> flag is currently
          disabled.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const proEnabled = await isEnabled("pro_subscription_enabled");

  const [{ data: bundles }, { data: items }, balances, inventoryRows, isPro, streakInfo] =
    await Promise.all([
      supabase
        .from("gem_bundles")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("shop_items")
        .select("*")
        .eq("is_active", true)
        .order("price_gems", { ascending: true }),
      user
        ? getAllBalances(user.id)
        : Promise.resolve({ vibe: 0, gem: 0 } as const),
      user
        ? supabase
            .from("user_inventory")
            .select("id, item_id, is_equipped")
            .eq("user_id", user.id)
            .then((r) => r.data ?? [])
        : Promise.resolve([]),
      user ? isProUser(user.id) : Promise.resolve(false),
      user
        ? getStreakInfo(user.id)
        : Promise.resolve({ streakShields: 0 } as Awaited<ReturnType<typeof getStreakInfo>>),
    ]);

  const ownedItems = new Set(inventoryRows.map((x) => x.item_id));
  const inventoryByItem = new Map(
    inventoryRows.map((row) => [row.item_id, row]),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shop</h1>
          <p className="mt-1 text-sm text-zinc-400">
            The only way to spend real money on Vibebet: buy Gems here (USD
            pricing today). Spend on cosmetics or convert to VIBE in your wallet.
            Cash-out to USD/EUR/GBP/etc. is planned for later — not enough users
            yet. VIBE never converts to cash.
          </p>
        </div>
        {user && (
          <div className="flex gap-2">
            <BalanceBadge currency="vibe" amount={balances.vibe} href="/account#wallet" />
            <BalanceBadge currency="gem" amount={balances.gem} href="/account#wallet" />
          </div>
        )}
      </header>

      {proEnabled && (
        <section className="mt-8 rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-violet-100">
                Vibebet Pro
              </h2>
              <p className="mt-1 text-sm text-violet-200/80">
                Pro badge, higher market-creation limits, early features. Does
                not affect VIBE betting odds.
              </p>
              {isPro && (
                <span className="mt-2 inline-block text-xs text-emerald-300">
                  ✓ Active on your account
                </span>
              )}
            </div>
            {!isPro && <ProCheckoutButton signedIn={!!user} />}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Battle Pass
          </h2>
          <Link href="/battle-pass" className="text-xs text-fuchsia-400 hover:underline">
            View season →
          </Link>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Earn XP from daily login and trades. Claim free VIBE rewards each tier.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Gem bundles
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Purchases are final. Gems cannot be cashed out during early beta.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(bundles ?? []).map((b) => (
            <BundleCard
              key={b.id}
              slug={b.slug}
              name={b.name}
              gems={b.gems}
              priceUsdCents={b.price_usd_cents}
              signedIn={!!user}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Items
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(items ?? []).map((it) => {
            const inv = inventoryByItem.get(it.id);
            return (
            <ShopItemCard
              key={it.id}
              id={it.id}
              slug={it.slug}
              name={it.name}
              description={it.description}
              kind={it.kind}
              rarity={it.rarity}
              priceGems={it.price_gems}
              owned={ownedItems.has(it.id)}
              inventoryId={inv?.id}
              isEquipped={inv?.is_equipped ?? false}
              affordable={balances.gem >= it.price_gems}
              signedIn={!!user}
              streakShields={streakInfo.streakShields}
            />
            );
          })}
        </div>
      </section>

      <div className="mt-10">
        <CurrencyModelNote />
      </div>
    </div>
  );
}

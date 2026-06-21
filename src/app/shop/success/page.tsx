import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAllBalances } from "@/lib/ledger";
import { BalanceBadge } from "@/components/balance-badge";

export const revalidate = 0;

/**
 * Stripe redirects here after a successful Checkout. The Gems are credited
 * by the webhook (independently — webhook may fire before or after this page
 * loads). Show the current balance and let the user navigate onward.
 *
 * We DO NOT credit gems here. The webhook is the source of truth.
 */
export default async function ShopSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const balances = user
    ? await getAllBalances(user.id)
    : { vibe: 0, gem: 0 };

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="text-4xl">◆</div>
      <h1 className="mt-4 text-2xl font-semibold">Thanks for the purchase</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Your Gems should appear within a few seconds. Refresh if you don&apos;t
        see them yet.
      </p>
      {user && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <BalanceBadge currency="vibe" amount={balances.vibe} />
          <BalanceBadge currency="gem" amount={balances.gem} />
        </div>
      )}
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/shop"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20"
        >
          Back to shop
        </Link>
        <Link
          href="/markets"
          className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400"
        >
          Go bet
        </Link>
      </div>
    </div>
  );
}

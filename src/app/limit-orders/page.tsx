import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getMyLimitOrders } from "@/lib/limit-orders";
import { LimitOrderList } from "@/components/limit-order-panel";

export const revalidate = 0;

export default async function LimitOrdersPage() {
  const enabled = await isEnabled("limit_orders_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Limit orders off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">limit_orders_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/limit-orders");

  const orders = await getMyLimitOrders(40);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/guide" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Playbook
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Limit Orders</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Escrowed buy orders that auto-fill when odds reach your target price.
        Place new ones from any open market page.
      </p>

      <LimitOrderList orders={orders} />

      <p className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/markets" className="text-sky-400 hover:underline">
          Browse markets →
        </Link>
      </p>
    </div>
  );
}

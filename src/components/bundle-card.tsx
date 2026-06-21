"use client";

import { useActionState } from "react";
import Link from "next/link";
import { startCheckout, type ShopState } from "@/app/shop/actions";
import { formatVibe } from "@/lib/utils";

interface Props {
  slug: string;
  name: string;
  gems: number;
  priceUsdCents: number;
  signedIn: boolean;
}

export function BundleCard({
  slug,
  name,
  gems,
  priceUsdCents,
  signedIn,
}: Props) {
  const [state, action, pending] = useActionState<ShopState, FormData>(
    startCheckout,
    null,
  );
  const price = (priceUsdCents / 100).toFixed(2);

  return (
    <form
      action={action}
      className="rounded-xl border border-fuchsia-500/20 bg-zinc-900/60 p-4 transition hover:border-fuchsia-500/40"
    >
      <input type="hidden" name="bundleSlug" value={slug} />
      <div className="text-xs uppercase tracking-wider text-zinc-500">{name}</div>
      <div className="mt-2 flex items-baseline gap-1.5 text-fuchsia-300">
        <span className="text-base">◆</span>
        <span className="text-2xl font-semibold tabular-nums">
          {formatVibe(gems)}
        </span>
        <span className="text-xs text-zinc-400">Gems</span>
      </div>
      <div className="mt-3 text-sm text-zinc-300 tabular-nums">${price}</div>
      {state?.error && (
        <p className="mt-2 text-xs text-red-300">{state.error}</p>
      )}
      {signedIn ? (
        <button
          type="submit"
          disabled={pending}
          className="mt-3 w-full rounded-md bg-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {pending ? "Loading..." : "Buy"}
        </button>
      ) : (
        <Link
          href="/login?next=/shop"
          className="mt-3 block rounded-md border border-white/10 px-3 py-1.5 text-center text-sm text-zinc-300 hover:border-white/20"
        >
          Sign in to buy
        </Link>
      )}
    </form>
  );
}

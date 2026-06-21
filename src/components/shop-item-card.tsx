"use client";

import { useActionState } from "react";
import Link from "next/link";
import { buyItem, type ShopState } from "@/app/shop/actions";
import { formatVibe } from "@/lib/utils";
import type { ItemKind, Rarity } from "@/lib/supabase/types";
import { ShopEquipButton } from "@/components/shop-equip-button";

const RARITY_STYLES: Record<Rarity, { border: string; text: string }> = {
  common: { border: "border-zinc-700/50", text: "text-zinc-300" },
  rare: { border: "border-blue-500/30", text: "text-blue-300" },
  epic: { border: "border-fuchsia-500/30", text: "text-fuchsia-300" },
  legendary: { border: "border-amber-500/40", text: "text-amber-300" },
};

interface Props {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: ItemKind;
  rarity: Rarity;
  priceGems: number;
  owned: boolean;
  inventoryId?: string;
  isEquipped?: boolean;
  affordable: boolean;
  signedIn: boolean;
}

export function ShopItemCard({
  id,
  slug,
  name,
  description,
  kind,
  rarity,
  priceGems,
  owned,
  inventoryId,
  isEquipped = false,
  affordable,
  signedIn,
}: Props) {
  const [state, action, pending] = useActionState<ShopState, FormData>(
    buyItem,
    null,
  );
  const style = RARITY_STYLES[rarity];

  return (
    <form
      action={action}
      className={`rounded-xl border ${style.border} bg-zinc-900/50 p-4`}
    >
      <input type="hidden" name="itemId" value={id} />
      <div className="flex items-baseline justify-between">
        <span className={`text-xs uppercase tracking-wider ${style.text}`}>
          {rarity}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          {kind}
        </span>
      </div>
      <div className="mt-1 text-base font-medium text-zinc-100">{name}</div>
      {description && (
        <p className="mt-1 text-xs text-zinc-400">{description}</p>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-sm text-fuchsia-300">
        <span>◆</span>
        <span className="tabular-nums">{formatVibe(priceGems)}</span>
      </div>
      {state?.error && (
        <p className="mt-2 text-xs text-red-300">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-2 text-xs text-emerald-300">{state.ok}</p>
      )}
      {owned ? (
        kind === "skin" && inventoryId ? (
          <ShopEquipButton
            inventoryId={inventoryId}
            slug={slug}
            isEquipped={isEquipped}
          />
        ) : (
        <button
          type="button"
          disabled
          className="mt-3 w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300"
        >
          Owned
        </button>
        )
      ) : !signedIn ? (
        <Link
          href="/login?next=/shop"
          className="mt-3 block rounded-md border border-white/10 px-3 py-1.5 text-center text-sm text-zinc-300 hover:border-white/20"
        >
          Sign in
        </Link>
      ) : (
        <button
          type="submit"
          disabled={pending || !affordable}
          title={!affordable ? "Not enough Gems" : undefined}
          className="mt-3 w-full rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40"
        >
          {pending ? "Buying..." : !affordable ? "Need more Gems" : "Buy"}
        </button>
      )}
    </form>
  );
}

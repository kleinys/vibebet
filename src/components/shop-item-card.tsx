"use client";

import { useActionState } from "react";
import Link from "next/link";
import { buyItem, buyVibeItem, type ShopState } from "@/app/shop/actions";
import { formatVibe } from "@/lib/utils";
import { previewSlugForItem } from "@/lib/cosmetic-styles";
import type { ItemKind, Rarity } from "@/lib/supabase/types";
import { ShopEquipButton } from "@/components/shop-equip-button";
import { UserAvatar } from "@/components/user-avatar";
import { CurrencyIconVibe } from "@/components/fantasy-icons";

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
  priceVibe: number;
  owned: boolean;
  inventoryId?: string;
  isEquipped?: boolean;
  affordableGems: boolean;
  affordableVibe: boolean;
  signedIn: boolean;
  streakShields?: number;
}

export function ShopItemCard({
  id,
  slug,
  name,
  description,
  kind,
  rarity,
  priceGems,
  priceVibe,
  owned,
  inventoryId,
  isEquipped = false,
  affordableGems,
  affordableVibe,
  signedIn,
  streakShields = 0,
}: Props) {
  const useVibe = priceVibe > 0;
  const [state, action, pending] = useActionState<ShopState, FormData>(
    useVibe ? buyVibeItem : buyItem,
    null,
  );
  const style = RARITY_STYLES[rarity];
  const preview = previewSlugForItem(kind, slug);
  const canEquip = kind === "skin" || kind === "badge";
  const isConsumableShield = kind === "shield";
  const affordable = useVibe ? affordableVibe : affordableGems;

  return (
    <form
      action={action}
      className={`rounded-xl border ${style.border} bg-zinc-900/50 p-4`}
    >
      <input type="hidden" name="itemId" value={id} />
      <div className="flex items-start gap-3">
        <UserAvatar
          slug={preview.skinSlug}
          badgeSlug={preview.badgeSlug}
          shieldPreview={kind === "shield"}
          size="md"
          title={name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
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
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-sm">
        {useVibe ? (
          <>
            <CurrencyIconVibe className="h-4 w-4 text-amber-300" />
            <span className="tabular-nums text-amber-200">{formatVibe(priceVibe)} VIBE</span>
          </>
        ) : (
          <>
            <span className="text-fuchsia-300">◆</span>
            <span className="tabular-nums text-fuchsia-300">{formatVibe(priceGems)}</span>
          </>
        )}
        {!useVibe && priceGems === 0 && (
          <span className="text-xs text-emerald-300">Free</span>
        )}
      </div>
      {isConsumableShield && streakShields > 0 && (
        <p className="mt-2 text-xs text-emerald-300">
          You have {streakShields} shield{streakShields === 1 ? "" : "s"} ready
        </p>
      )}
      {state?.error && (
        <p className="mt-2 text-xs text-red-300">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-2 text-xs text-emerald-300">{state.ok}</p>
      )}
      {owned && !isConsumableShield ? (
        canEquip && inventoryId ? (
          <ShopEquipButton
            inventoryId={inventoryId}
            slug={slug.replace(/--(animal|phenomenon)$/, "")}
            kind={kind === "skin" ? "skin" : "badge"}
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
      ) : owned && isConsumableShield ? (
        <button
          type="submit"
          disabled={pending || !affordable}
          title={!affordable ? "Not enough currency" : undefined}
          className="mt-3 w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
        >
          {pending ? "Buying..." : !affordable ? "Need more" : "Buy another"}
        </button>
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
          disabled={pending || !affordable || (useVibe ? priceVibe === 0 : priceGems === 0 && kind !== "shield")}
          title={!affordable ? `Not enough ${useVibe ? "VIBE" : "Gems"}` : undefined}
          className="mt-3 w-full rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40"
        >
          {pending
            ? "Buying..."
            : !affordable
              ? `Need more ${useVibe ? "VIBE" : "Gems"}`
              : useVibe
                ? `Buy · ${formatVibe(priceVibe)} VIBE`
                : priceGems === 0
                  ? "Claim free"
                  : "Buy"}
        </button>
      )}
    </form>
  );
}

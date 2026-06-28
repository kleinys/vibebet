"use client";

import { useActionState } from "react";
import { setEquipped, type ShopState } from "@/app/shop/actions";
import { previewSlugForItem } from "@/lib/cosmetic-styles";
import type { ItemKind, Rarity } from "@/lib/supabase/types";
import { UserAvatar } from "@/components/user-avatar";

const RARITY_STYLES: Record<Rarity, { border: string; text: string }> = {
  common: { border: "border-zinc-700/50", text: "text-zinc-300" },
  rare: { border: "border-blue-500/30", text: "text-blue-300" },
  epic: { border: "border-fuchsia-500/30", text: "text-fuchsia-300" },
  legendary: { border: "border-amber-500/40", text: "text-amber-300" },
};

export function InventoryItemCard({
  inventoryId,
  slug,
  name,
  kind,
  rarity,
  isEquipped,
}: {
  inventoryId: string;
  slug: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  isEquipped: boolean;
}) {
  const [state, action, pending] = useActionState<ShopState, FormData>(
    setEquipped,
    null,
  );
  const style = RARITY_STYLES[rarity];
  const preview = previewSlugForItem(kind, slug);
  const canEquip = kind === "skin" || kind === "badge";

  return (
    <li
      className={`rounded-lg border ${style.border} bg-zinc-900/40 p-3`}
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          slug={preview.skinSlug}
          badgeSlug={preview.badgeSlug}
          shieldPreview={kind === "shield"}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] uppercase tracking-wider ${style.text}`}>
            {kind} · {rarity}
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-100">{name}</div>
          {kind === "shield" && (
            <p className="mt-1 text-xs text-zinc-500">
              Consumed automatically when you miss a day.
            </p>
          )}
          {isEquipped && (
            <span className="mt-2 inline-block text-[10px] uppercase tracking-wider text-emerald-300">
              Equipped
            </span>
          )}
        </div>
      </div>
      {canEquip && (
        <form action={action} className="mt-3">
          <input type="hidden" name="inventoryId" value={inventoryId} />
          <input
            type="hidden"
            name="equip"
            value={isEquipped ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:border-white/20 disabled:opacity-50"
          >
            {pending ? "Saving..." : isEquipped ? "Unequip" : "Equip"}
          </button>
          {state?.error && (
            <p className="mt-1 text-xs text-red-300">{state.error}</p>
          )}
        </form>
      )}
    </li>
  );
}

"use client";

import { useActionState } from "react";
import { setEquipped, type ShopState } from "@/app/shop/actions";
import { previewSlugForItem } from "@/lib/cosmetic-styles";
import type { ItemKind } from "@/lib/supabase/types";
import { UserAvatar } from "@/components/user-avatar";

export function ShopEquipButton({
  inventoryId,
  slug,
  kind,
  isEquipped,
}: {
  inventoryId: string;
  slug: string;
  kind: ItemKind;
  isEquipped: boolean;
}) {
  const [state, action, pending] = useActionState<ShopState, FormData>(
    setEquipped,
    null,
  );
  const preview = previewSlugForItem(kind, slug);

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="inventoryId" value={inventoryId} />
      <input type="hidden" name="equip" value={isEquipped ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/20 disabled:opacity-50"
      >
        <UserAvatar
          slug={preview.skinSlug}
          badgeSlug={preview.badgeSlug}
          size="sm"
        />
        {pending ? "Saving..." : isEquipped ? "Unequip" : "Equip"}
      </button>
      {state?.error && (
        <p className="mt-2 text-xs text-red-300">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-2 text-xs text-emerald-300">{state.ok}</p>
      )}
    </form>
  );
}

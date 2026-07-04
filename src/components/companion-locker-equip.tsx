"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setEquipped, type ShopState } from "@/app/shop/actions";
import type { ItemKind, Rarity } from "@/lib/supabase/types";

export interface LockerEquipItem {
  inventoryId: string;
  slug: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  isEquipped: boolean;
  owned?: boolean;
  priceGems?: number;
}

function LockerEquipPill({
  item,
  tone,
}: {
  item: LockerEquipItem;
  tone: "skin" | "badge";
}) {
  const [state, action, pending] = useActionState<ShopState, FormData>(
    setEquipped,
    null,
  );

  const active = item.isEquipped;
  const owned = item.owned !== false;

  if (!owned) {
    return (
      <Link
        href="/shop"
        title={`Get ${item.name} in the shop`}
        className="rounded-full border border-dashed border-white/15 bg-zinc-950/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:border-fuchsia-400/30 hover:text-zinc-300"
      >
        {item.name}
        {item.priceGems != null && item.priceGems > 0 ? ` · ${item.priceGems}💎` : ""}
      </Link>
    );
  }

  const base =
    tone === "skin"
      ? active
        ? "border-fuchsia-400/50 bg-fuchsia-500/25 text-fuchsia-100 shadow-sm shadow-fuchsia-900/40"
        : "border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-fuchsia-400/35 hover:bg-fuchsia-500/10"
      : active
        ? "border-amber-400/50 bg-amber-500/20 text-amber-100 shadow-sm shadow-amber-900/30"
        : "border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-amber-400/35 hover:bg-amber-500/10";

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="inventoryId" value={item.inventoryId} />
      <input type="hidden" name="equip" value={active ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        title={active ? `Unequip ${item.name}` : `Equip ${item.name}`}
        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition disabled:opacity-50 ${base}`}
      >
        {pending ? "…" : item.name}
        {active ? " · on" : ""}
      </button>
      {state?.error && (
        <span className="sr-only" aria-live="polite">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function CompanionLockerEquip({
  skins,
  badges,
}: {
  skins: LockerEquipItem[];
  badges: LockerEquipItem[];
}) {
  if (skins.length === 0 && badges.length === 0) return null;

  return (
    <div className="relative z-10 flex flex-col items-center gap-2 px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
      {skins.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {skins.map((item) => (
            <LockerEquipPill key={item.inventoryId} item={item} tone="skin" />
          ))}
        </div>
      )}
      {badges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {badges.map((item) => (
            <LockerEquipPill key={item.inventoryId} item={item} tone="badge" />
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-500">
        Tap a trainer skin or badge to equip · animal pairs with your skin
      </p>
    </div>
  );
}

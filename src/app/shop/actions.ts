"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";

const BundleSchema = z.object({ bundleSlug: z.string().min(1).max(64) });
const ItemSchema = z.object({ itemId: z.string().uuid() });

export type ShopState = { error?: string; ok?: string } | null;

/**
 * Start Stripe Checkout for a Gem bundle. Redirects to the Stripe-hosted page;
 * on success Stripe sends `checkout.session.completed` to our webhook, which
 * credits the user's Gem wallet through the ledger.
 */
export async function startCheckout(
  _prev: ShopState,
  formData: FormData,
): Promise<ShopState> {
  const parsed = BundleSchema.safeParse({
    bundleSlug: formData.get("bundleSlug"),
  });
  if (!parsed.success) return { error: "Invalid bundle." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/shop");
  }

  const { data: bundle, error: bundleErr } = await supabase
    .from("gem_bundles")
    .select("slug, name, gems, price_usd_cents, is_active")
    .eq("slug", parsed.data.bundleSlug)
    .maybeSingle();
  if (bundleErr || !bundle || !bundle.is_active) {
    return { error: "Bundle not available." };
  }

  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) {
    return {
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env.local to enable checkout.",
    };
  }

  let url: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: bundle.price_usd_cents,
            product_data: {
              name: `Vibebet — ${bundle.name}`,
              description: `${bundle.gems.toLocaleString()} Gems`,
            },
          },
        },
      ],
      // Metadata flows to both Session and the underlying PaymentIntent so
      // either webhook event can attribute it.
      metadata: {
        user_id: user.id,
        bundle_slug: bundle.slug,
        gem_amount: String(bundle.gems),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          bundle_slug: bundle.slug,
          gem_amount: String(bundle.gems),
        },
      },
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/shop`,
      // We don't have customer accounts on Stripe yet; let it collect email.
      customer_email: user.email ?? undefined,
    });
    url = session.url;
  } catch (err) {
    return {
      error: `Stripe error: ${(err as Error).message}`,
    };
  }

  if (!url) return { error: "Stripe did not return a checkout URL." };
  redirect(url);
}

/**
 * Spend Gems on a virtual item. Calls the SECURITY DEFINER RPC which:
 *   - checks the user's gem balance,
 *   - posts a balanced ledger transaction,
 *   - adds the item to inventory.
 */
export async function buyItem(
  _prev: ShopState,
  formData: FormData,
): Promise<ShopState> {
  const parsed = ItemSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) return { error: "Invalid item." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("spend_gems_for_item", {
    p_item_id: parsed.data.itemId,
  });
  if (error) return { error: error.message };

  revalidatePath("/shop");
  revalidatePath("/account");
  revalidatePath("/");
  return { ok: "Item added to your inventory." };
}

/**
 * Equip / unequip a skin or badge. Only one item per kind can be equipped.
 */
export async function setEquipped(
  _prev: ShopState,
  formData: FormData,
): Promise<ShopState> {
  const inventoryId = z.string().uuid().safeParse(formData.get("inventoryId"));
  const equip = z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .safeParse(formData.get("equip"));
  if (!inventoryId.success || !equip.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: target } = await supabase
    .from("user_inventory")
    .select("id, shop_items (kind)")
    .eq("id", inventoryId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!target?.shop_items) return { error: "Item not found." };
  const item = Array.isArray(target.shop_items)
    ? target.shop_items[0]
    : target.shop_items;
  const kind = item?.kind;
  if (kind !== "skin" && kind !== "badge") {
    return { error: "Only skins and badges can be equipped." };
  }

  if (equip.data) {
    const { data: owned } = await supabase
      .from("user_inventory")
      .select("id, shop_items!inner (kind)")
      .eq("user_id", user.id)
      .eq("shop_items.kind", kind);

    const idsToClear = (owned ?? [])
      .map((row) => row.id)
      .filter((id) => id !== inventoryId.data);

    if (idsToClear.length > 0) {
      await supabase
        .from("user_inventory")
        .update({ is_equipped: false })
        .eq("user_id", user.id)
        .in("id", idsToClear);
    }
  }

  const { error } = await supabase
    .from("user_inventory")
    .update({ is_equipped: equip.data })
    .eq("id", inventoryId.data)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/account");
  revalidatePath("/account/profile");
  revalidatePath("/shop");
  revalidatePath("/leaderboard");
  revalidatePath("/");
  return { ok: equip.data ? "Equipped." : "Unequipped." };
}

/** Stripe subscription checkout for Vibebet Pro ($4.99/mo). */
export async function startProCheckout(): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/shop");

  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) {
    return { error: "Stripe is not configured." };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 499,
          recurring: { interval: "month" },
          product_data: {
            name: "Vibebet Pro",
            description: "Pro badge, higher limits, early features",
          },
        },
      },
    ],
    metadata: { user_id: user.id, product: "pro" },
    subscription_data: {
      metadata: { user_id: user.id, product: "pro" },
    },
    success_url: `${env.NEXT_PUBLIC_SITE_URL}/shop/success?pro=1`,
    cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/shop`,
  });

  if (!session.url) return { error: "Could not start checkout." };
  redirect(session.url);
}

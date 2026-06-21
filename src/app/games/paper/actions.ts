"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";

export type PaperDuelActionState = { error?: string; ok?: string } | null;

const CreateSchema = z.object({
  asset: z.enum(["btc", "eth", "sol"]),
  durationSec: z.coerce.number().int().refine((n) => [300, 600, 900].includes(n)),
  stake: z.coerce.number().int().min(10).max(100_000),
});

const AcceptSchema = z.object({
  duelId: z.string().uuid(),
  asset: z.enum(["btc", "eth", "sol"]),
});

function pricesPayload() {
  return fetchCryptoSpotPrices().then((rows) =>
    rows.map((p) => ({ asset: p.asset, price: p.price })),
  );
}

export async function createPaperDuel(
  _prev: PaperDuelActionState,
  formData: FormData,
): Promise<PaperDuelActionState> {
  const parsed = CreateSchema.safeParse({
    asset: formData.get("asset"),
    durationSec: formData.get("durationSec"),
    stake: formData.get("stake"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/paper");

  const { data, error } = await supabase.rpc("create_paper_duel", {
    p_creator_asset: parsed.data.asset,
    p_duration_sec: parsed.data.durationSec,
    p_stake: parsed.data.stake,
  });
  if (error) return { error: error.message };

  const duelId = String(data);
  revalidatePath("/games");
  revalidatePath("/games/paper");
  revalidatePath("/games/create");
  redirect(`/games/paper/${duelId}`);
}

export async function acceptPaperDuel(
  _prev: PaperDuelActionState,
  formData: FormData,
): Promise<PaperDuelActionState> {
  const parsed = AcceptSchema.safeParse({
    duelId: formData.get("duelId"),
    asset: formData.get("asset"),
  });
  if (!parsed.success) return { error: "Invalid duel or asset." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/paper");

  const startPrices = await pricesPayload();
  const { error } = await supabase.rpc("accept_paper_duel", {
    p_duel_id: parsed.data.duelId,
    p_opponent_asset: parsed.data.asset,
    p_start_prices: startPrices,
  });
  if (error) return { error: error.message };

  revalidatePath("/games");
  revalidatePath("/games/paper");
  revalidatePath(`/games/paper/${parsed.data.duelId}`);
  return { ok: "Race started! Highest return at the bell wins." };
}

export async function cancelPaperDuel(duelId: string): Promise<PaperDuelActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/paper");

  const { error } = await supabase.rpc("cancel_paper_duel", {
    p_duel_id: duelId,
  });
  if (error) return { error: error.message };

  revalidatePath("/games");
  revalidatePath("/games/paper");
  return { ok: "Challenge cancelled, stake refunded." };
}

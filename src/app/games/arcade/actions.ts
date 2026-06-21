"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function playCoinFlip(
  _prev: { error?: string; result?: string } | null,
  formData: FormData,
): Promise<{ error?: string; result?: string }> {
  const parsed = z
    .object({
      side: z.enum(["heads", "tails"]),
      stake: z.coerce.number().int().min(10).max(10_000),
    })
    .safeParse({
      side: formData.get("side"),
      stake: formData.get("stake"),
    });
  if (!parsed.success) return { error: "Invalid flip." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("play_coin_flip", {
    p_side: parsed.data.side,
    p_stake: parsed.data.stake,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "No result." };

  revalidatePath("/games/arcade");
  return {
    result: row.won
      ? `It was ${row.flip_side}! You won ${row.payout} VIBE.`
      : `It was ${row.flip_side}. You lost ${parsed.data.stake} VIBE.`,
  };
}

export async function createDiceDuel(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const stake = z.coerce.number().int().min(10).max(10_000).parse(formData.get("stake"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_dice_duel", { p_stake: stake });
  if (error) return { error: error.message };
  revalidatePath("/games/arcade");
  return { ok: `Dice duel posted (${stake} VIBE). Waiting for opponent…` };
}

export async function acceptDiceDuel(duelId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_dice_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/games/arcade");
  return {
    ok: row
      ? `You rolled ${row.opponent_roll} vs ${row.creator_roll}. Payout ${row.payout} VIBE.`
      : "Duel settled.",
  };
}

export async function cancelDiceDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_dice_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/arcade");
  return { ok: "Cancelled." };
}

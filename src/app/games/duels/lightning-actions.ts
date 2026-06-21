"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";

const stakeSchema = z.coerce.number().int().min(10).max(10_000);

async function getBtcPrice(): Promise<number> {
  const prices = await fetchCryptoSpotPrices();
  const btc = prices.find((p) => p.asset === "btc");
  if (!btc?.price) throw new Error("Could not fetch BTC price.");
  return btc.price;
}

export async function createLightningDuel(
  _prev: { error?: string; ok?: string; duelId?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string; duelId?: string }> {
  const parsed = z
    .object({
      side: z.enum(["up", "down"]),
      stake: stakeSchema,
      duration: z.coerce.number().int().min(30).max(300).default(60),
    })
    .safeParse({
      side: formData.get("side"),
      stake: formData.get("stake"),
      duration: formData.get("duration") ?? 60,
    });
  if (!parsed.success) return { error: "Invalid duel." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lightning_duel", {
    p_side: parsed.data.side,
    p_stake: parsed.data.stake,
    p_duration_sec: parsed.data.duration,
  });
  if (error) return { error: error.message };

  revalidatePath("/games/duels/lightning");
  return {
    ok: `Lightning duel posted — betting BTC goes ${parsed.data.side.toUpperCase()}.`,
    duelId: String(data),
  };
}

export async function acceptLightningDuel(duelId: string) {
  try {
    const price = await getBtcPrice();
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_lightning_duel", {
      p_duel_id: duelId,
      p_btc_price: price,
    });
    if (error) return { error: error.message };
    revalidatePath("/games/duels/lightning");
    revalidatePath(`/games/duels/lightning/${duelId}`);
    return { redirect: `/games/duels/lightning/${duelId}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function cancelLightningDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_lightning_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/lightning");
  return { ok: "Cancelled." };
}

export async function tickLightningDuels() {
  try {
    const price = await getBtcPrice();
    const supabase = await createClient();
    await supabase.rpc("tick_lightning_duels", { p_btc_price: price });
    return { price };
  } catch {
    return { price: null };
  }
}

export async function createTriviaDuel(
  _prev: { error?: string; ok?: string; duelId?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string; duelId?: string }> {
  const stake = stakeSchema.parse(formData.get("stake"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trivia_duel", { p_stake: stake });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/trivia");
  return { ok: `Trivia duel posted (${stake} VIBE).`, duelId: String(data) };
}

export async function acceptTriviaDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_trivia_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/trivia");
  return { redirect: `/games/duels/trivia/${duelId}` };
}

export async function cancelTriviaDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_trivia_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/trivia");
  return { ok: "Cancelled." };
}

export async function submitTriviaAnswers(duelId: string, answers: number[]) {
  if (answers.length !== 5) return { error: "Need 5 answers." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_trivia_answers", {
    p_duel_id: duelId,
    p_answers: answers,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath(`/games/duels/trivia/${duelId}`);
  if (!row || row.creator_score == null) {
    return { ok: "Answers submitted — waiting for opponent." };
  }
  return {
    ok: `Final: ${row.creator_score} vs ${row.opponent_score}. ${
      row.winner_id ? `Winner paid ${row.payout} VIBE.` : "Draw — stakes refunded."
    }`,
    settled: true as const,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";

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
      duration: z.coerce.number().int().min(30).max(300).default(60),
    })
    .safeParse({
      side: formData.get("side"),
      duration: formData.get("duration") ?? 60,
    });
  if (!parsed.success) return { error: "Invalid duel." };

  let fields: ReturnType<typeof parseFriendDuelFields>;
  try {
    fields = parseFriendDuelFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lightning_duel", {
    p_side: parsed.data.side,
    p_stake: fields.stake,
    p_duration_sec: parsed.data.duration,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };

  revalidatePath("/games/duels/lightning");
  return {
    ok: fields.friendly
      ? "Friendly Lightning duel posted — no VIBE wager."
      : `Lightning duel posted — betting BTC goes ${parsed.data.side.toUpperCase()}.`,
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
  let fields: ReturnType<typeof parseFriendDuelFields>;
  try {
    fields = parseFriendDuelFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trivia_duel", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });

  let duelId = data;
  let rpcError = error;

  if (
    rpcError?.message?.includes("Could not find the function") ||
    rpcError?.message?.includes("schema cache")
  ) {
    if (fields.friendly || fields.inviteCode) {
      return {
        error:
          "Friend invites on Trivia need migration phase 33 in Supabase. Run 20260218000000_phase33_lightning_trivia_friends.sql",
      };
    }
    const legacy = await supabase.rpc("create_trivia_duel", { p_stake: fields.stake });
    duelId = legacy.data;
    rpcError = legacy.error;
  }

  if (rpcError) return { error: rpcError.message };
  revalidatePath("/games/duels/trivia");
  const msg = fields.friendly
    ? "Friendly Trivia duel posted — no VIBE wager."
    : fields.inviteCode
      ? `Challenge sent (${fields.stake} VIBE).`
      : `Trivia duel posted (${fields.stake} VIBE).`;
  return { ok: msg, duelId: String(duelId) };
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

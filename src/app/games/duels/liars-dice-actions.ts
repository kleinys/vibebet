"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";

export async function createLiarsDiceGame(
  _prev: { error?: string; ok?: string; gameId?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string; gameId?: string }> {
  let fields: ReturnType<typeof parseFriendDuelFields>;
  try {
    fields = parseFriendDuelFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_liars_dice_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };

  revalidatePath("/games/duels/liars-dice");
  const msg = fields.friendly
    ? "Friendly Liar's Dice posted — no VIBE wager."
    : fields.inviteCode
      ? `Challenge sent (${fields.stake} VIBE).`
      : `Liar's Dice posted (${fields.stake} VIBE).`;
  return { ok: msg, gameId: String(data) };
}

export async function acceptLiarsDiceGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_liars_dice_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/liars-dice");
  revalidatePath(`/games/duels/liars-dice/${gameId}`);
  return { ok: "Game started!" };
}

export async function cancelLiarsDiceGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_liars_dice_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/liars-dice");
  return { ok: "Cancelled." };
}

export async function placeLiarsDiceBid(gameId: string, quantity: number, face: number) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("place_liars_dice_bid", {
    p_game_id: gameId,
    p_quantity: quantity,
    p_face: face,
  });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/liars-dice/${gameId}`);
  return { ok: `Bid: ${quantity} × ${face}s` };
}

export async function callLiarsDice(gameId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("call_liars_dice", { p_game_id: gameId });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath(`/games/duels/liars-dice/${gameId}`);
  if (!row) return { ok: "Game over." };
  return {
    ok: `Actual count: ${row.actual_count} (bid was ${row.bid_quantity} × ${row.bid_face}).`,
    settled: true as const,
  };
}

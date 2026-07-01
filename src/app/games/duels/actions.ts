"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";

export async function createRpsDuel(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({
      move: z.enum(["rock", "paper", "scissors"]),
    })
    .safeParse({
      move: formData.get("move"),
    });
  if (!parsed.success) return { error: "Invalid duel." };

  let friendFields: ReturnType<typeof parseFriendDuelFields>;
  try {
    friendFields = parseFriendDuelFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_rps_duel", {
    p_stake: friendFields.stake,
    p_move: parsed.data.move,
    p_invite_code: friendFields.inviteCode,
    p_friendly: friendFields.friendly,
  });
  if (error) return { error: error.message };

  revalidatePath("/games/duels");
  revalidatePath("/games/duels/rps");
  const suffix = friendFields.friendly
    ? " Friendly — no VIBE wager."
    : friendFields.inviteCode
      ? " Challenge sent — waiting for them."
      : "";
  return {
    ok: `RPS duel posted${friendFields.friendly ? "" : ` (${friendFields.stake} VIBE)`}. Your move is locked in.${suffix}`,
  };
}

export async function acceptRpsDuel(duelId: string, move: "rock" | "paper" | "scissors") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("accept_rps_duel", {
    p_duel_id: duelId,
    p_move: move,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/games/duels/rps");
  if (!row) return { ok: "Duel settled." };

  if (!row.winner_id) {
    return {
      ok: `Draw! ${row.creator_move} vs ${row.opponent_move}. Stakes refunded.`,
    };
  }
  const won = user?.id === row.winner_id;
  return {
    ok: `${row.creator_move} vs ${row.opponent_move}. ${won ? "You won" : "Winner paid"} ${row.payout} VIBE.`,
    won,
  };
}

export async function cancelRpsDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_rps_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/rps");
  return { ok: "Cancelled." };
}

export async function createHighCardDuel(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  let fields: ReturnType<typeof parseFriendDuelFields>;
  try {
    fields = parseFriendDuelFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_high_card_duel", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/high-card");
  const msg = fields.friendly
    ? "Friendly High Card posted — no VIBE wager."
    : fields.inviteCode
      ? `Challenge sent (${fields.stake} VIBE).`
      : `High Card duel posted (${fields.stake} VIBE).`;
  return { ok: msg };
}

export async function acceptHighCardDuel(duelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("accept_high_card_duel", {
    p_duel_id: duelId,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/games/duels/high-card");
  if (!row) return { ok: "Duel settled." };
  const won = !!(user && row.winner_id === user.id);
  return {
    ok: `Cards: ${row.creator_card} vs ${row.opponent_card}. ${won ? "You won" : "Payout"} ${row.payout} VIBE.`,
    won,
  };
}

export async function cancelHighCardDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_high_card_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/high-card");
  return { ok: "Cancelled." };
}

export async function joinMatchQueue(gameKey: "high_card" | "dice", stake: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_game_match_queue", {
    p_game_key: gameKey,
    p_stake: stake,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "No queue response." };

  if (row.matched && row.duel_id) {
    if (gameKey === "high_card") {
      const accept = await acceptHighCardDuel(row.duel_id);
      return { ...accept, duelId: row.duel_id };
    }
    const { data: diceData, error: diceErr } = await supabase.rpc("accept_dice_duel", {
      p_duel_id: row.duel_id,
    });
    if (diceErr) return { error: diceErr.message };
    const diceRow = Array.isArray(diceData) ? diceData[0] : null;
    revalidatePath("/games/arcade");
    return {
      ok: diceRow
        ? `Matched! Rolls ${diceRow.creator_roll} vs ${diceRow.opponent_roll}.`
        : "Matched and settled.",
      duelId: row.duel_id,
    };
  }

  return { waiting: true as const };
}

export async function leaveMatchQueue(gameKey: "high_card" | "dice") {
  const supabase = await createClient();
  await supabase.rpc("leave_game_match_queue", { p_game_key: gameKey });
  return { ok: true };
}

/** Poll for match result — used by the player who joined the queue first. */
export async function pollMatchmaking(gameKey: "high_card" | "dice", stake: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  if (gameKey === "high_card") {
    const { data } = await supabase
      .from("high_card_duels")
      .select(
        "id, creator_id, opponent_id, creator_card, opponent_card, winner_id, stake, settled_at",
      )
      .eq("status", "settled")
      .eq("stake", stake)
      .gte("settled_at", since)
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("settled_at", { ascending: false })
      .limit(1);

    const d = data?.[0];
    if (d && d.creator_card != null && d.opponent_card != null) {
      const won = d.winner_id === user.id;
      revalidatePath("/games/duels/high-card");
      return {
        done: true as const,
        ok: `Cards ${d.creator_card} vs ${d.opponent_card}. ${won ? "You won!" : "You lost."}`,
      };
    }
  } else {
    const { data } = await supabase
      .from("dice_duels")
      .select(
        "id, creator_id, opponent_id, creator_roll, opponent_roll, winner_id, stake, settled_at",
      )
      .eq("status", "settled")
      .eq("stake", stake)
      .gte("settled_at", since)
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("settled_at", { ascending: false })
      .limit(1);

    const d = data?.[0];
    if (d && d.creator_roll != null && d.opponent_roll != null) {
      const won = d.winner_id === user.id;
      revalidatePath("/games/arcade");
      return {
        done: true as const,
        ok: `Rolls ${d.creator_roll} vs ${d.opponent_roll}. ${won ? "You won!" : "You lost."}`,
      };
    }
  }

  const { data: inQueue } = await supabase
    .from("game_match_queue")
    .select("id")
    .eq("game_key", gameKey)
    .eq("user_id", user.id)
    .maybeSingle();

  if (inQueue) return { waiting: true as const };
  return { idle: true as const };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";
import {
  advancePokerStreet,
  dealNewPokerHand,
  evaluateShowdown,
  type PokerState,
} from "@/lib/poker-holdem";

export async function createPokerGame(
  _prev: { error?: string; ok?: string; gameId?: string } | null,
  formData: FormData,
) {
  let fields: ReturnType<typeof parseFriendDuelFields>;
  try {
    fields = parseFriendDuelFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_poker_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/poker");
  return { ok: "Poker duel posted.", gameId: String(data) };
}

export async function acceptPokerGame(gameId: string) {
  const supabase = await createClient();
  const state = dealNewPokerHand();
  const { error } = await supabase.rpc("accept_poker_game", {
    p_game_id: gameId,
    p_state: state as unknown as Record<string, unknown>,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/poker");
  revalidatePath(`/games/duels/poker/${gameId}`);
  return { ok: "Hand dealt!" };
}

export async function cancelPokerGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_poker_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/poker");
  return { ok: "Cancelled." };
}

export async function advancePokerGame(gameId: string) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("get_poker_game", { p_game_id: gameId });
  const game = Array.isArray(rows) ? rows[0] : null;
  if (!game || game.status !== "active" || !game.state) return { error: "Game not active." };

  const { data: rawRow } = await supabase.from("poker_games").select("state").eq("id", gameId).single();
  let state = (rawRow?.state ?? game.state) as PokerState;
  if (state.phase === "showdown") return { error: "Already at showdown." };

  state = advancePokerStreet(state);

  if (state.phase === "showdown") {
    const fullState = state;
    const ev = evaluateShowdown(fullState);
    const winnerId =
      ev.winner === "creator"
        ? game.creator_id
        : ev.winner === "opponent"
          ? game.opponent_id
          : null;

    const { error } = await supabase.rpc("settle_poker_game", {
      p_game_id: gameId,
      p_winner_id: winnerId,
      p_is_draw: ev.winner === "draw",
      p_state: fullState as unknown as Record<string, unknown>,
      p_creator_rank: ev.creatorRank,
      p_opponent_rank: ev.opponentRank,
    });
    if (error) return { error: error.message };
    revalidatePath(`/games/duels/poker/${gameId}`);
    return { ok: "Showdown!", settled: true };
  }

  const { error } = await supabase.rpc("update_poker_state", {
    p_game_id: gameId,
    p_state: state as unknown as Record<string, unknown>,
  });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/poker/${gameId}`);
  return { ok: `Dealt ${state.phase}.` };
}

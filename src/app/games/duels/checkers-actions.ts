"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";
import {
  applyCheckersMove,
  checkersSideForUser,
  type CheckersCell,
} from "@/lib/checkers-engine";

export async function createCheckersGame(
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
  const { data, error } = await supabase.rpc("create_checkers_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/checkers");
  return { ok: "Checkers game posted.", gameId: String(data) };
}

export async function acceptCheckersGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_checkers_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/checkers");
  revalidatePath(`/games/duels/checkers/${gameId}`);
  return { ok: "Game started!" };
}

export async function cancelCheckersGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_checkers_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/checkers");
  return { ok: "Cancelled." };
}

export async function playCheckersMove(gameId: string, from: number, to: number, captures: number[]) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("get_checkers_game", { p_game_id: gameId });
  const game = Array.isArray(rows) ? rows[0] : null;
  if (!game || (game.status !== "active" && game.status !== "matched")) return { error: "Game not in play." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const isCreator = user.id === game.creator_id;
  const side = checkersSideForUser(isCreator);
  const board = (game.board ?? []) as CheckersCell[];
  const result = applyCheckersMove(board, { from, to, captures }, side);
  if ("error" in result && result.error) return { error: result.error };

  let status = "active";
  let winnerId: string | null = null;
  let nextTurn: string | null = game.current_turn_id as string;

  if ("winner" in result && result.winner) {
    status = "settled";
    winnerId = result.winner === "creator" ? game.creator_id : game.opponent_id;
  } else if ("draw" in result && result.draw) {
    status = "draw";
  } else if (!result.continueTurn) {
    nextTurn = isCreator ? game.opponent_id : game.creator_id;
  } else {
    nextTurn = user.id;
  }

  const { error } = await supabase.rpc("apply_checkers_state", {
    p_game_id: gameId,
    p_board: result.board!,
    p_next_turn_id: status === "active" ? nextTurn : null,
    p_status: status,
    p_winner_id: winnerId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/games/duels/checkers/${gameId}`);
  return { ok: "Move played.", settled: status !== "active" && status !== "matched" };
}

export async function leaveCheckersGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_checkers_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/checkers");
  return { ok: "Left — stakes refunded.", left: true as const };
}

export async function resignCheckersGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resign_checkers_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/checkers/${gameId}`);
  return { ok: "You resigned." };
}

export async function offerCheckersDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("offer_checkers_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/checkers/${gameId}`);
  return { ok: "Draw offered." };
}

export async function acceptCheckersDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_checkers_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/checkers/${gameId}`);
  return { ok: "Draw accepted.", settled: true as const };
}

export async function declineCheckersDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_checkers_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/checkers/${gameId}`);
  return { ok: "Draw declined." };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";
import { applyGoMove, goColorForUser, scoreGo, type GoCell } from "@/lib/go-engine";

export async function createGoGame(
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
  const { data, error } = await supabase.rpc("create_go_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/go");
  return { ok: "Go game posted.", gameId: String(data) };
}

export async function acceptGoGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_go_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/go");
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Game started!" };
}

export async function cancelGoGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_go_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/go");
  return { ok: "Cancelled." };
}

export async function playGoMove(gameId: string, idx: number) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("get_go_game", { p_game_id: gameId });
  const game = Array.isArray(rows) ? rows[0] : null;
  if (!game || (game.status !== "active" && game.status !== "matched")) return { error: "Game not in play." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const isCreator = user.id === game.creator_id;
  const color = goColorForUser(isCreator);
  const board = (game.board ?? []) as GoCell[];
  const prev = (game.prev_board ?? null) as GoCell[] | null;
  const moved = applyGoMove(board, idx, color, prev);
  if (moved.error) return { error: moved.error };

  const nextTurn = isCreator ? game.opponent_id : game.creator_id;

  const { error } = await supabase.rpc("apply_go_state", {
    p_game_id: gameId,
    p_board: moved.board!,
    p_prev_board: board,
    p_pass_count: 0,
    p_next_turn_id: nextTurn,
    p_status: "active",
    p_winner_id: null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Stone placed." };
}

export async function passGoGame(gameId: string) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("get_go_game", { p_game_id: gameId });
  const game = Array.isArray(rows) ? rows[0] : null;
  if (!game || (game.status !== "active" && game.status !== "matched")) return { error: "Game not in play." };

  const passCount = (game.pass_count ?? 0) + 1;
  const isCreator = (await supabase.auth.getUser()).data.user?.id === game.creator_id;
  const nextTurn = isCreator ? game.opponent_id : game.creator_id;

  if (passCount >= 2) {
    const scored = scoreGo((game.board ?? []) as GoCell[]);
    const status = scored.winner === "draw" ? "draw" : "settled";
    const winnerId =
      scored.winner === "creator"
        ? game.creator_id
        : scored.winner === "opponent"
          ? game.opponent_id
          : null;

    const { error } = await supabase.rpc("apply_go_state", {
      p_game_id: gameId,
      p_board: game.board,
      p_prev_board: game.prev_board,
      p_pass_count: passCount,
      p_next_turn_id: null,
      p_status: status,
      p_winner_id: winnerId,
      p_black_score: scored.black,
      p_white_score: scored.white,
    });
    if (error) return { error: error.message };
    revalidatePath(`/games/duels/go/${gameId}`);
    return { ok: "Game scored.", settled: true };
  }

  const { error } = await supabase.rpc("apply_go_state", {
    p_game_id: gameId,
    p_board: game.board,
    p_prev_board: game.prev_board,
    p_pass_count: passCount,
    p_next_turn_id: nextTurn,
    p_status: "active",
    p_winner_id: null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Passed." };
}

export async function resignGoGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resign_go_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Resigned." };
}

export async function leaveGoGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_go_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/go");
  return { ok: "Left — stakes refunded.", left: true as const };
}

export async function offerGoDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("offer_go_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Draw offered." };
}

export async function acceptGoDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_go_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Draw accepted.", settled: true as const };
}

export async function declineGoDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_go_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/go/${gameId}`);
  return { ok: "Draw declined." };
}

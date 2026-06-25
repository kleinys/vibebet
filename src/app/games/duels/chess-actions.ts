"use server";

import { revalidatePath } from "next/cache";
import { Chess } from "chess.js";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function createChessGame(
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
  const { data, error } = await supabase.rpc("create_chess_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
    p_clock_initial_sec: formData.get("blitz") === "on" ? 300 : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/chess");
  return {
    ok: fields.friendly ? "Friendly chess posted." : `Chess duel posted (${fields.stake} VIBE).`,
    gameId: String(data),
  };
}

export async function acceptChessGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_chess_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/chess");
  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: "Game started!" };
}

export async function cancelChessGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_chess_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/chess");
  return { ok: "Cancelled." };
}

export async function playChessMove(gameId: string, from: string, to: string, promotion?: string) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("get_chess_game", { p_game_id: gameId });
  const game = Array.isArray(rows) ? rows[0] : null;
  if (!game || (game.status !== "active" && game.status !== "matched")) return { error: "Game not in play." };

  const chess = new Chess(game.fen ?? START_FEN);
  const move = chess.move({ from, to, promotion: promotion as "q" | undefined });
  if (!move) return { error: "Illegal move." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const creatorId = game.creator_id as string;
  const opponentId = game.opponent_id as string;
  const whiteId = creatorId;
  const blackId = opponentId;
  const nextTurn =
    chess.turn() === "w" ? whiteId : blackId;

  let status = "active";
  let winnerId: string | null = null;
  let result: string | null = null;

  if (chess.isCheckmate()) {
    status = "settled";
    winnerId = chess.turn() === "w" ? blackId : whiteId;
    result = "checkmate";
  } else if (chess.isStalemate() || chess.isDraw()) {
    status = "draw";
    result = chess.isStalemate() ? "stalemate" : "draw";
  }

  const { error } = await supabase.rpc("apply_chess_state", {
    p_game_id: gameId,
    p_fen: chess.fen(),
    p_next_turn_id: status === "active" ? nextTurn : null,
    p_status: status,
    p_winner_id: winnerId,
    p_result: result,
  });
  if (error) return { error: error.message };

  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: status === "active" ? "Move played." : "Game over!", settled: status !== "active" };
}

export async function resignChessGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resign_chess_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: "You resigned." };
}

export async function leaveChessGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_chess_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/chess");
  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: "Left the game — stakes refunded.", left: true as const };
}

export async function offerChessDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("offer_chess_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: "Draw offered." };
}

export async function acceptChessDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_chess_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: "Draw accepted.", settled: true as const };
}

export async function declineChessDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_chess_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/chess/${gameId}`);
  return { ok: "Draw declined." };
}

export async function getChessLegalMoves(fen: string, from: string) {
  const chess = new Chess(fen || START_FEN);
  return chess.moves({ square: from as "a1", verbose: true }).map((m) => m.to);
}

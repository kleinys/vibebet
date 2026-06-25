"use server";

import { revalidatePath } from "next/cache";
import { parseSfen, makeSfen } from "shogiops/sfen";
import { parseSquareName } from "shogiops/util";
import { createClient } from "@/lib/supabase/server";
import { parseFriendDuelFields } from "@/lib/parse-friend-duel";

const START_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 0";

function loadPosition(sfen: string) {
  const parsed = parseSfen("standard", sfen);
  return parsed.isOk ? parsed.value : null;
}

export async function createShogiGame(
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
  const { data, error } = await supabase.rpc("create_shogi_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/shogi");
  return { ok: "Shogi game posted.", gameId: String(data) };
}

export async function acceptShogiGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_shogi_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/shogi");
  revalidatePath(`/games/duels/shogi/${gameId}`);
  return { ok: "Game started!" };
}

export async function cancelShogiGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_shogi_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/shogi");
  return { ok: "Cancelled." };
}

export async function playShogiMove(gameId: string, from: string, to: string, promotion = false) {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("get_shogi_game", { p_game_id: gameId });
  const game = Array.isArray(rows) ? rows[0] : null;
  if (!game || (game.status !== "active" && game.status !== "matched")) return { error: "Game not in play." };

  const pos = loadPosition(game.sfen ?? START_SFEN);
  if (!pos) return { error: "Invalid position." };

  const fromSq = parseSquareName(from);
  const toSq = parseSquareName(to);
  if (fromSq === undefined || toSq === undefined) return { error: "Bad square." };

  const move = { from: fromSq, to: toSq, promotion };
  if (!pos.isLegal(move)) return { error: "Illegal move." };
  pos.play(move);

  const creatorId = game.creator_id as string;
  const opponentId = game.opponent_id as string;
  const nextTurn = pos.turn === "sente" ? creatorId : opponentId;

  let status = "active";
  let winnerId: string | null = null;
  let result: string | null = null;

  if (pos.isEnd()) {
    const outcome = pos.outcome();
    if (outcome?.winner === "sente") {
      status = "settled";
      winnerId = creatorId;
      result = "checkmate";
    } else if (outcome?.winner === "gote") {
      status = "settled";
      winnerId = opponentId;
      result = "checkmate";
    } else {
      status = "draw";
      result = "draw";
    }
  }

  const { error } = await supabase.rpc("apply_shogi_state", {
    p_game_id: gameId,
    p_sfen: makeSfen(pos),
    p_next_turn_id: status === "active" ? nextTurn : null,
    p_status: status,
    p_winner_id: winnerId,
    p_result: result,
  });
  if (error) return { error: error.message };

  revalidatePath(`/games/duels/shogi/${gameId}`);
  return { ok: "Move played.", settled: status !== "active" };
}

export async function resignShogiGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resign_shogi_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/shogi/${gameId}`);
  return { ok: "Resigned." };
}

export async function leaveShogiGame(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_shogi_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/shogi");
  return { ok: "Left — stakes refunded.", left: true as const };
}

export async function offerShogiDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("offer_shogi_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/shogi/${gameId}`);
  return { ok: "Draw offered." };
}

export async function acceptShogiDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_shogi_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/shogi/${gameId}`);
  return { ok: "Draw accepted.", settled: true as const };
}

export async function declineShogiDraw(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_shogi_draw", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath(`/games/duels/shogi/${gameId}`);
  return { ok: "Draw declined." };
}

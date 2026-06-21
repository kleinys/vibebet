"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const stakeSchema = z.coerce.number().int().min(0).max(10_000);

function parseFriendFields(formData: FormData) {
  const inviteRaw = String(formData.get("inviteCode") ?? "").trim();
  const friendly = formData.get("friendly") === "true";
  const stakeRaw = stakeSchema.parse(formData.get("stake"));
  const stake = friendly ? 0 : stakeRaw;
  if (!friendly && (stake < 10 || stake > 10_000)) {
    throw new Error("Stake must be 10–10,000 VIBE for ranked duels.");
  }
  return {
    inviteCode: inviteRaw.length > 0 ? inviteRaw : null,
    friendly,
    stake,
  };
}

export async function createConnect4Game(
  _prev: { error?: string; ok?: string; gameId?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string; gameId?: string }> {
  let fields: ReturnType<typeof parseFriendFields>;
  try {
    fields = parseFriendFields(formData);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_connect4_game", {
    p_stake: fields.stake,
    p_invite_code: fields.inviteCode,
    p_friendly: fields.friendly,
  });
  if (error) return { error: error.message };

  revalidatePath("/games/duels/connect4");
  const msg = fields.friendly
    ? "Friendly Connect Four posted — no VIBE wager."
    : fields.inviteCode
      ? `Challenge sent (${fields.stake} VIBE) — waiting for them to accept.`
      : `Connect Four posted (${fields.stake} VIBE).`;
  return { ok: msg, gameId: String(data) };
}

export async function acceptConnect4Game(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_connect4_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/connect4");
  revalidatePath(`/games/duels/connect4/${gameId}`);
  return { ok: "Game started!" };
}

export async function cancelConnect4Game(gameId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_connect4_game", { p_game_id: gameId });
  if (error) return { error: error.message };
  revalidatePath("/games/duels/connect4");
  return { ok: "Cancelled." };
}

export async function playConnect4Move(gameId: string, col: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("play_connect4_move", {
    p_game_id: gameId,
    p_col: col,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath(`/games/duels/connect4/${gameId}`);
  if (row?.winner_id) {
    return { ok: "Game over!", settled: true as const };
  }
  if (row?.is_draw) {
    return { ok: "Draw!", settled: true as const };
  }
  return { ok: "Move played." };
}

export async function lookupPlayerCode(code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_player_code", { p_code: code });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "Player not found." };
  return {
    ok: `${row.display_name}${row.username ? ` (@${row.username})` : ""}`,
  };
}

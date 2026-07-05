"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BotGameKey = "rps" | "high_card" | "dice";

export async function playVsBot(
  gameKey: BotGameKey,
  stake: number,
  move?: "rock" | "paper" | "scissors",
) {
  if (stake < 10 || stake > 10000) {
    return { error: "Stake must be 10–10,000 VIBE." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to play vs the bot." };

  if (gameKey === "rps") {
    if (!move) return { error: "Pick rock, paper, or scissors." };
    const { data, error } = await supabase.rpc("play_rps_vs_bot", {
      p_stake: stake,
      p_move: move,
    });
    if (error) return { error: error.message };

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No bot duel result." };

    revalidatePath("/games/duels/rps");
    if (!row.winner_id) {
      return {
        ok: `Draw vs ${row.bot_name}: ${row.creator_move} vs ${row.opponent_move}. Refunded.`,
      };
    }
    const won = user.id === row.winner_id;
    return {
      ok: `${row.creator_move} vs ${row.opponent_move} (${row.bot_name}). ${won ? "You won" : "Bot won"} ${row.payout} VIBE.`,
      won,
    };
  }

  if (gameKey === "high_card") {
    const { data, error } = await supabase.rpc("play_high_card_vs_bot", {
      p_stake: stake,
    });
    if (error) return { error: error.message };

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No bot duel result." };

    revalidatePath("/games/duels/high-card");
    const won = user.id === row.winner_id;
    return {
      ok: `Cards ${row.creator_card} vs ${row.opponent_card} (${row.bot_name}). ${won ? "You won" : "Bot won"} ${row.payout} VIBE.`,
      won,
    };
  }

  const { data, error } = await supabase.rpc("play_dice_vs_bot", { p_stake: stake });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "No bot duel result." };

  revalidatePath("/games/arcade");
  const won = user.id === row.winner_id;
  return {
    ok: `Rolls ${row.creator_roll} vs ${row.opponent_roll} (${row.bot_name}). ${won ? "You won" : "Bot won"} ${row.payout} VIBE.`,
    won,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dealNewPokerHand } from "@/lib/poker-holdem";

export type InstantBotKey =
  | "rps"
  | "high_card"
  | "dice"
  | "trivia"
  | "liars_dice"
  | "lightning_duel"
  | "coin_flip"
  | "plinko"
  | "lucky_slots";

export type SkillBotKey =
  | "chess"
  | "connect4"
  | "checkers"
  | "go"
  | "shogi"
  | "poker";

export type DuelBotKey = InstantBotKey | SkillBotKey;

const SKILL_PATHS: Record<SkillBotKey, string> = {
  chess: "/games/duels/chess",
  connect4: "/games/duels/connect4",
  checkers: "/games/duels/checkers",
  go: "/games/duels/go",
  shogi: "/games/duels/shogi",
  poker: "/games/duels/poker",
};

export async function playInstantVsBot(
  gameKey: InstantBotKey,
  stake: number,
  move?: "rock" | "paper" | "scissors",
  side?: "up" | "down",
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
      return { ok: `Draw vs ${row.bot_name}: ${row.creator_move} vs ${row.opponent_move}. Refunded.` };
    }
    const won = user.id === row.winner_id;
    return {
      ok: `${row.creator_move} vs ${row.opponent_move} (${row.bot_name}). ${won ? "You won" : "Bot won"} ${row.payout} VIBE.`,
      won,
    };
  }

  if (gameKey === "high_card") {
    const { data, error } = await supabase.rpc("play_high_card_vs_bot", { p_stake: stake });
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

  if (gameKey === "dice") {
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

  if (gameKey === "trivia") {
    const { data, error } = await supabase.rpc("play_trivia_vs_bot", { p_stake: stake });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No bot duel result." };
    revalidatePath("/games/duels/trivia");
    const won = user.id === row.winner_id;
    return {
      ok: `Trivia ${row.your_score}–${row.bot_score} vs ${row.bot_name}. ${won ? "You won" : "Bot won"} ${row.payout} VIBE.`,
      won,
    };
  }

  if (gameKey === "liars_dice") {
    const { data, error } = await supabase.rpc("play_liars_dice_vs_bot", { p_stake: stake });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No bot duel result." };
    revalidatePath("/games/duels/liars-dice");
    return {
      ok: row.you_won
        ? `You called the bot's bluff! Won ${row.payout} VIBE.`
        : `The bot held — you lost ${stake} VIBE.`,
      won: row.you_won,
    };
  }

  if (gameKey === "lightning_duel") {
    const pick = side ?? (Math.random() < 0.5 ? "up" : "down");
    const { data, error } = await supabase.rpc("play_lightning_duel_vs_bot", {
      p_stake: stake,
      p_side: pick,
    });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No bot duel result." };
    revalidatePath("/games/duels/lightning");
    const won = user.id === row.winner_id;
    return {
      ok: `BTC ${pick} @ ${Number(row.strike_price).toFixed(0)} → ${Number(row.settle_price).toFixed(0)}. ${won ? "You won" : "Bot won"} ${row.payout} VIBE.`,
      won,
    };
  }

  if (gameKey === "plinko") {
    const risks = ["low", "medium", "high"] as const;
    const risk = risks[Math.floor(Math.random() * risks.length)];
    const { data, error } = await supabase.rpc("play_plinko", {
      p_stake: stake,
      p_risk: risk,
    });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No result." };
    revalidatePath("/games/arcade");
    return {
      ok: `Plinko (${risk}) · slot ${Number(row.slot_index) + 1} · ${row.multiplier}× → ${row.payout} VIBE (${Number(row.net) >= 0 ? "+" : ""}${row.net}).`,
      won: Number(row.net) > 0,
    };
  }

  if (gameKey === "lucky_slots") {
    const { data, error } = await supabase.rpc("spin_lucky_slots", { p_stake: stake });
    if (error) return { error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { error: "No result." };
    revalidatePath("/games/arcade");
    return {
      ok: `${row.reel1} | ${row.reel2} | ${row.reel3}${row.scratcher_won ? " — scratcher ticket won!" : row.line_payout ? ` → ${row.line_payout} VIBE` : ""}`,
      won: Boolean(row.scratcher_won) || Number(row.line_payout) > 0,
    };
  }

  const coinSide = Math.random() < 0.5 ? "heads" : "tails";
  const { data, error } = await supabase.rpc("play_coin_flip", {
    p_side: coinSide,
    p_stake: stake,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "No result." };
  revalidatePath("/games/arcade");
  return {
    ok: row.won
      ? `Bot picked ${coinSide === "heads" ? "tails" : "heads"} — flip was ${row.flip_side}! You won ${row.payout} VIBE.`
      : `Bot won the flip (${row.flip_side}). Lost ${stake} VIBE.`,
    won: row.won,
  };
}

/** @deprecated use playInstantVsBot */
export async function playVsBot(
  gameKey: "rps" | "high_card" | "dice",
  stake: number,
  move?: "rock" | "paper" | "scissors",
) {
  return playInstantVsBot(gameKey, stake, move);
}

export async function startSkillVsBot(gameKey: SkillBotKey, friendly = true, stake = 100) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to play vs the bot." };

  let gameId: string | null = null;

  if (gameKey === "chess") {
    const { data, error } = await supabase.rpc("start_chess_vs_bot", {
      p_friendly: friendly,
      p_stake: stake,
    });
    if (error) return { error: error.message };
    gameId = String(data);
  } else if (gameKey === "connect4") {
    const { data, error } = await supabase.rpc("start_connect4_vs_bot", {
      p_friendly: friendly,
      p_stake: stake,
    });
    if (error) return { error: error.message };
    gameId = String(data);
  } else if (gameKey === "checkers") {
    const { data, error } = await supabase.rpc("start_checkers_vs_bot", {
      p_friendly: friendly,
      p_stake: stake,
    });
    if (error) return { error: error.message };
    gameId = String(data);
  } else if (gameKey === "go") {
    const { data, error } = await supabase.rpc("start_go_vs_bot", {
      p_friendly: friendly,
      p_stake: stake,
    });
    if (error) return { error: error.message };
    gameId = String(data);
  } else if (gameKey === "shogi") {
    const { data, error } = await supabase.rpc("start_shogi_vs_bot", {
      p_friendly: friendly,
      p_stake: stake,
    });
    if (error) return { error: error.message };
    gameId = String(data);
  } else if (gameKey === "poker") {
    const state = dealNewPokerHand();
    const { data, error } = await supabase.rpc("start_poker_vs_bot", {
      p_state: state as unknown as Record<string, unknown>,
      p_friendly: friendly,
      p_stake: stake,
    });
    if (error) return { error: error.message };
    gameId = String(data);
  }

  if (!gameId) return { error: "Could not start bot match." };

  revalidatePath(SKILL_PATHS[gameKey]);
  return {
    ok: "Bot match started!",
    gameId,
    href: `${SKILL_PATHS[gameKey]}/${gameId}`,
  };
}

export async function playDuelVsBot(
  catalogKey: string,
  stake = 50,
  move?: "rock" | "paper" | "scissors",
) {
  const instantMap: Record<string, InstantBotKey> = {
    rps: "rps",
    high_card: "high_card",
    dice: "dice",
    trivia: "trivia",
    liars_dice: "liars_dice",
    lightning_duel: "lightning_duel",
    coin_flip: "coin_flip",
    plinko: "plinko",
    lucky_slots: "lucky_slots",
  };

  const skillMap: Record<string, SkillBotKey> = {
    chess: "chess",
    connect4: "connect4",
    checkers: "checkers",
    go: "go",
    shogi: "shogi",
    poker: "poker",
  };

  if (instantMap[catalogKey]) {
    return playInstantVsBot(instantMap[catalogKey], stake, move);
  }
  if (skillMap[catalogKey]) {
    return startSkillVsBot(skillMap[catalogKey], true, stake);
  }
  if (catalogKey === "lightning") {
    return {
      error: "Lightning Round is solo vs the oracle — open Live Arena from the Watch hub.",
    };
  }
  return { error: "Bot not available for this game yet." };
}

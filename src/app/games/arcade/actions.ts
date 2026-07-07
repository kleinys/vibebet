"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function playCoinFlip(
  _prev: { error?: string; result?: string; won?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; result?: string; won?: boolean }> {
  const parsed = z
    .object({
      side: z.enum(["heads", "tails"]),
      stake: z.coerce.number().int().min(10).max(10_000),
    })
    .safeParse({
      side: formData.get("side"),
      stake: formData.get("stake"),
    });
  if (!parsed.success) return { error: "Invalid flip." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("play_coin_flip", {
    p_side: parsed.data.side,
    p_stake: parsed.data.stake,
  });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { error: "No result." };

  revalidatePath("/games/arcade");
  return {
    result: row.won
      ? `It was ${row.flip_side}! You won ${row.payout} VIBE.`
      : `It was ${row.flip_side}. You lost ${parsed.data.stake} VIBE.`,
    won: row.won,
  };
}

export async function createDiceDuel(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const stake = z.coerce.number().int().min(10).max(10_000).parse(formData.get("stake"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_dice_duel", { p_stake: stake });
  if (error) return { error: error.message };
  revalidatePath("/games/arcade");
  return { ok: `Dice duel posted (${stake} VIBE). Waiting for opponent…` };
}

export async function acceptDiceDuel(duelId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("accept_dice_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/games/arcade");
  if (!row) return { ok: "Duel settled." };
  const won = !!(user && row.winner_id === user.id);
  return {
    ok: `You rolled ${row.opponent_roll} vs ${row.creator_roll}. ${won ? "You won" : "Payout"} ${row.payout} VIBE.`,
    won,
  };
}

export async function cancelDiceDuel(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_dice_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/games/arcade");
  return { ok: "Cancelled." };
}

export async function playPlinko(stake: number, risk: "low" | "medium" | "high") {
  if (stake < 10 || stake > 5000) return { error: "Stake must be 10–5,000 VIBE." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("play_plinko", {
    p_stake: stake,
    p_risk: risk,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "No result." };
  revalidatePath("/games/arcade");
  revalidatePath("/account/profile/arena");
  return {
    ok: `Slot ${row.slot_index + 1} · ${row.multiplier}× → ${row.payout} VIBE (${row.net >= 0 ? "+" : ""}${row.net}).`,
    won: row.net > 0,
    slot: row.slot_index as number,
    multiplier: Number(row.multiplier),
  };
}

export async function spinLuckySlots(stake: number) {
  if (stake < 10 || stake > 2000) return { error: "Stake must be 10–2,000 VIBE." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("spin_lucky_slots", { p_stake: stake });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "No result." };
  revalidatePath("/games/arcade");
  return {
    ok: `${row.reel1} | ${row.reel2} | ${row.reel3}${row.scratcher_won ? " — scratcher ticket won!" : row.line_payout ? ` → ${row.line_payout} VIBE` : ""}`,
    reels: [row.reel1, row.reel2, row.reel3] as string[],
    scratcherWon: row.scratcher_won as boolean,
    ticketId: row.ticket_id as string | null,
    payout: row.line_payout as number,
  };
}

export async function revealLuckyScratcher(ticketId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_lucky_scratcher", {
    p_ticket_id: ticketId,
  });
  if (error) return { error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: "No result." };
  revalidatePath("/games/arcade");
  return { ok: `Scratched! +${row.prize} VIBE`, prize: row.prize as number };
}

export async function getPendingScratchers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_pending_scratchers");
  if (error) return { error: error.message, tickets: [] as { id: string; prize: number }[] };
  return {
    tickets: (data ?? []) as { id: string; prize: number; created_at: string }[],
  };
}
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function createDuel(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({
      marketId: z.string().uuid(),
      side: z.enum(["yes", "no"]),
      stake: z.coerce.number().int().min(10).max(100_000),
      opponentUsername: z.string().trim().optional(),
    })
    .safeParse({
      marketId: formData.get("marketId"),
      side: formData.get("side"),
      stake: formData.get("stake"),
      opponentUsername: formData.get("opponentUsername") || undefined,
    });
  if (!parsed.success) return { error: "Invalid duel details." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_duel", {
    p_market_id: parsed.data.marketId,
    p_side: parsed.data.side,
    p_stake: parsed.data.stake,
    p_opponent_username: parsed.data.opponentUsername ?? null,
  });
  if (error) return { error: error.message };

  const duelId = String(data);
  revalidatePath("/duels");
  revalidatePath("/games/create");
  redirect(`/duels/${duelId}`);
}

export async function acceptDuel(duelId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/duels");
  revalidatePath(`/duels/${duelId}`);
  return {};
}

export async function cancelDuel(duelId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/duels");
  revalidatePath(`/duels/${duelId}`);
  return {};
}

export async function declineDuel(duelId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_duel", { p_duel_id: duelId });
  if (error) return { error: error.message };
  revalidatePath("/duels");
  return {};
}

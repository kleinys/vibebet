"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function sponsorTournament(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({
      tournamentId: z.string().uuid(),
      amount: z.coerce.number().int().min(100).max(1_000_000),
      sponsorName: z.string().trim().min(2).max(60),
    })
    .safeParse({
      tournamentId: formData.get("tournamentId"),
      amount: formData.get("amount"),
      sponsorName: formData.get("sponsorName"),
    });
  if (!parsed.success) return { error: "Invalid sponsor details." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_sponsor_tournament", {
    p_tournament_id: parsed.data.tournamentId,
    p_amount: parsed.data.amount,
    p_sponsor_name: parsed.data.sponsorName,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/tournaments");
  return {
    ok: `Prize pool now ${Number(data).toLocaleString()} VIBE (sponsored by ${parsed.data.sponsorName}).`,
  };
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type DisputeState = { error?: string } | null;

const OpenDisputeSchema = z.object({
  marketId: z.string().uuid(),
  reasoning: z.string().trim().max(4000).optional(),
  claimedOutcomeIndex: z.coerce.number().int().min(0).max(7).optional(),
});

/**
 * Open a dispute on a market in `resolving` status. Stake is computed
 * server-side by the RPC (max(5% volume, 100), capped at 10k).
 * On success, redirects to /court/[disputeId].
 */
export async function openDispute(
  _prev: DisputeState,
  formData: FormData,
): Promise<DisputeState> {
  const parsed = OpenDisputeSchema.safeParse({
    marketId: formData.get("marketId"),
    reasoning: (formData.get("reasoning") as string | null) ?? undefined,
    claimedOutcomeIndex: formData.get("claimedOutcomeIndex") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to dispute." };

  const { data, error } = await supabase.rpc("open_dispute", {
    p_market_id: parsed.data.marketId,
    p_reasoning: parsed.data.reasoning ?? null,
    p_claimed_outcome_index: parsed.data.claimedOutcomeIndex ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/markets/${parsed.data.marketId}`);
  revalidatePath("/court");
  redirect(`/court/${data as unknown as string}`);
}

export type VoteState = { ok?: boolean; error?: string } | null;

const VoteSchema = z.object({
  disputeId: z.string().uuid(),
  overturn: z.union([z.literal("yes"), z.literal("no")]),
});

/** Cast a court vote: overturn (agree with disputer) or uphold. */
export async function castVote(
  _prev: VoteState,
  formData: FormData,
): Promise<VoteState> {
  const parsed = VoteSchema.safeParse({
    disputeId: formData.get("disputeId"),
    overturn: formData.get("overturn"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to vote." };

  const { error } = await supabase.rpc("cast_vote", {
    p_dispute_id: parsed.data.disputeId,
    p_overturn: parsed.data.overturn === "yes",
  });
  if (error) return { error: error.message };

  revalidatePath(`/court/${parsed.data.disputeId}`);
  return { ok: true };
}

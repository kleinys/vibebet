"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  HustleTransferDirection,
  HustleGigCategory,
  HustleGovernanceCategory,
  HustleRegion,
} from "@/lib/hustle/shared";

export async function claimHustleReward(
  taskId: string,
): Promise<{ error?: string; amount?: number; hustle_tier?: number; tier_label?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_daily_hustle_reward", {
    p_task_id: taskId,
  });
  if (error) return { error: error.message };

  const { data: oracleRaw } = await supabase.rpc("get_hustle_oracle");
  const oracle = oracleRaw as Record<string, unknown> | null;

  revalidatePath("/play");
  revalidatePath("/account/hustle");
  revalidatePath("/account/profile");
  return {
    amount: Number(data),
    hustle_tier: oracle ? Number(oracle.hustle_tier) : undefined,
    tier_label: oracle ? String(oracle.tier_label) : undefined,
  };
}

export async function submitSparkProgress(
  taskId: string,
  amount = 1,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_spark_hustle_progress", {
    p_task_id: taskId,
    p_amount: amount,
  });
  if (error) return { error: error.message };

  revalidatePath("/play");
  return {};
}

export async function requestHustleTransfer(
  direction: HustleTransferDirection,
  amount: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_hustle_transfer", {
    p_direction: direction,
    p_amount: Math.floor(amount),
  });
  if (error) return { error: error.message };

  revalidatePath("/play");
  revalidatePath("/account/hustle");
  return {};
}

export async function cancelHustleTransfer(
  transferId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_hustle_transfer", {
    p_transfer_id: transferId,
  });
  if (error) return { error: error.message };

  revalidatePath("/play");
  return {};
}

export async function claimHustleGig(gigId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_hustle_gig", { p_gig_id: gigId });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function submitHustleGigProof(
  submissionId: string,
  proofText: string,
  proofUrl?: string,
): Promise<{ error?: string; auto_approved?: boolean; payout?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_hustle_gig_proof", {
    p_submission_id: submissionId,
    p_proof_text: proofText,
    p_proof_url: proofUrl ?? null,
  });
  if (error) return { error: error.message };
  const row = data as Record<string, unknown> | null;
  revalidatePath("/play");
  return {
    auto_approved: Boolean(row?.auto_approved),
    payout: row?.payout != null ? Number(row.payout) : undefined,
  };
}

export async function reviewHustleGigSubmission(
  submissionId: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_hustle_gig_submission", {
    p_submission_id: submissionId,
    p_action: action,
    p_reason: reason ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function postHustleGig(payload: {
  title: string;
  description: string;
  category: HustleGigCategory;
  reward: number;
  slots: number;
  minTier: number;
  proofInstructions: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_hustle_gig", {
    p_title: payload.title,
    p_description: payload.description,
    p_category: payload.category,
    p_reward_vibe: Math.floor(payload.reward),
    p_min_hustle_tier: payload.minTier,
    p_slots: payload.slots,
    p_proof_instructions: payload.proofInstructions || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function cancelHustleGig(gigId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_hustle_gig", { p_gig_id: gigId });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function convertHustleCashToShares(
  hustleCash: number,
): Promise<{ error?: string; shares_minted?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_hustle_cash_to_shares", {
    p_hustle_cash: Math.floor(hustleCash),
  });
  if (error) return { error: error.message };
  const row = data as Record<string, unknown> | null;
  revalidatePath("/play");
  return { shares_minted: row?.shares_minted != null ? Number(row.shares_minted) : undefined };
}

export async function redeemHustleSharesToCash(
  shares: number,
): Promise<{ error?: string; hustle_cash_received?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_hustle_shares_to_cash", {
    p_shares: shares,
  });
  if (error) return { error: error.message };
  const row = data as Record<string, unknown> | null;
  revalidatePath("/play");
  return {
    hustle_cash_received:
      row?.hustle_cash_received != null ? Number(row.hustle_cash_received) : undefined,
  };
}

export async function castHustleGovernanceVote(
  proposalId: string,
  support: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_hustle_governance_vote", {
    p_proposal_id: proposalId,
    p_support: support,
  });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function submitHustleGovernanceProposal(payload: {
  title: string;
  description: string;
  category: HustleGovernanceCategory;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_hustle_governance_proposal", {
    p_title: payload.title,
    p_description: payload.description,
    p_category: payload.category,
  });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function enableHustleRecovery(
  days: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("enable_hustle_recovery", { p_days: days });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

export async function setHustleRegion(
  region: HustleRegion,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_hustle_region", { p_region: region });
  if (error) return { error: error.message };
  revalidatePath("/play");
  return {};
}

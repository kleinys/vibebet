import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type DisputeRow = Database["public"]["Tables"]["disputes"]["Row"];

export interface DisputeWithMarket extends DisputeRow {
  question: string;
  outcome_yes_label: string;
  outcome_no_label: string;
  category: string;
}

/**
 * Opportunistic ticker. Safe to call from any server-rendered page; if a
 * challenge window or voting window has expired it'll be processed in this
 * call. Bounded and idempotent. Errors are swallowed — never let a stale
 * tick break a page render.
 */
export async function maybeTickCourt(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("court_tick", { p_limit: 20 });
  } catch {
    // Intentionally ignored.
  }
}

/** List disputes currently in 'voting' status, newest first. */
export async function listActiveDisputes(
  limit = 50,
): Promise<DisputeWithMarket[]> {
  await maybeTickCourt();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("disputes")
    .select(
      "id, market_id, initiator_id, claimed_outcome, proposed_outcome, claimed_outcome_index, proposed_outcome_index, stake_amount, reasoning, status, voting_starts_at, voting_ends_at, votes_overturn, votes_uphold, resolved_at, created_at, markets!inner(question, outcome_yes_label, outcome_no_label, category)",
    )
    .eq("status", "voting")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => {
    const m = Array.isArray(d.markets) ? d.markets[0] : d.markets;
    return {
      ...d,
      markets: undefined,
      question: m?.question ?? "Unknown market",
      outcome_yes_label: m?.outcome_yes_label ?? "Yes",
      outcome_no_label: m?.outcome_no_label ?? "No",
      category: m?.category ?? "other",
    } as DisputeWithMarket;
  });
}

/** Get a single dispute by id (joined with market metadata). */
export async function getDispute(id: string): Promise<DisputeWithMarket | null> {
  await maybeTickCourt();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("disputes")
    .select(
      "id, market_id, initiator_id, claimed_outcome, proposed_outcome, claimed_outcome_index, proposed_outcome_index, stake_amount, reasoning, status, voting_starts_at, voting_ends_at, votes_overturn, votes_uphold, resolved_at, created_at, markets!inner(question, outcome_yes_label, outcome_no_label, category)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const m = Array.isArray(data.markets) ? data.markets[0] : data.markets;
  return {
    ...data,
    markets: undefined,
    question: m?.question ?? "Unknown market",
    outcome_yes_label: m?.outcome_yes_label ?? "Yes",
    outcome_no_label: m?.outcome_no_label ?? "No",
    category: m?.category ?? "other",
  } as DisputeWithMarket;
}

/** Get an active dispute for a market, if any. */
export async function getDisputeForMarket(
  marketId: string,
): Promise<DisputeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("disputes")
    .select("*")
    .eq("market_id", marketId)
    .maybeSingle();
  return data;
}

export interface VoteEligibility {
  eligible: boolean;
  voteCount: number;
  nextCost: number;
  lockedSide: boolean | null;
  reason?: string;
}

/**
 * Resolution Poll voting — anyone except the disputer can vote.
 * First vote free; vote #N costs N × 50 VIBE (must match first side).
 */
export async function getVoteEligibility(
  dispute: DisputeWithMarket,
  userId: string | null,
): Promise<VoteEligibility> {
  if (!userId) {
    return {
      eligible: false,
      voteCount: 0,
      nextCost: 0,
      lockedSide: null,
      reason: "Sign in to vote.",
    };
  }
  if (dispute.status !== "voting") {
    return {
      eligible: false,
      voteCount: 0,
      nextCost: 0,
      lockedSide: null,
      reason: "Voting closed.",
    };
  }
  if (new Date(dispute.voting_ends_at) < new Date()) {
    return {
      eligible: false,
      voteCount: 0,
      nextCost: 0,
      lockedSide: null,
      reason: "Voting window expired.",
    };
  }
  if (dispute.initiator_id === userId) {
    return {
      eligible: false,
      voteCount: 0,
      nextCost: 0,
      lockedSide: null,
      reason: "Disputer cannot vote on own case.",
    };
  }

  const supabase = await createClient();
  const { data: votes } = await supabase
    .from("court_votes")
    .select("overturn, vote_number")
    .eq("dispute_id", dispute.id)
    .eq("voter_id", userId)
    .order("vote_number", { ascending: true });

  const voteCount = votes?.length ?? 0;
  const nextCost = voteCount === 0 ? 0 : (voteCount + 1) * 50;

  return {
    eligible: true,
    voteCount,
    nextCost,
    lockedSide: votes?.[0]?.overturn ?? null,
  };
}

/** Convenience: format a deadline as relative time string. */
export function timeRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours % 24;
    return `${days}d ${h}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  HustleGovernanceCategory,
  HustleGovernanceProposal,
  HustleGovernanceState,
} from "@/lib/hustle/shared";

export type {
  HustleGovernanceCategory,
  HustleGovernanceProposal,
  HustleGovernanceState,
} from "@/lib/hustle/shared";

function mapProposal(row: Record<string, unknown>): HustleGovernanceProposal {
  return {
    proposal_id: String(row.proposal_id),
    title: String(row.title),
    description: String(row.description),
    category: row.category as HustleGovernanceCategory,
    status: String(row.status),
    min_vote_tier: Number(row.min_vote_tier),
    is_platform: Boolean(row.is_platform),
    ends_at: String(row.ends_at),
    created_at: String(row.created_at),
    votes_for: Number(row.votes_for ?? 0),
    votes_against: Number(row.votes_against ?? 0),
    voter_count: Number(row.voter_count ?? 0),
    my_vote: row.my_vote === null || row.my_vote === undefined ? null : Boolean(row.my_vote),
    my_power: row.my_power != null ? Number(row.my_power) : null,
    is_open: Boolean(row.is_open),
    can_vote: Boolean(row.can_vote),
  };
}

export async function getHustleGovernance(): Promise<HustleGovernanceState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hustle_governance");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as unknown as Record<string, unknown>;
  if (!row.authenticated) return null;

  const proposals = Array.isArray(row.proposals)
    ? (row.proposals as Record<string, unknown>[]).map(mapProposal)
    : [];

  return {
    authenticated: true,
    hustle_tier: Number(row.hustle_tier ?? 1),
    voting_power: Number(row.voting_power ?? 1),
    can_propose: Boolean(row.can_propose),
    min_propose_tier: Number(row.min_propose_tier ?? 5),
    proposals,
  };
}

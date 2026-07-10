/** Client-safe HustleOS types, constants, and helpers (no server-only). */

export type HustleTaskKind = "daily" | "spark" | "flash";

export interface DailyHustleTask {
  task_id: string;
  title: string;
  description: string;
  target: number;
  reward_vibe: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  task_kind: HustleTaskKind;
  metric: string;
  min_hustle_tier: number;
  tier_locked: boolean;
}

export type HustleTierLabel = "Spark" | "Flash" | "Gig" | "Pro" | "Elite";

export interface HustleOracleProfile {
  authenticated: boolean;
  trust_score: number;
  hustle_tier: number;
  tier_label: HustleTierLabel;
  spark_claims_lifetime: number;
  platform_fee_pct: number;
  current_streak: number;
  next_tier: number | null;
  next_tier_label: HustleTierLabel | null;
  next_tier_spark_target: number | null;
  next_tier_spark_progress: number | null;
  next_tier_trust_gate: number | null;
}

export const HUSTLE_TIER_LADDER: {
  tier: number;
  label: HustleTierLabel;
  trustGate: number;
  sparkGate: number;
  description: string;
}[] = [
  { tier: 1, label: "Spark", trustGate: 0, sparkGate: 0, description: "30-second micro-tasks" },
  { tier: 2, label: "Flash", trustGate: 550, sparkGate: 20, description: "Faster gigs, higher rewards" },
  { tier: 3, label: "Gig", trustGate: 650, sparkGate: 35, description: "Multi-step earn tasks" },
  { tier: 4, label: "Pro", trustGate: 750, sparkGate: 50, description: "Premium client-style work" },
  { tier: 5, label: "Elite", trustGate: 850, sparkGate: 80, description: "Top reputation lane" },
];

export type HustleTransferDirection = "earn_to_play" | "play_to_earn";

export interface HustlePendingTransfer {
  id: string;
  direction: HustleTransferDirection;
  amount: number;
  fee: number;
  status: string;
  requested_at: string;
  completes_at: string | null;
}

export interface HustleWalletState {
  authenticated: boolean;
  hustle_cash: number;
  play_balance: number;
  daily_limit_earn_to_play: number;
  weekly_limit_earn_to_play: number;
  daily_used_earn_to_play: number;
  daily_used_play_to_earn: number;
  self_exclude_until: string | null;
  pending_transfers: HustlePendingTransfer[];
  cooling_threshold: number;
  earn_to_play_fee_pct: number;
  play_to_earn_fee_pct: number;
}

export type HustleGigCategory = "content" | "moderation" | "research" | "creative";

export type HustleGigSubmissionStatus =
  | "claimed"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";

export interface HustleOpenGig {
  gig_id: string;
  title: string;
  description: string;
  category: HustleGigCategory;
  reward_vibe: number;
  min_hustle_tier: number;
  slots_remaining: number;
  is_platform: boolean;
  poster_name: string;
  expires_at: string;
  status: string;
  proof_instructions: string | null;
  my_submission_status: HustleGigSubmissionStatus | null;
  my_submission_id: string | null;
}

export interface HustleMySubmission {
  submission_id: string;
  status: HustleGigSubmissionStatus;
  proof_text: string | null;
  proof_url: string | null;
  payout_vibe: number | null;
  claimed_at: string;
  submitted_at: string | null;
  resolved_at: string | null;
  gig_id: string;
  title: string;
  reward_vibe: number;
  is_platform: boolean;
  poster_id: string | null;
  poster_name: string;
}

export interface HustleMyPosting {
  gig_id: string;
  title: string;
  reward_vibe: number;
  status: string;
  slots: number;
  slots_filled: number;
  escrow_held: number;
  expires_at: string;
  created_at: string;
  pending_review: number;
}

export interface HustlePendingReview {
  submission_id: string;
  status: string;
  proof_text: string | null;
  proof_url: string | null;
  submitted_at: string | null;
  gig_id: string;
  title: string;
  reward_vibe: number;
  worker_name: string;
}

export interface HustleMarketplaceState {
  authenticated: boolean;
  hustle_tier: number;
  hustle_cash: number;
  can_post: boolean;
  open_gigs: HustleOpenGig[];
  my_submissions: HustleMySubmission[];
  my_postings: HustleMyPosting[];
  pending_reviews: HustlePendingReview[];
}

export interface HustleShareLedgerEntry {
  id: string;
  delta_shares: number;
  hustle_cash_delta: number;
  kind: string;
  created_at: string;
}

export interface HustleEquityState {
  authenticated: boolean;
  hustle_shares: number;
  hustle_cash: number;
  hustle_tier: number;
  floor_cash_value: number;
  convert_rate: number;
  floor_redeem_rate: number;
  max_shares: number;
  min_convert_tier: number;
  min_redeem_tier: number;
  daily_convert_limit: number;
  daily_converted_today: number;
  can_convert: boolean;
  can_redeem: boolean;
  history: HustleShareLedgerEntry[];
}

export function formatShares(shares: number): string {
  return shares.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export type HustleGovernanceCategory = "platform" | "economy" | "tasks" | "community";

export interface HustleGovernanceProposal {
  proposal_id: string;
  title: string;
  description: string;
  category: HustleGovernanceCategory;
  status: string;
  min_vote_tier: number;
  is_platform: boolean;
  ends_at: string;
  created_at: string;
  votes_for: number;
  votes_against: number;
  voter_count: number;
  my_vote: boolean | null;
  my_power: number | null;
  is_open: boolean;
  can_vote: boolean;
}

export interface HustleGovernanceState {
  authenticated: boolean;
  hustle_tier: number;
  voting_power: number;
  can_propose: boolean;
  min_propose_tier: number;
  proposals: HustleGovernanceProposal[];
}

export type HustleRegion = "global" | "eu" | "us" | "mena" | "latam";

export interface HustleWellnessState {
  authenticated: boolean;
  recovery_mode: boolean;
  recovery_until: string | null;
  self_exclude_until: string | null;
  daily_earn_cap: number | null;
  earned_today: number;
  earn_cap_remaining: number | null;
  region: HustleRegion;
  region_label: string;
  blocks_play_bridge: boolean;
  regional_gig_count: number;
}

export const HUSTLE_REGIONS: { id: HustleRegion; label: string; hint: string }[] = [
  { id: "global", label: "Global", hint: "Default platform gigs worldwide" },
  { id: "eu", label: "Europe", hint: "Privacy-first labeling tasks" },
  { id: "us", label: "United States", hint: "Election & finance research gigs" },
  { id: "mena", label: "MENA", hint: "Arabic-friendly caption tasks" },
  { id: "latam", label: "Latin America", hint: "Spanish/Portuguese share tasks" },
];

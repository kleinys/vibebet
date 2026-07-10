import "server-only";
import { createClient } from "@/lib/supabase/server";

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

function mapOpenGig(row: Record<string, unknown>): HustleOpenGig {
  return {
    gig_id: String(row.gig_id),
    title: String(row.title),
    description: String(row.description),
    category: row.category as HustleGigCategory,
    reward_vibe: Number(row.reward_vibe),
    min_hustle_tier: Number(row.min_hustle_tier),
    slots_remaining: Number(row.slots_remaining),
    is_platform: Boolean(row.is_platform),
    poster_name: String(row.poster_name),
    expires_at: String(row.expires_at),
    status: String(row.status),
    proof_instructions: row.proof_instructions ? String(row.proof_instructions) : null,
    my_submission_status: row.my_submission_status
      ? (String(row.my_submission_status) as HustleGigSubmissionStatus)
      : null,
    my_submission_id: row.my_submission_id ? String(row.my_submission_id) : null,
  };
}

function mapSubmission(row: Record<string, unknown>): HustleMySubmission {
  return {
    submission_id: String(row.submission_id),
    status: String(row.status) as HustleGigSubmissionStatus,
    proof_text: row.proof_text ? String(row.proof_text) : null,
    proof_url: row.proof_url ? String(row.proof_url) : null,
    payout_vibe: row.payout_vibe != null ? Number(row.payout_vibe) : null,
    claimed_at: String(row.claimed_at),
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
    resolved_at: row.resolved_at ? String(row.resolved_at) : null,
    gig_id: String(row.gig_id),
    title: String(row.title),
    reward_vibe: Number(row.reward_vibe),
    is_platform: Boolean(row.is_platform),
    poster_id: row.poster_id ? String(row.poster_id) : null,
    poster_name: String(row.poster_name),
  };
}

function mapPosting(row: Record<string, unknown>): HustleMyPosting {
  return {
    gig_id: String(row.gig_id),
    title: String(row.title),
    reward_vibe: Number(row.reward_vibe),
    status: String(row.status),
    slots: Number(row.slots),
    slots_filled: Number(row.slots_filled),
    escrow_held: Number(row.escrow_held),
    expires_at: String(row.expires_at),
    created_at: String(row.created_at),
    pending_review: Number(row.pending_review),
  };
}

function mapPendingReview(row: Record<string, unknown>): HustlePendingReview {
  return {
    submission_id: String(row.submission_id),
    status: String(row.status),
    proof_text: row.proof_text ? String(row.proof_text) : null,
    proof_url: row.proof_url ? String(row.proof_url) : null,
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
    gig_id: String(row.gig_id),
    title: String(row.title),
    reward_vibe: Number(row.reward_vibe),
    worker_name: String(row.worker_name),
  };
}

export async function getHustleMarketplace(): Promise<HustleMarketplaceState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_hustle_marketplace");
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as unknown as Record<string, unknown>;
  if (!row.authenticated) return null;

  const openGigs = Array.isArray(row.open_gigs)
    ? (row.open_gigs as Record<string, unknown>[]).map(mapOpenGig)
    : [];
  const mySubmissions = Array.isArray(row.my_submissions)
    ? (row.my_submissions as Record<string, unknown>[]).map(mapSubmission)
    : [];
  const myPostings = Array.isArray(row.my_postings)
    ? (row.my_postings as Record<string, unknown>[]).map(mapPosting)
    : [];
  const pendingReviews = Array.isArray(row.pending_reviews)
    ? (row.pending_reviews as Record<string, unknown>[]).map(mapPendingReview)
    : [];

  return {
    authenticated: true,
    hustle_tier: Number(row.hustle_tier ?? 1),
    hustle_cash: Number(row.hustle_cash ?? 0),
    can_post: Boolean(row.can_post),
    open_gigs: openGigs,
    my_submissions: mySubmissions,
    my_postings: myPostings,
    pending_reviews: pendingReviews,
  };
}

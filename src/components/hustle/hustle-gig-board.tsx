"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelHustleGig,
  claimHustleGig,
  postHustleGig,
  reviewHustleGigSubmission,
  submitHustleGigProof,
} from "@/app/play/actions";
import type {
  HustleGigCategory,
  HustleMarketplaceState,
  HustleMySubmission,
  HustleOpenGig,
  HustlePendingReview,
} from "@/lib/hustle/shared";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";

const CATEGORIES: { id: HustleGigCategory; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "moderation", label: "Moderation" },
  { id: "research", label: "Research" },
  { id: "creative", label: "Creative" },
];

export function HustleGigBoard({
  marketplace,
  hustleTier,
  onUpdate,
}: {
  marketplace: HustleMarketplaceState;
  hustleTier: number;
  onUpdate: () => void;
}) {
  const [showPost, setShowPost] = useState(false);
  const [pending, startTransition] = useTransition();

  const activeClaims = marketplace.my_submissions.filter((s) =>
    ["claimed", "submitted"].includes(s.status),
  );

  return (
    <section className="hustle-gig-board">
      <div className="hustle-gig-board__header">
        <div>
          <p className="hustle-gig-board__eyebrow">Gig marketplace</p>
          <h3 className="hustle-gig-board__title">Multi-step earn tasks</h3>
          <p className="hustle-gig-board__sub">
            Claim gigs, submit proof, get paid in Hustle Cash. Platform gigs auto-approve;
            community gigs need poster review.
          </p>
        </div>
        {marketplace.can_post && (
          <button
            type="button"
            className="hustle-gig-board__post-btn"
            onClick={() => setShowPost((v) => !v)}
          >
            {showPost ? "Close" : "Post gig"}
          </button>
        )}
      </div>

      {!marketplace.can_post && hustleTier < 3 && (
        <p className="hustle-gig-board__lock-hint">
          Unlock Gig tier (3) to post escrowed gigs. You can still claim platform gigs below.
        </p>
      )}

      {showPost && marketplace.can_post && (
        <PostGigForm
          hustleCash={marketplace.hustle_cash}
          pending={pending}
          onSubmit={(payload) => {
            startTransition(async () => {
              const result = await postHustleGig(payload);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Gig posted — Hustle Cash escrowed");
              setShowPost(false);
              onUpdate();
            });
          }}
        />
      )}

      {activeClaims.length > 0 && (
        <div className="hustle-gig-board__section">
          <h4 className="hustle-gig-board__section-title">Your active claims</h4>
          <ul className="hustle-gig-board__list">
            {activeClaims.map((sub) => (
              <ActiveClaimCard
                key={sub.submission_id}
                submission={sub}
                pending={pending}
                onUpdate={onUpdate}
              />
            ))}
          </ul>
        </div>
      )}

      {marketplace.pending_reviews.length > 0 && (
        <div className="hustle-gig-board__section">
          <h4 className="hustle-gig-board__section-title">Needs your review</h4>
          <ReviewQueue
            reviews={marketplace.pending_reviews}
            pending={pending}
            onUpdate={onUpdate}
          />
        </div>
      )}

      <div className="hustle-gig-board__section">
        <h4 className="hustle-gig-board__section-title">Open gigs</h4>
        {marketplace.open_gigs.length === 0 ? (
          <p className="text-sm text-zinc-500">No open gigs right now — check back soon.</p>
        ) : (
          <ul className="hustle-gig-board__list">
            {marketplace.open_gigs.map((gig) => (
              <OpenGigCard
                key={gig.gig_id}
                gig={gig}
                hustleTier={hustleTier}
                pending={pending}
                onClaim={() => {
                  startTransition(async () => {
                    const result = await claimHustleGig(gig.gig_id);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Gig claimed — submit proof when done");
                    onUpdate();
                  });
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {marketplace.my_postings.length > 0 && (
        <div className="hustle-gig-board__section">
          <h4 className="hustle-gig-board__section-title">Your postings</h4>
          <ul className="hustle-gig-board__postings">
            {marketplace.my_postings.map((p) => (
              <li key={p.gig_id} className="hustle-gig-board__posting">
                <div>
                  <p className="font-medium text-zinc-100">{p.title}</p>
                  <p className="text-xs text-zinc-500">
                    {formatVibe(p.reward_vibe)} VIBE · {p.slots_filled}/{p.slots} filled ·{" "}
                    {p.pending_review} pending review
                  </p>
                </div>
                {p.status === "open" && p.slots_filled === 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-xs text-rose-300 hover:text-rose-200"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await cancelHustleGig(p.gig_id);
                        if (result.error) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Gig cancelled — escrow refunded");
                        onUpdate();
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function OpenGigCard({
  gig,
  hustleTier,
  pending,
  onClaim,
}: {
  gig: HustleOpenGig;
  hustleTier: number;
  pending: boolean;
  onClaim: () => void;
}) {
  const tierLocked = hustleTier < gig.min_hustle_tier;
  const alreadyClaimed = Boolean(gig.my_submission_id);

  return (
    <li className={`hustle-gig-board__card ${tierLocked ? "hustle-gig-board__card--locked" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-zinc-100">{gig.title}</p>
            {gig.is_platform && (
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                Platform
              </span>
            )}
            <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
              {gig.category}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{gig.description}</p>
          {gig.proof_instructions && (
            <p className="mt-2 text-[10px] text-zinc-400">Proof: {gig.proof_instructions}</p>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-amber-200">
            <CurrencyIconVibe className="h-3.5 w-3.5" />
            {formatVibe(gig.reward_vibe)} Hustle Cash
            <span className="text-zinc-600">· by {gig.poster_name}</span>
          </p>
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>{gig.slots_remaining} slots</p>
          {tierLocked && <p className="text-rose-300">Tier {gig.min_hustle_tier}+</p>}
        </div>
      </div>
      {!tierLocked && !alreadyClaimed && (
        <button
          type="button"
          disabled={pending}
          onClick={onClaim}
          className="hustle-gig-board__claim-btn mt-3"
        >
          Claim gig
        </button>
      )}
      {alreadyClaimed && (
        <p className="mt-2 text-xs text-violet-300">
          You claimed this · status: {gig.my_submission_status}
        </p>
      )}
    </li>
  );
}

function ActiveClaimCard({
  submission,
  pending,
  onUpdate,
}: {
  submission: HustleMySubmission;
  pending: boolean;
  onUpdate: () => void;
}) {
  const [proof, setProof] = useState("");
  const [url, setUrl] = useState("");
  const [, startTransition] = useTransition();

  if (submission.status === "submitted" && !submission.is_platform) {
    return (
      <li className="hustle-gig-board__card">
        <p className="font-medium text-zinc-100">{submission.title}</p>
        <p className="mt-1 text-xs text-amber-200">Awaiting poster review…</p>
      </li>
    );
  }

  if (submission.status !== "claimed") return null;

  return (
    <li className="hustle-gig-board__card hustle-gig-board__card--active">
      <p className="font-medium text-zinc-100">{submission.title}</p>
      <p className="mt-1 text-xs text-zinc-500">
        +{formatVibe(submission.reward_vibe)} on approval
        {submission.is_platform && " (auto-approves)"}
      </p>
      <textarea
        value={proof}
        onChange={(e) => setProof(e.target.value)}
        placeholder="Paste your proof (30+ characters)…"
        className="hustle-gig-board__textarea mt-3"
        rows={4}
      />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Optional link (tweet, doc, market URL)"
        className="hustle-gig-board__input mt-2"
      />
      <button
        type="button"
        disabled={pending || proof.trim().length < 30}
        className="hustle-gig-board__claim-btn mt-3"
        onClick={() => {
          startTransition(async () => {
            const result = await submitHustleGigProof(
              submission.submission_id,
              proof,
              url || undefined,
            );
            if (result.error) {
              toast.error(result.error);
              return;
            }
            if (result.auto_approved) {
              toast.success(`Approved! +${formatVibe(result.payout ?? 0)} Hustle Cash`);
            } else {
              toast.success("Proof submitted — waiting for review");
            }
            onUpdate();
          });
        }}
      >
        Submit proof
      </button>
    </li>
  );
}

function ReviewQueue({
  reviews,
  pending,
  onUpdate,
}: {
  reviews: HustlePendingReview[];
  pending: boolean;
  onUpdate: () => void;
}) {
  const [, startTransition] = useTransition();

  return (
    <ul className="hustle-gig-board__list">
      {reviews.map((sub) => (
        <li key={sub.submission_id} className="hustle-gig-board__card">
          <p className="font-medium text-zinc-100">{sub.title}</p>
          <p className="text-[10px] text-zinc-500">Worker: {sub.worker_name}</p>
          <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">{sub.proof_text}</p>
          {sub.proof_url && (
            <a
              href={sub.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-violet-300 hover:underline"
            >
              {sub.proof_url}
            </a>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="hustle-gig-board__approve-btn"
              onClick={() => {
                startTransition(async () => {
                  const result = await reviewHustleGigSubmission(sub.submission_id, "approve");
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Approved — worker paid from escrow");
                  onUpdate();
                });
              }}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              className="hustle-gig-board__reject-btn"
              onClick={() => {
                startTransition(async () => {
                  const result = await reviewHustleGigSubmission(sub.submission_id, "reject");
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Rejected — escrow refunded");
                  onUpdate();
                });
              }}
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PostGigForm({
  hustleCash,
  pending,
  onSubmit,
}: {
  hustleCash: number;
  pending: boolean;
  onSubmit: (payload: {
    title: string;
    description: string;
    category: HustleGigCategory;
    reward: number;
    slots: number;
    minTier: number;
    proofInstructions: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HustleGigCategory>("content");
  const [reward, setReward] = useState("200");
  const [slots, setSlots] = useState("1");
  const [minTier, setMinTier] = useState("3");
  const [proofInstructions, setProofInstructions] = useState("");

  const parsedReward = Number(reward);
  const parsedSlots = Number(slots);
  const escrow =
    Number.isFinite(parsedReward) && Number.isFinite(parsedSlots)
      ? parsedReward * parsedSlots
      : 0;

  return (
    <div className="hustle-gig-board__post-form">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Gig title"
        className="hustle-gig-board__input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What should the worker do? (20+ chars)"
        className="hustle-gig-board__textarea"
        rows={3}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as HustleGigCategory)}
          className="hustle-gig-board__input"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={100}
          max={2000}
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          className="hustle-gig-board__input tabular-nums"
          placeholder="Reward per slot"
        />
        <input
          type="number"
          min={1}
          max={5}
          value={slots}
          onChange={(e) => setSlots(e.target.value)}
          className="hustle-gig-board__input tabular-nums"
          placeholder="Slots"
        />
        <input
          type="number"
          min={1}
          max={5}
          value={minTier}
          onChange={(e) => setMinTier(e.target.value)}
          className="hustle-gig-board__input tabular-nums"
          placeholder="Min worker tier"
        />
      </div>
      <input
        value={proofInstructions}
        onChange={(e) => setProofInstructions(e.target.value)}
        placeholder="Proof instructions (optional)"
        className="hustle-gig-board__input"
      />
      <p className="text-[10px] text-zinc-500">
        Escrow: {formatVibe(escrow)} VIBE (you have {formatVibe(hustleCash)}). Expires in 7 days.
      </p>
      <button
        type="button"
        disabled={pending || title.length < 5 || description.length < 20 || escrow > hustleCash}
        className="hustle-gig-board__claim-btn"
        onClick={() =>
          onSubmit({
            title,
            description,
            category,
            reward: parsedReward,
            slots: parsedSlots,
            minTier: Number(minTier),
            proofInstructions,
          })
        }
      >
        Post &amp; lock escrow
      </button>
    </div>
  );
}

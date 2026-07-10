"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  castHustleGovernanceVote,
  submitHustleGovernanceProposal,
} from "@/app/play/actions";
import type {
  HustleGovernanceCategory,
  HustleGovernanceProposal,
  HustleGovernanceState,
} from "@/lib/hustle/shared";

const CATEGORIES: { id: HustleGovernanceCategory; label: string }[] = [
  { id: "platform", label: "Platform" },
  { id: "economy", label: "Economy" },
  { id: "tasks", label: "Tasks" },
  { id: "community", label: "Community" },
];

export function HustleGovernancePanel({
  governance,
  onUpdate,
}: {
  governance: HustleGovernanceState;
  onUpdate: () => void;
}) {
  const [showPropose, setShowPropose] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = governance.proposals.filter((p) => p.is_open);

  return (
    <section className="hustle-gov-panel">
      <div className="hustle-gov-panel__header">
        <div>
          <p className="hustle-gov-panel__eyebrow">Hustle governance</p>
          <h3 className="hustle-gov-panel__title">Shape the earn loop</h3>
          <p className="hustle-gov-panel__sub">
            Advisory polls weighted by tier + shares. Your power:{" "}
            <strong>{governance.voting_power}</strong> (max 25).
          </p>
        </div>
        {governance.can_propose && (
          <button
            type="button"
            className="hustle-gov-panel__propose-btn"
            onClick={() => setShowPropose((v) => !v)}
          >
            {showPropose ? "Close" : "Propose"}
          </button>
        )}
      </div>

      {showPropose && governance.can_propose && (
        <ProposeForm
          pending={pending}
          onSubmit={(payload) => {
            startTransition(async () => {
              const result = await submitHustleGovernanceProposal(payload);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Proposal submitted — voting open 14 days");
              setShowPropose(false);
              onUpdate();
            });
          }}
        />
      )}

      {!governance.can_propose && governance.hustle_tier < governance.min_propose_tier && (
        <p className="hustle-gov-panel__lock-hint">
          Elite tier ({governance.min_propose_tier}) unlocks community proposals. Everyone
          Flash+ can vote on open polls.
        </p>
      )}

      <div className="hustle-gov-panel__section">
        <h4 className="hustle-gov-panel__section-title">
          {open.length > 0 ? "Open polls" : "Recent polls"}
        </h4>
        {governance.proposals.length === 0 ? (
          <p className="text-sm text-zinc-500">No polls yet.</p>
        ) : (
          <ul className="hustle-gov-panel__list">
            {governance.proposals.map((p) => (
              <ProposalCard
                key={p.proposal_id}
                proposal={p}
                votingPower={governance.voting_power}
                pending={pending}
                onVote={(support) => {
                  startTransition(async () => {
                    const result = await castHustleGovernanceVote(p.proposal_id, support);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(
                      support
                        ? `Voted FOR (${governance.voting_power} power)`
                        : `Voted AGAINST (${governance.voting_power} power)`,
                    );
                    onUpdate();
                  });
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProposalCard({
  proposal,
  votingPower,
  pending,
  onVote,
}: {
  proposal: HustleGovernanceProposal;
  votingPower: number;
  pending: boolean;
  onVote: (support: boolean) => void;
}) {
  const total = proposal.votes_for + proposal.votes_against;
  const forPct = total > 0 ? Math.round((proposal.votes_for / total) * 100) : 50;

  return (
    <li className={`hustle-gov-panel__card ${!proposal.is_open ? "hustle-gov-panel__card--closed" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-zinc-100">{proposal.title}</p>
        {proposal.is_platform && (
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-200">
            Platform
          </span>
        )}
        <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
          {proposal.category}
        </span>
        {!proposal.is_open && (
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-500">
            {proposal.status}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">{proposal.description}</p>

      <div className="hustle-gov-panel__bar mt-3" aria-hidden>
        <div className="hustle-gov-panel__bar-for" style={{ width: `${forPct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">
        {proposal.votes_for} for · {proposal.votes_against} against · {proposal.voter_count}{" "}
        voters
        {proposal.is_open && (
          <> · ends {new Date(proposal.ends_at).toLocaleDateString()}</>
        )}
      </p>

      {proposal.is_open && proposal.can_vote && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            className={`hustle-gov-panel__vote-btn ${proposal.my_vote === true ? "is-active" : ""}`}
            onClick={() => onVote(true)}
          >
            For (+{votingPower})
          </button>
          <button
            type="button"
            disabled={pending}
            className={`hustle-gov-panel__vote-btn hustle-gov-panel__vote-btn--against ${proposal.my_vote === false ? "is-active" : ""}`}
            onClick={() => onVote(false)}
          >
            Against (+{votingPower})
          </button>
        </div>
      )}

      {proposal.is_open && !proposal.can_vote && (
        <p className="mt-2 text-[10px] text-amber-200">
          Tier {proposal.min_vote_tier}+ required to vote.
        </p>
      )}

      {proposal.my_vote !== null && (
        <p className="mt-2 text-[10px] text-violet-300">
          You voted {proposal.my_vote ? "FOR" : "AGAINST"} with {proposal.my_power ?? votingPower}{" "}
          power
        </p>
      )}
    </li>
  );
}

function ProposeForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (payload: {
    title: string;
    description: string;
    category: HustleGovernanceCategory;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<HustleGovernanceCategory>("community");

  return (
    <div className="hustle-gov-panel__propose-form">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Proposal title (10+ chars)"
        className="hustle-gov-panel__input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What should change and why? (20+ chars)"
        className="hustle-gov-panel__textarea"
        rows={3}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as HustleGovernanceCategory)}
        className="hustle-gov-panel__input"
      >
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || title.length < 10 || description.length < 20}
        className="hustle-gov-panel__submit"
        onClick={() => onSubmit({ title, description, category })}
      >
        Submit for 14-day vote
      </button>
    </div>
  );
}

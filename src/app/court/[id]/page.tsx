import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDispute, getVoteEligibility, timeRemaining } from "@/lib/court";
import { VotePanel } from "@/components/court-vote-panel";
import { formatVibe } from "@/lib/utils";
import { CATEGORY_LABELS, type MarketCategory } from "@/lib/supabase/types";

export const revalidate = 0;

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dispute = await getDispute(id);
  if (!dispute) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const eligibility = await getVoteEligibility(dispute, user?.id ?? null);

  // Joined display info
  const claimedLabel = dispute.claimed_outcome
    ? dispute.outcome_yes_label
    : dispute.outcome_no_label;
  const proposedLabel = dispute.proposed_outcome
    ? dispute.outcome_yes_label
    : dispute.outcome_no_label;
  const total = dispute.votes_overturn + dispute.votes_uphold;
  const overturnPct = total > 0 ? Math.round((dispute.votes_overturn / total) * 100) : 50;
  const isVoting = dispute.status === "voting";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/court" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Active disputes
      </Link>

      <header className="mt-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
          <span className="rounded bg-zinc-800/60 px-2 py-0.5">
            {CATEGORY_LABELS[dispute.category as MarketCategory] ?? dispute.category}
          </span>
          <StatusPill status={dispute.status} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold leading-snug">
          {dispute.question}
        </h1>
        <p className="mt-2 text-xs text-zinc-500">
          <Link
            href={`/markets/${dispute.market_id}`}
            className="text-fuchsia-400 hover:underline"
          >
            View market →
          </Link>
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-xs uppercase tracking-wider text-amber-300">
            Disputer claims
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-200">
            {claimedLabel}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-700/30 bg-zinc-900/40 p-4">
          <div className="text-xs uppercase tracking-wider text-zinc-400">
            Admin proposed
          </div>
          <div className="mt-1 text-xl font-semibold text-zinc-200">
            {proposedLabel}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Tally
          </h2>
          {isVoting && (
            <span className="text-xs text-amber-300">
              Voting ends in {timeRemaining(dispute.voting_ends_at)}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-amber-300">
            Overturn · {dispute.votes_overturn}
          </span>
          <span className="text-zinc-500">{total} votes</span>
          <span className="text-zinc-300">
            Uphold · {dispute.votes_uphold}
          </span>
        </div>
        <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${overturnPct}%` }}
          />
        </div>
        <div className="mt-3 text-[11px] text-zinc-500">
          Stake on the line: {formatVibe(dispute.stake_amount)} VIBE
          {isVoting
            ? " — refunded if overturn wins, burned otherwise."
            : ` — ${dispute.status === "overturned" ? "refunded" : "burned"}.`}
        </div>
      </section>

      {dispute.reasoning && (
        <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Reasoning
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">
            {dispute.reasoning}
          </p>
        </section>
      )}

      {isVoting && (
        <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Cast your vote
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Resolution poll — anyone can vote. First vote free; extra votes
            cost 50, 100, 150… VIBE (same side only).
          </p>
          <div className="mt-3">
            <VotePanel
              disputeId={dispute.id}
              overturnLabel={claimedLabel}
              upholdLabel={proposedLabel}
              eligibility={eligibility}
            />
          </div>
        </section>
      )}

      {!isVoting && (
        <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Resolution
          </h2>
          <p className="mt-3 text-sm text-zinc-300">
            {dispute.status === "overturned" && (
              <>
                Court <span className="text-amber-300 font-medium">overturned</span>{" "}
                the proposed outcome. Market now resolved as{" "}
                <span className="font-medium">{claimedLabel}</span>.
              </>
            )}
            {dispute.status === "upheld" && (
              <>
                Court <span className="text-zinc-200 font-medium">upheld</span>{" "}
                the proposed outcome. Market resolved as{" "}
                <span className="font-medium">{proposedLabel}</span>.
              </>
            )}
            {dispute.status === "expired" && (
              <>
                Voting closed with zero votes. Treated as uphold — market
                resolved as <span className="font-medium">{proposedLabel}</span>.
              </>
            )}
          </p>
        </section>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    voting: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    overturned: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    upheld: "bg-zinc-700/30 text-zinc-300 ring-zinc-600/40",
    expired: "bg-zinc-700/30 text-zinc-300 ring-zinc-600/40",
  };
  const labels: Record<string, string> = {
    voting: "Voting",
    overturned: "Overturned",
    upheld: "Upheld",
    expired: "Expired",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 ring-1 ${styles[status] ?? styles.upheld}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

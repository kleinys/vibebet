import Link from "next/link";
import { listActiveDisputes, timeRemaining, type DisputeWithMarket } from "@/lib/court";
import { createClient } from "@/lib/supabase/server";
import { formatVibe } from "@/lib/utils";
import { CATEGORY_LABELS, type MarketCategory } from "@/lib/supabase/types";

export const revalidate = 0;

const FILTERS = [
  { id: "active", label: "Active" },
  { id: "history", label: "History" },
  { id: "all", label: "All" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function CourtPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterId = (FILTERS.find((f) => f.id === params.filter)?.id ??
    "active") as FilterId;

  let disputes: DisputeWithMarket[];
  if (filterId === "active") {
    disputes = await listActiveDisputes();
  } else {
    // Fetch directly with the chosen status filter; reuse the join helper
    // pattern from listActiveDisputes inline.
    const supabase = await createClient();
    const baseQuery = supabase
      .from("disputes")
      .select(
        "id, market_id, initiator_id, claimed_outcome, proposed_outcome, claimed_outcome_index, proposed_outcome_index, stake_amount, reasoning, status, voting_starts_at, voting_ends_at, votes_overturn, votes_uphold, resolved_at, created_at, markets!inner(question, outcome_yes_label, outcome_no_label, category)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    const { data } =
      filterId === "history"
        ? await baseQuery.neq("status", "voting")
        : await baseQuery;
    disputes = (data ?? []).map((d) => {
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Resolution Polls</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          When a market resolution is proposed, holders can dispute within 24h.
          Then a one-time community poll runs for 48h. Anyone can vote — first
          vote free, extra votes cost escalating VIBE.{" "}
          <Link href="/guide" className="text-fuchsia-400 hover:underline">
            Read the playbook
          </Link>
          .
        </p>
      </header>

      <div className="mt-6 flex items-center gap-1 text-xs">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "active" ? "/court" : `/court?filter=${f.id}`}
            className={
              f.id === filterId
                ? "rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-100"
                : "rounded-md px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
            }
          >
            {f.label}
          </Link>
        ))}
      </div>

      {disputes.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
          {filterId === "active"
            ? "No active disputes. Dispute a market resolution from its detail page while it's in the 24-hour challenge window."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {disputes.map((d) => {
            const total = d.votes_overturn + d.votes_uphold;
            const overturnPct = total > 0 ? Math.round((d.votes_overturn / total) * 100) : 0;
            const isVoting = d.status === "voting";
            return (
              <li key={d.id}>
                <Link
                  href={`/court/${d.id}`}
                  className="block rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-white/10 hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                        <span className="rounded bg-zinc-800/60 px-2 py-0.5">
                          {CATEGORY_LABELS[d.category as MarketCategory] ?? d.category}
                        </span>
                        <StatusPill status={d.status} />
                      </div>
                      <h2 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-zinc-100">
                        {d.question}
                      </h2>
                      <p className="mt-2 text-xs text-zinc-400">
                        Disputer claims:{" "}
                        <span className="font-medium text-emerald-300">
                          {d.claimed_outcome ? d.outcome_yes_label : d.outcome_no_label}
                        </span>{" "}
                        — Admin proposed:{" "}
                        <span className="font-medium text-rose-300">
                          {d.proposed_outcome ? d.outcome_yes_label : d.outcome_no_label}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-zinc-500">
                        Stake {formatVibe(d.stake_amount)} VIBE
                      </div>
                      <div className="mt-1 text-xs font-medium text-amber-300">
                        {isVoting
                          ? `Voting ends in ${timeRemaining(d.voting_ends_at)}`
                          : d.resolved_at
                            ? `Closed ${new Date(d.resolved_at).toLocaleDateString()}`
                            : "Closed"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Overturn {d.votes_overturn}</span>
                      <span>{total} votes</span>
                      <span>Uphold {d.votes_uphold}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${overturnPct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
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

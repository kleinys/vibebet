import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account-nav";
import { formatVibe } from "@/lib/utils";
import { timeRemaining } from "@/lib/court";

export const revalidate = 0;

export default async function AccountDisputesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/disputes");

  const { data: disputes, error } = await supabase
    .from("disputes")
    .select(
      "id, market_id, claimed_outcome, proposed_outcome, stake_amount, status, voting_starts_at, voting_ends_at, votes_overturn, votes_uphold, resolved_at, created_at, markets!inner(question, outcome_yes_label, outcome_no_label)",
    )
    .eq("initiator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Account</h1>
        <AccountNav active="/account/disputes" />
        <p className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/disputes" />

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Disputes you filed ({disputes?.length ?? 0})
        </h2>

        {!disputes || disputes.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            You haven&apos;t filed any disputes yet.{" "}
            <Link href="/court" className="text-fuchsia-400 hover:underline">
              Visit the court
            </Link>{" "}
            to see active cases, or dispute a market resolution from its
            detail page during the 24-hour challenge window.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {disputes.map((d) => {
              const m = Array.isArray(d.markets) ? d.markets[0] : d.markets;
              const claimedLabel = d.claimed_outcome
                ? (m?.outcome_yes_label ?? "Yes")
                : (m?.outcome_no_label ?? "No");
              const settled = d.status !== "voting";
              const won = d.status === "overturned";
              return (
                <li
                  key={d.id}
                  className="rounded-lg border border-white/5 bg-zinc-900/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/court/${d.id}`}
                        className="block truncate text-sm font-medium text-zinc-100 hover:underline"
                      >
                        {m?.question ?? "Unknown market"}
                      </Link>
                      <div className="mt-1 text-xs text-zinc-400">
                        You claimed:{" "}
                        <span className="font-medium text-amber-300">
                          {claimedLabel}
                        </span>
                        {" · Tally "}
                        <span className="tabular-nums">
                          {d.votes_overturn} overturn / {d.votes_uphold} uphold
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                    <span>
                      Stake{" "}
                      <span className="tabular-nums text-zinc-300">
                        {formatVibe(d.stake_amount)} VIBE
                      </span>
                      {settled &&
                        (won ? (
                          <span className="text-emerald-300"> · refunded</span>
                        ) : (
                          <span className="text-rose-300"> · forfeited</span>
                        ))}
                    </span>
                    <span>
                      Filed{" "}
                      {new Date(d.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {!settled && (
                      <span className="text-amber-300">
                        Voting ends in {timeRemaining(d.voting_ends_at)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    voting: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    overturned: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    upheld: "bg-zinc-700/30 text-zinc-300 ring-zinc-600/40",
    expired: "bg-zinc-700/30 text-zinc-300 ring-zinc-600/40",
  };
  const labels: Record<string, string> = {
    voting: "Voting",
    overturned: "You won",
    upheld: "You lost",
    expired: "Expired",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        styles[status] ?? styles.upheld
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

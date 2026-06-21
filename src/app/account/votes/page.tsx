import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account-nav";
import { timeRemaining } from "@/lib/court";

export const revalidate = 0;

export default async function AccountVotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/votes");

  // Join: court_votes -> disputes -> markets
  const { data: votes, error } = await supabase
    .from("court_votes")
    .select(
      "overturn, created_at, disputes!inner(id, market_id, status, voting_ends_at, claimed_outcome, proposed_outcome, votes_overturn, votes_uphold, markets!inner(question, outcome_yes_label, outcome_no_label))",
    )
    .eq("voter_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Account</h1>
        <AccountNav active="/account/votes" />
        <p className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/votes" />

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Cases you voted on ({votes?.length ?? 0})
        </h2>

        {!votes || votes.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
            You haven&apos;t voted on any cases yet.{" "}
            <Link href="/court" className="text-fuchsia-400 hover:underline">
              Visit the court
            </Link>{" "}
            to see active cases. You can vote on disputes for markets you
            haven&apos;t traded in.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {votes.map((v, idx) => {
              const d = Array.isArray(v.disputes) ? v.disputes[0] : v.disputes;
              if (!d) return null;
              const m = Array.isArray(d.markets) ? d.markets[0] : d.markets;
              const yourSideLabel = v.overturn
                ? d.claimed_outcome
                  ? (m?.outcome_yes_label ?? "Yes")
                  : (m?.outcome_no_label ?? "No")
                : d.proposed_outcome
                  ? (m?.outcome_yes_label ?? "Yes")
                  : (m?.outcome_no_label ?? "No");
              const yourSide = v.overturn ? "overturn" : "uphold";
              const settled = d.status !== "voting";
              const youWon =
                (v.overturn && d.status === "overturned") ||
                (!v.overturn && (d.status === "upheld" || d.status === "expired"));

              return (
                <li
                  key={`${d.id}-${idx}`}
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
                        You voted{" "}
                        <span
                          className={
                            yourSide === "overturn"
                              ? "font-medium text-amber-300"
                              : "font-medium text-zinc-200"
                          }
                        >
                          {yourSide}
                        </span>
                        {" → "}
                        <span className="text-zinc-300">{yourSideLabel}</span>
                      </div>
                    </div>
                    {settled ? (
                      <span
                        className={
                          youWon
                            ? "shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30"
                            : "shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-rose-500/30"
                        }
                      >
                        {youWon ? "With majority" : "Against majority"}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
                        Open
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-500">
                    Tally:{" "}
                    <span className="tabular-nums">
                      {d.votes_overturn} overturn / {d.votes_uphold} uphold
                    </span>
                    {" · Voted "}
                    {new Date(v.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {!settled && (
                      <>
                        {" · "}
                        <span className="text-amber-300">
                          ends in {timeRemaining(d.voting_ends_at)}
                        </span>
                      </>
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

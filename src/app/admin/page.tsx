import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllFlags } from "@/lib/feature-flags";
import { listMarkets } from "@/lib/markets";
import { listCategoricalMarkets } from "@/lib/categorical";
import { ResolveMarketForm } from "@/components/resolve-market-form";
import { ResolveCategoricalForm } from "@/components/resolve-categorical-form";
import { AdminSeedPanel } from "@/components/admin-seed-panel";
import { AdminFlagsPanel } from "@/components/admin-flags-panel";
import { AdminSuggestionsPanel } from "@/components/admin-suggestions-panel";
import { AdminTournamentPanel } from "@/components/admin-tournament-panel";
import { AdminAnalyticsPanel } from "@/components/admin-analytics-panel";
import { AdminMetricsPanel } from "@/components/admin-metrics-panel";
import { getCatalogStats } from "@/lib/platform-activity";
import { listPendingSuggestionsForAdmin } from "@/lib/creator-hub";
import { getActiveTournament } from "@/lib/tournaments";
import { isEnabled } from "@/lib/feature-flags";

/**
 * Admin dashboard. Gated by `app_metadata.role = 'admin'` on the JWT.
 *
 * To promote a user to admin, run (as service role):
 *   await supabase.auth.admin.updateUserById(userId, {
 *     app_metadata: { role: "admin" },
 *   });
 * The change takes effect on the user's next token refresh (≤ jwt_expiry).
 */
export const revalidate = 0;

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">
          You are signed in, but this account is not an admin.
        </p>
        <pre className="mt-4 overflow-auto rounded-md border border-white/5 bg-zinc-900 p-3 text-xs text-zinc-400">
          {JSON.stringify({ userId: user.id, role: role ?? null }, null, 2)}
        </pre>
      </div>
    );
  }

  const [flags, openBinary, openCategorical, catalogStats, suggestionsEnabled, tournamentPayoutsOn, analyticsOn, metricsOn, tournament] =
    await Promise.all([
    getAllFlags(),
    listMarkets({ status: "open", limit: 100 }),
    listCategoricalMarkets({ status: "open", limit: 50 }),
    getCatalogStats(),
    isEnabled("market_suggestions_enabled"),
    isEnabled("tournament_payouts_enabled"),
    isEnabled("analytics_dashboard_enabled"),
    isEnabled("product_metrics_enabled"),
    isEnabled("tournament_payouts_enabled").then((on) =>
      on ? getActiveTournament() : Promise.resolve(null),
    ),
  ]);

  const pendingSuggestions = suggestionsEnabled
    ? await listPendingSuggestionsForAdmin().catch(() => [])
    : [];

  // Markets currently in the challenge / court flow (separate section).
  const supabaseClient = await createClient();
  const { data: pendingMarkets } = await supabaseClient
    .from("markets")
    .select(
      "id, question, status, proposed_outcome, challenge_deadline, voting_ends_at, outcome_yes_label, outcome_no_label",
    )
    .in("status", ["resolving", "in_court"])
    .order("challenge_deadline", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-1 text-sm text-zinc-400">Phase 1 admin tools.</p>

      <AdminFlagsPanel flags={flags} />

      <AdminSeedPanel stats={catalogStats} />

      {metricsOn && <AdminMetricsPanel />}

      {analyticsOn && <AdminAnalyticsPanel />}

      {tournamentPayoutsOn && tournament && (
        <AdminTournamentPanel
          tournamentId={tournament.id}
          prizePool={tournament.prize_pool}
          sponsorName={tournament.sponsor_name}
        />
      )}

      {suggestionsEnabled && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Market suggestions ({pendingSuggestions.length})
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Spawn launches a community market with 500 VIBE platform subsidy.
            Suggester gets creator credit and volume bonuses.
          </p>
          <AdminSuggestionsPanel suggestions={pendingSuggestions} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Propose resolution
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Proposing kicks off a 24h challenge window. If no dispute opens,
          payouts settle automatically. If a dispute opens, the market enters
          Meme Court for a 48h community vote.
        </p>
        {openBinary.length === 0 && openCategorical.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No open markets.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {openBinary.map((m) => (
              <ResolveMarketForm
                key={m.id}
                marketId={m.id}
                question={m.question}
                yesLabel={m.outcome_yes_label}
                noLabel={m.outcome_no_label}
              />
            ))}
            {openCategorical.map((m) => (
              <ResolveCategoricalForm
                key={m.id}
                marketId={m.id}
                question={m.question}
                outcomes={m.outcomes.map((o) => ({
                  outcome_index: o.outcome_index,
                  label: o.label,
                }))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          In flight ({pendingMarkets?.length ?? 0})
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Markets currently in the challenge window or under court review.
          Finalization is automatic.
        </p>
        {!pendingMarkets || pendingMarkets.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Nothing pending.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm">
            {pendingMarkets.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-zinc-900/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-zinc-200">{m.question}</div>
                  <div className="text-[11px] text-zinc-500">
                    {m.status === "resolving" ? (
                      <>
                        Proposed{" "}
                        <span className="font-medium text-emerald-300">
                          {m.proposed_outcome
                            ? m.outcome_yes_label
                            : m.outcome_no_label}
                        </span>{" "}
                        — challenge ends{" "}
                        {m.challenge_deadline
                          ? new Date(m.challenge_deadline).toLocaleString()
                          : "?"}
                      </>
                    ) : (
                      <>
                        In court — voting ends{" "}
                        {m.voting_ends_at
                          ? new Date(m.voting_ends_at).toLocaleString()
                          : "?"}
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ring-1 ${
                    m.status === "resolving"
                      ? "bg-blue-500/10 text-blue-300 ring-blue-500/30"
                      : "bg-amber-500/10 text-amber-300 ring-amber-500/30"
                  }`}
                >
                  {m.status === "resolving" ? "challenge" : "court"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { getProductMetrics } from "@/lib/product-metrics";

export async function AdminMetricsPanel() {
  const metrics = await getProductMetrics(7);

  if (!metrics) {
    return (
      <section className="mt-10 rounded-xl border border-rose-500/25 bg-rose-500/5 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-200">
          Product metrics
        </h2>
        <p className="mt-2 text-xs text-zinc-500">Unable to load metrics.</p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-xl border border-rose-500/25 bg-rose-500/5 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-rose-200">
        Product metrics (last {metrics.period_days} days)
      </h2>
      <p className="mt-1 text-xs text-rose-200/70">
        Ship to 50 users and watch these numbers before building more features.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Signups" value={metrics.signups} target="50+" />
        <MetricCard
          label="First-bet rate"
          value={`${metrics.first_bet_rate_pct}%`}
          target=">60%"
        />
        <MetricCard
          label="D1 retention"
          value={`${metrics.d1_retention_pct}%`}
          target=">30%"
        />
        <MetricCard
          label="D7 retention"
          value={`${metrics.d7_retention_pct}%`}
          target=">15%"
        />
        <MetricCard label="Active traders" value={metrics.active_traders} />
        <MetricCard label="Disputes opened" value={metrics.disputes_opened} />
        <MetricCard label="Court votes" value={metrics.court_votes} />
        <MetricCard
          label="Votes / dispute"
          value={metrics.votes_per_dispute}
          target=">5"
        />
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  target,
}: {
  label: string;
  value: string | number;
  target?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-zinc-900/40 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
      {target && (
        <p className="mt-0.5 text-[10px] text-zinc-500">Target: {target}</p>
      )}
    </div>
  );
}

import {
  fetchAnalyticsSummary,
  fetchRecentAnalyticsEvents,
} from "@/app/admin/analytics-actions";

export async function AdminAnalyticsPanel() {
  const [summary, recent] = await Promise.all([
    fetchAnalyticsSummary(7).catch(() => []),
    fetchRecentAnalyticsEvents(25).catch(() => []),
  ]);

  const totalEvents = summary.reduce((n, r) => n + r.event_count, 0);

  return (
    <section className="mt-10 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-200">
        Product analytics (7 days)
      </h2>
      <p className="mt-1 text-xs text-cyan-200/70">
        {totalEvents.toLocaleString()} events tracked in DB. Set{" "}
        <code className="rounded bg-zinc-900 px-1">NEXT_PUBLIC_POSTHOG_KEY</code>{" "}
        and enable <code className="rounded bg-zinc-900 px-1">posthog_forward_enabled</code>{" "}
        to mirror live.
      </p>

      {summary.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No events yet.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2 text-right">Count</th>
                <th className="px-3 py-2 text-right">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {summary.map((row) => (
                <tr key={row.event_name}>
                  <td className="px-3 py-2 font-mono text-xs">{row.event_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.event_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.unique_users.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action="/api/admin/analytics/export" method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-xs text-zinc-400">
          Export CSV since
          <select
            name="days"
            defaultValue="7"
            className="mt-1 block rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm"
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-500"
        >
          Download CSV
        </button>
      </form>

      {recent.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Latest events
          </h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-400">
            {recent.map((e) => (
              <li key={e.id} className="font-mono">
                {new Date(e.created_at).toLocaleString()} · {e.event_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

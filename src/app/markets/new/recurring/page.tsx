import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { listMyRecurringSeries } from "@/lib/recurring-series";
import { formatCreatorFeeBps, formatInterval } from "@/lib/utils";
import { RecurringSeriesForm, SeriesToggleButton } from "./recurring-form";

export default async function RecurringSeriesPage() {
  const enabled = await isEnabled("recurring_series_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Recurring series off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">recurring_series_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/markets/new/recurring");

  const mySeries = await listMyRecurringSeries(user.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link href="/markets/new" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← One-shot market
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Recurring Up/Down series</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Spawn a new betting window on a timer — like Polymarket&apos;s BTC 5m, but
        you own the series. Pick asset + interval; each window auto-resolves from
        live price and the next one opens. You can charge a small fee on every bet.
      </p>

      <RecurringSeriesForm />

      {mySeries.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold text-zinc-200">Your series</h2>
          <ul className="mt-3 space-y-2">
            {mySeries.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-zinc-900/40 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-zinc-500">
                    {s.fast_asset.toUpperCase()} · {formatInterval(s.interval_sec)} ·
                    fee {formatCreatorFeeBps(s.creator_fee_bps)} · {s.windows_spawned}{" "}
                    windows
                    {!s.enabled && " · paused"}
                  </p>
                </div>
                <SeriesToggleButton seriesId={s.id} enabled={s.enabled} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

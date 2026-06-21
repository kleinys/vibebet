import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { listFastMarkets, tickFastMarkets } from "@/lib/fast-markets";
import { fetchCryptoSpotPrices, FAST_ASSET_ICONS } from "@/lib/crypto-prices";
import { formatUsdPrice, formatInterval } from "@/lib/utils";
import { listPublicRecurringSeries } from "@/lib/recurring-series";
import { formatProbability } from "@/lib/cpmm";
import { FastCountdown } from "@/components/fast-countdown";

export const revalidate = 0;

export default async function FastMarketsPage() {
  const enabled = await isEnabled("fast_markets_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Fast markets are off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">fast_markets_enabled</code> in{" "}
          <Link href="/admin" className="text-fuchsia-400 hover:underline">
            Admin
          </Link>
          .
        </p>
      </div>
    );
  }

  const prices = await fetchCryptoSpotPrices();
  await tickFastMarkets(prices);
  const [markets, communitySeries] = await Promise.all([
    listFastMarkets(24, "crypto"),
    listPublicRecurringSeries(8),
  ]);
  const priceByAsset = new Map(prices.map((p) => [p.asset, p.price]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/markets" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← All markets
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Fast markets</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Crypto Up or Down windows — platform 1m & 5m, plus community
            series. Auto-resolved from live spot price.
          </p>
        </div>
        <Link
          href="/markets/new/recurring"
          className="rounded-md border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/10"
        >
          Start your series
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {prices.map((p) => (
          <div
            key={p.asset}
            className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {FAST_ASSET_ICONS[p.asset]} {p.label} spot
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatUsdPrice(p.price)}
            </p>
          </div>
        ))}
      </div>

      {markets.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-white/10 p-12 text-center text-sm text-zinc-400">
          Spawning windows… Reload in a few seconds, or visit{" "}
          <Link href="/admin" className="text-fuchsia-400 hover:underline">
            Admin
          </Link>{" "}
          to confirm the platform bot is configured.
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 lg:grid-cols-2">
          {markets.map((m) => {
            const asset = m.fast_asset ?? "btc";
            const spot = priceByAsset.get(asset as "btc" | "eth" | "sol");
            const strike = m.strike_price ?? 0;
            const up = spot != null && spot >= strike;
            return (
              <li key={m.id}>
                <Link
                  href={`/markets/${m.id}`}
                  className="flex flex-col rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-amber-500/30 hover:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-amber-400/90">
                        {m.fast_interval_sec
                          ? m.fast_interval_sec >= 120
                            ? `${m.fast_interval_sec / 60} min`
                            : `${m.fast_interval_sec}s`
                          : "Fast"}{" "}
                        · {asset.toUpperCase()}
                        {m.recurring_series_id && " · community"}
                      </p>
                      <h2 className="mt-1 text-sm font-medium leading-snug">
                        {m.question}
                      </h2>
                    </div>
                    {m.window_end && <FastCountdown windowEnd={m.window_end} />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-emerald-500/5 px-2.5 py-1.5 ring-1 ring-emerald-500/10">
                      <span className="text-emerald-200">Up</span>
                      <span className="float-right tabular-nums">
                        {formatProbability(m.yes_price)}
                      </span>
                    </div>
                    <div className="rounded-md bg-rose-500/5 px-2.5 py-1.5 ring-1 ring-rose-500/10">
                      <span className="text-rose-200">Down</span>
                      <span className="float-right tabular-nums">
                        {formatProbability(1 - m.yes_price)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Strike {formatUsdPrice(strike)}
                    {spot != null && (
                      <>
                        {" · "}
                        Now {formatUsdPrice(spot)}{" "}
                        <span className={up ? "text-emerald-400" : "text-orange-400"}>
                          ({up ? "above" : "below"} strike)
                        </span>
                      </>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {communitySeries.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-200">
            Community recurring series
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
            {communitySeries.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-white/5 bg-zinc-900/40 px-3 py-1.5"
              >
                {s.title} · {s.fast_asset.toUpperCase()} ·{" "}
                {formatInterval(s.interval_sec)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

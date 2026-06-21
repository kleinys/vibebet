import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { listFastMarkets, tickFastMarkets } from "@/lib/fast-markets";
import {
  fetchLiveArenaPrices,
  pricesToTickPayload,
} from "@/lib/live-arena-prices";
import { isUsEquitySessionOpen } from "@/lib/equity-prices";
import { formatProbability } from "@/lib/cpmm";
import { formatUsdPrice } from "@/lib/utils";
import { MarketCard } from "@/components/market-card";

export const revalidate = 0;

export default async function EquitiesPage() {
  const enabled = await isEnabled("equities_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Equities off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">equities_enabled</code> in Admin, then
          apply migration phase 26.
        </p>
        <Link href="/games" className="mt-4 inline-block text-sm text-sky-400 hover:underline">
          ← Live Arena
        </Link>
      </div>
    );
  }

  const sessionOpen = isUsEquitySessionOpen();
  const prices = await fetchLiveArenaPrices({ cryptoOn: false, equitiesOn: true });
  const payload = pricesToTickPayload(prices);
  if (payload.length > 0) await tickFastMarkets(payload);

  const markets = await listFastMarkets(24, "finance");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/games" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Live Arena
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Equities Up/Down</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        15-minute windows on curated US stocks. Oracle resolves Up vs Down at the
        bell — same engine as crypto fast markets, but only during NYSE regular
        hours (Mon–Fri 9:30–16:00 ET).
      </p>
      {!sessionOpen && (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          US market is closed — new stock windows spawn when the session opens.
          You can still view resolving windows below.
        </p>
      )}

      {prices.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {prices.map((p) => (
            <div
              key={p.asset}
              className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wider text-sky-400/80">
                {p.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatUsdPrice(p.price)}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-200">Open windows</h2>
        {markets.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No open equity windows right now.
            {sessionOpen ? " They spawn automatically on the next price tick." : ""}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((m) => (
              <li key={m.id}>
                <MarketCard market={m} />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Up {formatProbability(m.yes_price)} · strike{" "}
                  {m.strike_price != null ? formatUsdPrice(Number(m.strike_price)) : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

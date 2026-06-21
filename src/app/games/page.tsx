import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { listFastMarkets, tickFastMarkets } from "@/lib/fast-markets";
import { getActiveSpectatorDuels } from "@/lib/duels";
import { getActivePaperDuels } from "@/lib/paper-duels";
import { LiveArenaBoard } from "@/components/live-arena-board";
import {
  fetchLiveArenaPrices,
  pricesToTickPayload,
} from "@/lib/live-arena-prices";

export const revalidate = 0;

export default async function GamesPage() {
  const [arenaOn, fastOn, equitiesOn, duelsOn, spectatorOn, paperOn, liveEventsOn] =
    await Promise.all([
      isEnabled("live_arena_enabled"),
      isEnabled("fast_markets_enabled"),
      isEnabled("equities_enabled"),
      isEnabled("duels_enabled"),
      isEnabled("duel_spectator_markets_enabled"),
      isEnabled("paper_trading_duels_enabled"),
      isEnabled("live_events_enabled"),
    ]);

  if (!arenaOn && !fastOn && !equitiesOn && !duelsOn && !paperOn && !liveEventsOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Live Arena off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">live_arena_enabled</code> or{" "}
          <code className="font-mono">fast_markets_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const prices = await fetchLiveArenaPrices({
    cryptoOn: fastOn || paperOn,
    equitiesOn,
  });
  const payload = pricesToTickPayload(prices);
  if ((fastOn || equitiesOn) && payload.length > 0) {
    await tickFastMarkets(payload);
  }

  const [windows, equityWindows, duels, paperRaces] = await Promise.all([
    fastOn ? listFastMarkets(24, "crypto") : Promise.resolve([]),
    equitiesOn ? listFastMarkets(12, "finance") : Promise.resolve([]),
    duelsOn && spectatorOn ? getActiveSpectatorDuels(12) : Promise.resolve([]),
    paperOn ? getActivePaperDuels(12) : Promise.resolve([]),
  ]);

  const initial = {
    at: Date.now(),
    prices: prices.map((p) => ({
      asset: p.asset,
      label: p.label,
      price: p.price,
      kind: (["aapl", "tsla", "nvda"].includes(p.asset) ? "equity" : "crypto") as
        | "equity"
        | "crypto",
    })),
    windows: windows.map((m) => ({
      id: m.id,
      question: m.question,
      asset: m.fast_asset,
      intervalSec: m.fast_interval_sec,
      strikePrice: m.strike_price,
      windowEnd: m.window_end,
      yesPrice: m.yes_price,
      isCommunity: Boolean(m.recurring_series_id),
      kind: "crypto" as const,
    })),
    equityWindows: equityWindows.map((m) => ({
      id: m.id,
      question: m.question,
      asset: m.fast_asset,
      intervalSec: m.fast_interval_sec,
      strikePrice: m.strike_price,
      windowEnd: m.window_end,
      yesPrice: m.yes_price,
      kind: "equity" as const,
    })),
    duels: duels.map((d) => ({
      duelId: d.duel_id,
      challenger: d.challenger_name,
      opponent: d.opponent_name,
      question: d.market_question,
      spectatorMarketId: d.spectator_market_id,
      stake: d.stake,
      acceptedAt: d.accepted_at,
    })),
    paperRaces: paperRaces.map((r) => ({
      id: r.id,
      creator: r.creator_name,
      opponent: r.opponent_name,
      creatorAsset: r.creator_asset,
      opponentAsset: r.opponent_asset,
      stake: r.stake,
      durationSec: r.duration_sec,
      endsAt: r.ends_at,
    })),
  };

  const roadmap = [
    {
      tier: "Live now",
      color: "emerald" as const,
      items: [
        {
          name: "Crypto Up/Down",
          desc: "BTC, ETH, SOL windows (1m–1h). Live spot vs strike. Oracle auto-pays at timer.",
          href: "/markets/fast",
        },
        ...(equitiesOn
          ? [
              {
                name: "Equities Up/Down",
                desc: "AAPL, TSLA, NVDA — 15m windows during US market hours.",
                href: "/markets/equities",
              },
            ]
          : []),
        {
          name: "Return Races",
          desc: "5–15 min return race on BTC/ETH/SOL. Pick your coin, highest % wins.",
          href: "/games/paper",
        },
        {
          name: "Duel spectators",
          desc: "Bet on who wins an accepted head-to-head duel.",
          href: "/duels",
        },
      ],
    },
    ...(!equitiesOn
      ? [
          {
            tier: "Next",
            color: "amber" as const,
            items: [
              {
                name: "Equities Up/Down",
                desc: "Curated stocks with market-hours oracle. Enable equities_enabled.",
                href: null as string | null,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Home
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Live Arena</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Auto-resolved games only — live prices, countdown timers, clear win/loss.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {equitiesOn && (
            <Link
              href="/markets/equities"
              className="rounded-md border border-sky-500/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-500/10"
            >
              Equities
            </Link>
          )}
          {liveEventsOn && (
            <Link
              href="/live"
              className="rounded-md border border-fuchsia-500/40 px-4 py-2 text-sm font-medium text-fuchsia-200 hover:bg-fuchsia-500/10"
            >
              Watch &amp; Bet
            </Link>
          )}
          <Link
            href="/games/create"
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Create game
          </Link>
          <Link
            href="/games/duels"
            className="rounded-md border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/10"
          >
            Duel hub
          </Link>
          <Link
            href="/games/paper"
            className="rounded-md border border-cyan-500/40 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10"
          >
            Return Races
          </Link>
          <Link
            href="/markets/new/recurring"
            className="rounded-md border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/10"
          >
            Run your crypto series
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <LiveArenaBoard initial={initial} />
      </div>

      <section className="mt-14">
        <h2 className="text-sm font-semibold text-zinc-200">Game catalog</h2>
        <div className="mt-6 space-y-8">
          {roadmap.map((group) => (
            <div key={group.tier}>
              <h3
                className={`text-xs font-semibold uppercase tracking-wider ${
                  group.color === "emerald"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {group.tier}
              </h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <li
                    key={item.name}
                    className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 text-sm"
                  >
                    <p className="font-medium text-zinc-100">{item.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {item.desc}
                    </p>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="mt-3 inline-block text-xs font-medium text-fuchsia-400 hover:underline"
                      >
                        Play →
                      </Link>
                    ) : (
                      <span className="mt-3 inline-block text-xs text-zinc-600">
                        Enable in Admin
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

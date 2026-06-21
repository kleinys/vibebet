import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listBreakingMarkets, listMarkets } from "@/lib/markets";
import { runPlatformBackgroundTicks } from "@/lib/platform-activity";
import { listCategoricalMarkets, type CategoricalMarket } from "@/lib/categorical";
import { CategoricalMarketCard } from "@/components/categorical-market-card";
import { isEnabled } from "@/lib/feature-flags";
import { MarketCard } from "@/components/market-card";
import { formatProbability } from "@/lib/cpmm";
import { formatVibe } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/supabase/types";
import { LiveFeedSection } from "@/components/live-feed-section";
import type { MarketSummary } from "@/lib/markets";

export const revalidate = 0;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const marketsOn = await isEnabled("markets_enabled");

  if (!marketsOn) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Predict everything.
          <br />
          <span className="text-fuchsia-400">Bet nothing real.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-zinc-400">
          Vibebet is launching soon. Markets will appear here once an admin
          flips the <code className="font-mono">markets_enabled</code> flag.
        </p>
      </div>
    );
  }

  if (marketsOn) {
    try {
      await runPlatformBackgroundTicks({ activityLimit: 2 });
    } catch {
      // Background sync must not crash the home page.
    }
  }

  const [mirrors, official, hot, breaking, recent, community, multi] =
    await Promise.all([
      listMarkets({
        status: "open",
        source: "polymarket_mirror",
        sort: "mirror_volume",
        limit: 12,
      }),
      listMarkets({
        status: "open",
        source: "platform",
        sort: "volume",
        limit: 8,
      }),
      listMarkets({ status: "open", sort: "trending", limit: 8, excludeSource: "community" }),
      listBreakingMarkets(6),
      listMarkets({ status: "open", sort: "new", limit: 6, excludeSource: "community" }),
      listMarkets({ status: "open", source: "community", sort: "new", limit: 4 }),
      listCategoricalMarkets({ status: "open", limit: 4 }),
    ]);

  const featured =
    mirrors[0] ??
    official.find((m) => m.is_featured) ??
    official[0] ??
    hot[0] ??
    community[0] ??
    null;

  // Anonymous landing: hero + featured + grids, with a sign-up CTA.
  if (!user) {
    return (
      <div>
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Predict everything.
            <br />
            <span className="text-fuchsia-400">Bet nothing real.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400">
            A play-money prediction market. Earn VIBE Points. Buy Gems for
            cosmetics. Closed-loop economy — no withdrawals, no real-money
            gambling.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-fuchsia-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-fuchsia-400"
            >
              Get 1,000 VIBE on signup
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-white/10 px-5 py-2.5 text-sm text-zinc-200 hover:border-white/20"
            >
              Sign in
            </Link>
            <Link
              href="/try"
              className="rounded-md border border-fuchsia-500/30 px-5 py-2.5 text-sm text-fuchsia-200 hover:bg-fuchsia-500/10"
            >
              Try live games
            </Link>
          </div>
        </section>

        <LiveFeedSection />

        <FeaturedAndSidebar featured={featured} breaking={breaking} />

        <Section title="Polymarket mirror" href="/markets?source=polymarket_mirror">
          <Grid
            markets={mirrors}
            emptyHint={
              <>
                No Polymarket mirrors yet.{" "}
                <Link href="/admin" className="text-amber-400 hover:underline">
                  Admin → Populate everything
                </Link>{" "}
                to pull Bitcoin, elections, sports, etc. from Polymarket.
              </>
            }
          />
        </Section>

        <Section title="Official markets" href="/markets?source=platform">
          <Grid
            markets={official}
            emptyHint={
              <>
                No official markets yet.{" "}
                <Link href="/admin" className="text-fuchsia-400 hover:underline">
                  Admin → Populate everything
                </Link>
                .
              </>
            }
          />
        </Section>

        <Section title="Trending now" href="/markets?sort=trending">
          <Grid markets={hot} />
        </Section>

        {community.length > 0 && (
          <Section title="Community" href="/markets?source=community">
            <Grid markets={community} />
          </Section>
        )}

        {multi.length > 0 && (
          <Section title="Multi-outcome" href="/markets?kind=categorical">
            <CategoricalGrid markets={multi} />
          </Section>
        )}

        <Section title="New markets" href="/markets?sort=new">
          <Grid markets={recent} />
        </Section>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const [liveArenaOn, fastOn, paperOn] = await Promise.all([
    isEnabled("live_arena_enabled"),
    isEnabled("fast_markets_enabled"),
    isEnabled("paper_trading_duels_enabled"),
  ]);
  const showLiveArena = liveArenaOn || fastOn || paperOn;

  return (
    <div>
      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              Welcome back, {profile?.display_name ?? "player"}.
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Pick a market, place a bet, watch the curve move.
            </p>
          </div>
          {showLiveArena && (
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-500/10 transition hover:border-emerald-300/55 hover:bg-emerald-500/20"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Live Arena — crypto windows &amp; races
            </Link>
          )}
        </div>
      </section>

      <LiveFeedSection />

      <FeaturedAndSidebar featured={featured} breaking={breaking} />

      <Section title="Polymarket mirror" href="/markets?source=polymarket_mirror">
        <Grid
          markets={mirrors}
          emptyHint={
            <>
              No Polymarket mirrors yet.{" "}
              <Link href="/admin" className="text-amber-400 hover:underline">
                Admin → Populate everything
              </Link>{" "}
              to pull live markets from Polymarket.
            </>
          }
        />
      </Section>

      <Section title="Official markets" href="/markets?source=platform">
        <Grid
          markets={official}
          emptyHint={
            <>
              No official markets yet.{" "}
              <Link href="/admin" className="text-fuchsia-400 hover:underline">
                Admin → Populate everything
              </Link>
              .
            </>
          }
        />
      </Section>

      <Section title="Trending now" href="/markets?sort=trending">
        <Grid markets={hot} />
      </Section>

      {community.length > 0 && (
        <Section title="Community" href="/markets?source=community">
          <Grid markets={community} />
        </Section>
      )}

      {multi.length > 0 && (
        <Section title="Multi-outcome" href="/markets?kind=categorical">
          <CategoricalGrid markets={multi} />
        </Section>
      )}

      <Section title="New markets" href="/markets?sort=new">
        <Grid markets={recent} />
      </Section>
    </div>
  );
}

function FeaturedAndSidebar({
  featured,
  breaking,
}: {
  featured: MarketSummary | null;
  breaking: MarketSummary[];
}) {
  if (!featured) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-sm text-zinc-400">
          No markets yet.{" "}
          <Link href="/markets/new" className="text-fuchsia-400 hover:underline">
            Create the first one
          </Link>
          .
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 grid max-w-6xl gap-4 px-6 lg:grid-cols-3">
      <FeaturedHero market={featured} />
      <BreakingSidebar markets={breaking} />
    </section>
  );
}

function FeaturedHero({ market }: { market: MarketSummary }) {
  const yesPct = market.yes_price;
  const noPct = 1 - yesPct;
  const delta = market.yes_price - market.yes_price_24h_ago;
  return (
    <Link
      href={`/markets/${market.id}`}
      className="group flex flex-col rounded-2xl border border-white/5 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 transition hover:border-white/10 lg:col-span-2"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        {market.source === "polymarket_mirror" && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300 ring-1 ring-amber-500/30">
            Polymarket mirror
          </span>
        )}
        {market.source === "platform" && (
          <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-fuchsia-300 ring-1 ring-fuchsia-500/30">
            Official
          </span>
        )}
        {market.source === "community" && (
          <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-zinc-300 ring-1 ring-zinc-500/30">
            Community
          </span>
        )}
        {(market.source === "platform" || market.source === "polymarket_mirror") && (
          <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-fuchsia-300 ring-1 ring-fuchsia-500/30">
            Featured
          </span>
        )}
        <span>{CATEGORY_LABELS[market.category]}</span>
      </div>
      <h2 className="mt-3 text-xl font-semibold leading-snug text-zinc-100 group-hover:text-white sm:text-2xl">
        {market.question}
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <BigOutcome
          label={market.outcome_yes_label}
          probability={yesPct}
          variant="yes"
        />
        <BigOutcome
          label={market.outcome_no_label}
          probability={noPct}
          variant="no"
        />
      </div>
      <div className="mt-5 flex items-center gap-4 text-xs text-zinc-500">
        <span>Volume 24h: {formatVibe(market.volume_24h)} VIBE</span>
        <span>Total: {formatVibe(market.volume)} VIBE</span>
        {market.volume_24h > 0 && (
          <span
            className={
              delta > 0
                ? "text-emerald-300"
                : delta < 0
                  ? "text-rose-300"
                  : "text-zinc-500"
            }
          >
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"} {Math.abs(delta * 100).toFixed(1)}% 24h
          </span>
        )}
      </div>
    </Link>
  );
}

function BigOutcome({
  label,
  probability,
  variant,
}: {
  label: string;
  probability: number;
  variant: "yes" | "no";
}) {
  const colors =
    variant === "yes"
      ? "bg-emerald-500/5 text-emerald-200 ring-emerald-500/20"
      : "bg-rose-500/5 text-rose-200 ring-rose-500/20";
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${colors}`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {formatProbability(probability)}
      </div>
    </div>
  );
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-fuchsia-500/35 bg-fuchsia-500/10 px-3.5 py-1.5 text-xs font-semibold text-fuchsia-200 transition hover:border-fuchsia-400/50 hover:bg-fuchsia-500/20 hover:text-white sm:text-sm"
    >
      View all →
    </Link>
  );
}

function BreakingSidebar({ markets }: { markets: MarketSummary[] }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-100">Breaking</h3>
        <ViewAllLink href="/markets?sort=trending" />
      </div>
      {markets.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">
          No big movers in the last 24 hours.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {markets.map((m) => {
            const delta = m.yes_price - m.yes_price_24h_ago;
            return (
              <li key={m.id}>
                <Link
                  href={`/markets/${m.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition hover:bg-zinc-900"
                >
                  <span className="line-clamp-2 flex-1 text-xs text-zinc-200">
                    {m.question}
                  </span>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-medium tabular-nums text-zinc-100">
                      {formatProbability(m.yes_price)}
                    </div>
                    <div
                      className={
                        delta > 0
                          ? "text-[10px] text-emerald-300"
                          : delta < 0
                            ? "text-[10px] text-rose-300"
                            : "text-[10px] text-zinc-500"
                      }
                    >
                      {delta > 0 ? "↑" : delta < 0 ? "↓" : "·"}
                      {Math.abs(delta * 100).toFixed(1)}%
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

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-10 max-w-6xl px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <ViewAllLink href={href} />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Grid({
  markets,
  emptyHint,
}: {
  markets: MarketSummary[];
  emptyHint?: React.ReactNode;
}) {
  if (markets.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        {emptyHint ?? "No markets in this slice yet."}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {markets.map((m) => (
        <li key={m.id}>
          <MarketCard market={m} />
        </li>
      ))}
    </ul>
  );
}

function CategoricalGrid({ markets }: { markets: CategoricalMarket[] }) {
  if (markets.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No multi-outcome markets yet.{" "}
        <Link href="/markets/new/categorical" className="text-violet-400 hover:underline">
          Create one
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {markets.map((m) => (
        <li key={m.id}>
          <CategoricalMarketCard market={m} />
        </li>
      ))}
    </ul>
  );
}

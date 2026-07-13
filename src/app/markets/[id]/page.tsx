import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getComments,
  getCreatorName,
  getMarket,
  getPriceHistory,
  getRecentTrades,
  getUserPosition,
} from "@/lib/markets";
import { getBalance } from "@/lib/ledger";
import { formatProbability, priceForSide } from "@/lib/cpmm";
import { formatVibe, formatUsdPrice } from "@/lib/utils";
import { TradePanel } from "@/components/trade-panel";
import { PositionCancelBar } from "@/components/position-cancel-bar";
import { CommentBox } from "@/components/comment-box";
import { PriceChart } from "@/components/price-chart";
import { FastPriceChart } from "@/components/fast-price-chart";
import { FastCountdown } from "@/components/fast-countdown";
import { DisputeForm } from "@/components/dispute-form";
import { CATEGORY_LABELS } from "@/lib/supabase/types";
import {
  getDisputeForMarket,
  maybeTickCourt,
  timeRemaining,
} from "@/lib/court";
import { runPlatformBackgroundTicks } from "@/lib/platform-activity";
import { CategoricalMarketDetail } from "@/components/categorical-market-detail";
import { formatUsdVolume } from "@/lib/polymarket";
import { fetchRelatedNews } from "@/lib/news";
import { MarketNewsPanel } from "@/components/market-news-panel";
import { fetchCryptoSpotPrices } from "@/lib/crypto-prices";
import { tickFastMarkets } from "@/lib/fast-markets";
import { isEnabled } from "@/lib/feature-flags";
import { getActivityFeed } from "@/lib/activity-feed";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { LimitOrderForm } from "@/components/limit-order-panel";
import { MarketGuestInsight } from "@/components/market-guest-insight";
import { getSmartBetDefaults } from "@/lib/smart-bet-defaults";

export const revalidate = 0;

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Run the opportunistic ticker FIRST so a stale challenge / vote window can
  // finalize before we render the rest of the page.
  await Promise.all([maybeTickCourt(), runPlatformBackgroundTicks({ activityLimit: 1 })]);

  const marketPreview = await getMarket(id);
  if (!marketPreview) notFound();
  if (marketPreview.kind === "categorical") {
    return <CategoricalMarketDetail id={id} />;
  }

  const market = marketPreview;
  const isFast = market.fast_asset != null;

  let spotPrice: number | undefined;
  if (isFast) {
    const prices = await fetchCryptoSpotPrices();
    await tickFastMarkets(prices);
    spotPrice = prices.find((p) => p.asset === market.fast_asset)?.price;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const liveFeedEnabled = await isEnabled("live_feed_enabled");
  const limitOrdersEnabled = await isEnabled("limit_orders_enabled");
  const quickExitEnabled = await isEnabled("quick_exit_enabled");
  const psychologyOn = await isEnabled("psychology_layer_enabled");

  const [creator, position, trades, vibeBalance, comments, priceHistory, dispute, newsHeadlines, activityFeed, profileRow] =
    await Promise.all([
      getCreatorName(market.creator_id),
      user ? getUserPosition(market.id, user.id) : Promise.resolve(null),
      getRecentTrades(market.id),
      user ? getBalance(user.id, "vibe") : Promise.resolve(0),
      getComments(market.id, 50),
      getPriceHistory(market.id),
      market.status === "in_court" ? getDisputeForMarket(market.id) : Promise.resolve(null),
      fetchRelatedNews(market.question, 3),
      liveFeedEnabled ? getActivityFeed(8) : Promise.resolve([]),
      user
        ? supabase
            .from("profiles")
            .select("display_name, username")
            .eq("id", user.id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
    ]);

  const pool = { reserveYes: market.reserve_yes, reserveNo: market.reserve_no };
  const yesPrice = priceForSide(pool, "yes");
  const noPrice = priceForSide(pool, "no");

  const closed =
    market.status !== "open" ||
    (isFast && market.window_end
      ? new Date(market.window_end) <= new Date()
      : market.closes_at !== null && new Date(market.closes_at) <= new Date());

  const smartDefaults =
    psychologyOn && user && vibeBalance > 0 && !closed
      ? await getSmartBetDefaults(user.id, yesPrice, noPrice, vibeBalance)
      : null;

  const topComment =
    comments.length > 0
      ? {
          body: comments[0]!.body,
          authorName: comments[0]!.display_name ?? "Player",
        }
      : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/markets"
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← All markets
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
            <Link
              href={`/markets?category=${market.category}`}
              className="rounded bg-zinc-800/60 px-2 py-0.5 hover:bg-zinc-800"
            >
              {CATEGORY_LABELS[market.category]}
            </Link>
            {market.is_featured && (
              <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                Featured
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-snug">
            {market.question}
          </h1>
          {market.external_event_slug && market.external_event_title && (
              <p className="mt-2 text-xs text-zinc-500">
                Part of{" "}
                <Link
                  href={`/markets?source=polymarket_mirror&event=${encodeURIComponent(market.external_event_slug)}`}
                  className="text-amber-300/90 hover:underline"
                >
                  {market.external_event_title}
                </Link>
              </p>
            )}
          <p className="mt-2 text-xs text-zinc-500">
            Created by {creator}
            {market.closes_at && (
              <>
                {" · Closes "}
                {new Date(market.closes_at).toLocaleString()}
              </>
            )}
            {market.status === "resolved" && market.resolved_at && (
              <>
                {" · Resolved "}
                <span
                  className={
                    market.resolved_outcome
                      ? "text-emerald-300"
                      : "text-rose-300"
                  }
                >
                  {market.resolved_outcome
                    ? market.outcome_yes_label
                    : market.outcome_no_label}
                </span>
              </>
            )}
          </p>
        </div>
        <StatusBadge status={market.status} />
      </header>

      {isFast && market.strike_price != null && market.window_end && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-zinc-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-amber-400/90">
                Fast market · {market.fast_asset?.toUpperCase()} · auto-resolve
              </p>
              <div className="mt-2 flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Price to beat</p>
                  <p className="font-semibold tabular-nums">
                    {formatUsdPrice(market.strike_price)}
                  </p>
                </div>
                {spotPrice != null && (
                  <div>
                    <p className="text-xs text-zinc-500">Current price</p>
                    <p
                      className={
                        spotPrice >= market.strike_price
                          ? "font-semibold tabular-nums text-emerald-300"
                          : "font-semibold tabular-nums text-orange-300"
                      }
                    >
                      {formatUsdPrice(spotPrice)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-500">Window closes in</p>
              <FastCountdown windowEnd={market.window_end} />
            </div>
          </div>
          <div className="mt-4">
            <FastPriceChart
              asset={market.fast_asset!}
              strikePrice={market.strike_price}
              windowStartMs={
                market.window_start
                  ? new Date(market.window_start).getTime()
                  : Date.now() - 300_000
              }
            />
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Resolves <strong className="text-zinc-300">Up</strong> if spot price
            at window end ≥ strike. No dispute window — next window spawns
            automatically.
            {market.creator_fee_bps > 0 && (
              <>
                {" "}
                Creator fee: {(market.creator_fee_bps / 100).toFixed(1)}% of each
                bet.
              </>
            )}{" "}
            <Link href="/markets/fast" className="text-amber-300/90 hover:underline">
              All fast markets →
            </Link>
          </p>
        </div>
      )}

      {market.description && !isFast && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg border border-white/5 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          {market.description}
        </p>
      )}

      {psychologyOn && !user && !closed && (
        <MarketGuestInsight
          marketId={market.id}
          question={market.question}
          yesLabel={market.outcome_yes_label}
          noLabel={market.outcome_no_label}
          yesPrice={yesPrice}
          noPrice={noPrice}
          yesPrice24hAgo={market.yes_price_24h_ago}
          volume24h={market.volume_24h}
          topComment={topComment}
        />
      )}

      {market.source === "polymarket_mirror" && (
        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-amber-200">Polymarket mirror</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Odds sync from Polymarket (USD). You bet play-money VIBE on this
            clone — Vibebet trade volume is separate.
            {market.external_volume_24h_usd != null &&
              market.external_volume_24h_usd > 0 && (
                <>
                  {" "}
                  PM 24h: {formatUsdVolume(market.external_volume_24h_usd)}.
                </>
              )}
            {market.volume_24h > 0 && (
              <> Vibebet 24h: {formatVibe(market.volume_24h)} VIBE.</>
            )}
            {market.external_synced_at && (
              <>
                {" "}
                Last synced{" "}
                {new Date(market.external_synced_at).toLocaleString()}.
              </>
            )}
          </p>
          {market.external_url && (
            <a
              href={market.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-amber-300 hover:underline"
            >
              View on Polymarket →
            </a>
          )}
        </div>
      )}

      {market.status === "resolving" && market.challenge_deadline && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-200">
                Resolution proposed:{" "}
                {market.proposed_outcome
                  ? market.outcome_yes_label
                  : market.outcome_no_label}
              </h2>
              <p className="mt-1 text-xs text-amber-200/80">
                Challenge window closes in{" "}
                <span className="font-medium">
                  {timeRemaining(market.challenge_deadline)}
                </span>
                . If nobody disputes, payouts settle automatically.
              </p>
            </div>
          </div>
          {user &&
            position &&
            (position.yesShares > 0 || position.noShares > 0) &&
            market.creator_id !== user.id && (
              <div className="mt-3">
                <DisputeForm
                  marketId={market.id}
                  proposedOutcome={market.proposed_outcome ?? false}
                  yesLabel={market.outcome_yes_label}
                  noLabel={market.outcome_no_label}
                  estimatedStake={Math.min(
                    Math.max(100, Math.floor(market.volume / 20)),
                    10000,
                  )}
                />
              </div>
            )}
        </div>
      )}

      {market.status === "in_court" && dispute && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-200">
                In Meme Court — community is voting
              </h2>
              <p className="mt-1 text-xs text-amber-200/80">
                Vote closes in{" "}
                <span className="font-medium">
                  {timeRemaining(dispute.voting_ends_at)}
                </span>
                . Payouts are frozen until the court decides.
              </p>
            </div>
            <Link
              href={`/court/${dispute.id}`}
              className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-400"
            >
              View case →
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <PriceCard
              side="yes"
              label={market.outcome_yes_label}
              price={yesPrice}
              priceAgo={market.yes_price_24h_ago}
              hasActivity={market.volume_24h > 0}
            />
            <PriceCard
              side="no"
              label={market.outcome_no_label}
              price={noPrice}
              priceAgo={1 - market.yes_price_24h_ago}
              hasActivity={market.volume_24h > 0}
            />
          </div>

          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Price history
            </h2>
            <div className="mt-3">
              <PriceChart
                points={priceHistory}
                yesLabel={market.outcome_yes_label}
                noLabel={market.outcome_no_label}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Market stats
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Stat label="Volume" value={`${formatVibe(market.volume)} VIBE`} />
              <Stat
                label="Volume 24h"
                value={`${formatVibe(market.volume_24h)} VIBE`}
              />
              <Stat label="Trades" value={market.trade_count.toString()} />
              <Stat
                label="Pool"
                value={`${formatVibe(market.reserve_yes + market.reserve_no)} VIBE`}
              />
            </dl>
          </div>

          {position && (position.yesShares > 0 || position.noShares > 0) && (
            <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Your position
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Stat
                  label={`${market.outcome_yes_label} shares`}
                  value={formatVibe(position.yesShares)}
                />
                <Stat
                  label={`${market.outcome_no_label} shares`}
                  value={formatVibe(position.noShares)}
                />
                <Stat
                  label="Spent"
                  value={`${formatVibe(position.totalCost)} VIBE`}
                />
                {position.totalPayout > 0 && (
                  <Stat
                    label="Paid out"
                    value={`${formatVibe(position.totalPayout)} VIBE`}
                  />
                )}
              </dl>
              {quickExitEnabled && user && !closed && (
                <PositionCancelBar
                  marketId={market.id}
                  yesShares={position.yesShares}
                  noShares={position.noShares}
                  totalCost={position.totalCost}
                  yesLabel={market.outcome_yes_label}
                  noLabel={market.outcome_no_label}
                />
              )}
            </div>
          )}

          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Discussion
            </h2>
            {user ? (
              <div className="mt-3">
                <CommentBox marketId={market.id} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                <Link
                  href={`/login?next=/markets/${market.id}`}
                  className="text-fuchsia-400 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to join the conversation.
              </p>
            )}
            {comments.length > 0 && (
              <ul className="mt-4 space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-md bg-zinc-900/60 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-200">
                        {c.display_name}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Recent trades
            </h2>
            {trades.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No trades yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/5 text-sm">
                {trades.map((t) => {
                  const isSell = t.cost < 0;
                  const sideLabel =
                    t.side === "yes"
                      ? market.outcome_yes_label
                      : market.outcome_no_label;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span
                        className={
                          t.side === "yes"
                            ? "rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-300"
                            : "rounded bg-rose-500/10 px-1.5 py-0.5 text-xs text-rose-300"
                        }
                      >
                        {isSell ? "Sold " : "Bought "}
                        {sideLabel}
                      </span>
                      <span className="tabular-nums text-zinc-300">
                        {isSell
                          ? `${formatVibe(t.shares)} shares → ${formatVibe(-t.cost)} VIBE`
                          : `${formatVibe(t.cost)} VIBE → ${formatVibe(t.shares)} shares`}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="sticky top-20 space-y-4">
          <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-5">
            <h2 className="text-sm font-semibold">Place a bet</h2>
            {!user ? (
              <p className="mt-4 text-sm text-zinc-400">
                <Link
                  href={`/login?next=/markets/${market.id}`}
                  className="text-fuchsia-400 hover:underline"
                >
                  Sign in
                </Link>{" "}
                to bet on this market.
              </p>
            ) : (
              <div className="mt-4">
                <TradePanel
                  marketId={market.id}
                  reserveYes={market.reserve_yes}
                  reserveNo={market.reserve_no}
                  disabled={closed}
                  vibeBalance={vibeBalance}
                  yesShares={position?.yesShares ?? 0}
                  noShares={position?.noShares ?? 0}
                  totalCost={position?.totalCost ?? 0}
                  yesLabel={market.outcome_yes_label}
                  noLabel={market.outcome_no_label}
                  quickExitEnabled={quickExitEnabled}
                  smartDefaults={smartDefaults ?? undefined}
                  shareProfile={
                    profileRow
                      ? {
                          displayName: profileRow.display_name ?? "Player",
                          username: profileRow.username,
                          marketQuestion: market.question,
                        }
                      : undefined
                  }
                />
              </div>
            )}
          </div>
          {limitOrdersEnabled && user && !closed && (
            <LimitOrderForm
              marketId={market.id}
              yesLabel={market.outcome_yes_label}
              noLabel={market.outcome_no_label}
              currentYesPrice={yesPrice}
              currentNoPrice={noPrice}
            />
          )}
          {liveFeedEnabled && (
            <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-5">
              <h2 className="text-sm font-semibold">Live feed</h2>
              <p className="mt-1 text-[11px] text-zinc-500">
                Recent bets across Vibebet
              </p>
              <div className="mt-3 max-h-48 overflow-y-auto">
                <LiveActivityFeed initial={activityFeed} pollMs={12000} />
              </div>
            </div>
          )}
          <MarketNewsPanel headlines={newsHeadlines} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PriceCard({
  side,
  label,
  price,
  priceAgo,
  hasActivity,
}: {
  side: "yes" | "no";
  label: string;
  price: number;
  priceAgo: number;
  hasActivity: boolean;
}) {
  const isYes = side === "yes";
  const delta = price - priceAgo;
  return (
    <div
      className={`rounded-xl border p-4 ${
        isYes
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-rose-500/20 bg-rose-500/5"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-zinc-400">
          {label}
        </div>
        {hasActivity && Math.abs(delta) >= 0.005 && (
          <span
            className={
              delta > 0
                ? "text-[10px] text-emerald-300"
                : "text-[10px] text-rose-300"
            }
          >
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta * 100).toFixed(1)}% 24h
          </span>
        )}
      </div>
      <div
        className={`mt-1 text-3xl font-semibold tabular-nums ${
          isYes ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {formatProbability(price)}
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {(price * 100).toFixed(1)}¢ per share · pays 1 VIBE if right
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-zinc-100">
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    closed: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    resolving: "bg-blue-500/10 text-blue-300 ring-blue-500/30",
    in_court: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    resolved: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/30",
    voided: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  };
  const labels: Record<string, string> = {
    open: "open",
    closed: "closed",
    resolving: "challenge",
    in_court: "in court",
    resolved: "resolved",
    voided: "voided",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        styles[status] ?? styles.open
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

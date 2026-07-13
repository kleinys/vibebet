import { Suspense, type ComponentProps } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getAllBalances } from "@/lib/ledger";
import { getDailyHustle, getFlashHustle, getSparkHustle } from "@/lib/daily-hustle";
import { getHustleOracle } from "@/lib/hustle-oracle";
import { getHustleWallet } from "@/lib/hustle-wallet";
import { getHustleMarketplace } from "@/lib/hustle-marketplace";
import { getHustleEquity } from "@/lib/hustle-equity";
import { getHustleGovernance } from "@/lib/hustle-governance";
import { getHustleWellness } from "@/lib/hustle-wellness";
import { listFastMarkets, tickFastMarkets } from "@/lib/fast-markets";
import { getActiveSpectatorDuels } from "@/lib/duels";
import { getMyInstalledModules } from "@/lib/platform-modules";
import {
  fetchLiveArenaPrices,
  pricesToTickPayload,
} from "@/lib/live-arena-prices";
import { GAME_CATALOG, playHubDuelGames } from "@/lib/game-catalog";
import { PlayHub, type PlayHubTab } from "@/components/play/play-hub";
import { PlayArenaEmbed } from "@/components/play/play-arena-embed";
import { PlayWatchEmbed } from "@/components/play/play-watch-embed";
import { FeatureOffPanel } from "@/components/feature-off-panel";
import type { SpectatorDuel } from "@/lib/duels";

export const revalidate = 0;

const VALID_TABS = new Set<PlayHubTab>(["live", "duels", "arcade", "hustle", "watch"]);

function normalizeTab(tab: string | undefined): PlayHubTab {
  if (tab === "vibe") return "arcade";
  if (tab && VALID_TABS.has(tab as PlayHubTab)) return tab as PlayHubTab;
  return "live";
}

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab = normalizeTab(params.tab);

  const [
    playHubOn,
    hustleSparkOn,
    dailyHustleOn,
    hustleTrustOn,
    hustleBridgeOn,
    hustleMarketplaceOn,
    hustleSharesOn,
    hustleGovernanceOn,
    hustleRecoveryOn,
    arenaOn,
    fastOn,
    equitiesOn,
    duelsOn,
    spectatorOn,
    liveEventsOn,
    gameLayerOn,
    arcadeOn,
    triviaOn,
    interconnectOn,
    unifiedEconomyUi,
  ] = await Promise.all([
    isEnabled("play_hub_enabled"),
    isEnabled("hustle_spark_enabled"),
    isEnabled("daily_hustle_enabled"),
    isEnabled("hustle_trust_enabled"),
    isEnabled("hustle_bridge_enabled"),
    isEnabled("hustle_marketplace_enabled"),
    isEnabled("hustle_shares_enabled"),
    isEnabled("hustle_governance_enabled"),
    isEnabled("hustle_recovery_enabled"),
    isEnabled("live_arena_enabled"),
    isEnabled("fast_markets_enabled"),
    isEnabled("equities_enabled"),
    isEnabled("duels_enabled"),
    isEnabled("duel_spectator_markets_enabled"),
    isEnabled("live_events_enabled"),
    isEnabled("game_layer_enabled"),
    isEnabled("arcade_games_enabled"),
    isEnabled("trivia_enabled"),
    isEnabled("interconnect_layer_enabled"),
    isEnabled("unified_economy_ui_enabled"),
  ]);

  if (!playHubOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <FeatureOffPanel
          title="Play hub"
          body="The unified games home is rolling out soon."
          ctaHref="/games"
          ctaLabel="Go to Live Arena"
        />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hustleEnabled = hustleSparkOn && dailyHustleOn;

  let vibeBalance = 0;
  let sparkTasks: Awaited<ReturnType<typeof getSparkHustle>> = [];
  let flashTasks: Awaited<ReturnType<typeof getFlashHustle>> = [];
  let dailyTasks: Awaited<ReturnType<typeof getDailyHustle>> = [];
  let oracle: Awaited<ReturnType<typeof getHustleOracle>> = null;
  let wallet: Awaited<ReturnType<typeof getHustleWallet>> = null;
  let marketplace: Awaited<ReturnType<typeof getHustleMarketplace>> = null;
  let equity: Awaited<ReturnType<typeof getHustleEquity>> = null;
  let governance: Awaited<ReturnType<typeof getHustleGovernance>> = null;
  let wellness: Awaited<ReturnType<typeof getHustleWellness>> = null;
  let installedModules: Awaited<ReturnType<typeof getMyInstalledModules>> = [];

  if (user) {
    const [
      balances,
      spark,
      flash,
      daily,
      oracleData,
      walletData,
      marketplaceData,
      equityData,
      governanceData,
      wellnessData,
      installed,
    ] = await Promise.all([
      getAllBalances(user.id).catch(() => ({ vibe: 0, gem: 0 })),
      hustleEnabled ? getSparkHustle().catch(() => []) : Promise.resolve([]),
      hustleEnabled ? getFlashHustle().catch(() => []) : Promise.resolve([]),
      dailyHustleOn ? getDailyHustle().catch(() => []) : Promise.resolve([]),
      hustleTrustOn ? getHustleOracle().catch(() => null) : Promise.resolve(null),
      hustleBridgeOn || unifiedEconomyUi ? getHustleWallet().catch(() => null) : Promise.resolve(null),
      hustleMarketplaceOn ? getHustleMarketplace().catch(() => null) : Promise.resolve(null),
      hustleSharesOn ? getHustleEquity().catch(() => null) : Promise.resolve(null),
      hustleGovernanceOn ? getHustleGovernance().catch(() => null) : Promise.resolve(null),
      hustleRecoveryOn ? getHustleWellness().catch(() => null) : Promise.resolve(null),
      interconnectOn ? getMyInstalledModules().catch(() => []) : Promise.resolve([]),
    ]);
    vibeBalance = balances.vibe;
    sparkTasks = spark;
    flashTasks = flash;
    dailyTasks = daily;
    oracle = oracleData;
    wallet = walletData;
    marketplace = marketplaceData;
    equity = equityData;
    governance = governanceData;
    wellness = wellnessData;
    installedModules = installed;
  }

  let liveInitial: ComponentProps<typeof PlayHub>["liveInitial"] = null;
  let spectatorDuels: SpectatorDuel[] = [];

  if (arenaOn || fastOn || equitiesOn) {
    const prices = await fetchLiveArenaPrices({
      cryptoOn: fastOn,
      equitiesOn,
    });
    const payload = pricesToTickPayload(prices);
    if ((fastOn || equitiesOn) && payload.length > 0) {
      await tickFastMarkets(payload);
    }

    const [windows, equityWindows, duels] = await Promise.all([
      fastOn ? listFastMarkets(24, "crypto") : Promise.resolve([]),
      equitiesOn ? listFastMarkets(12, "finance") : Promise.resolve([]),
      duelsOn && spectatorOn ? getActiveSpectatorDuels(12) : Promise.resolve([]),
    ]);

    spectatorDuels = duels;

    liveInitial = {
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
      paperRaces: [],
    };
  }

  const flags = {
    game_layer_enabled: gameLayerOn,
    duels_enabled: duelsOn,
    arcade_games_enabled: arcadeOn,
    paper_trading_duels_enabled: false,
    fast_markets_enabled: fastOn,
    connect4_enabled: await isEnabled("connect4_enabled"),
    liars_dice_enabled: await isEnabled("liars_dice_enabled"),
    chess_enabled: await isEnabled("chess_enabled"),
    checkers_enabled: await isEnabled("checkers_enabled"),
    go_enabled: await isEnabled("go_enabled"),
    shogi_enabled: await isEnabled("shogi_enabled"),
    poker_enabled: await isEnabled("poker_enabled"),
    trivia_enabled: triviaOn,
  };

  const duelGames = playHubDuelGames(flags);

  if (params.tab === "hustle" && !user) {
    redirect("/login?next=/play?tab=hustle");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading play hub…</div>}>
        <PlayHub
          initialTab={initialTab}
          hustleEnabled={hustleEnabled}
          sparkTasks={sparkTasks}
          flashTasks={flashTasks}
          dailyTasks={dailyTasks}
          vibeBalance={vibeBalance}
          oracle={oracle}
          trustEnabled={hustleTrustOn}
          bridgeEnabled={hustleBridgeOn}
          marketplaceEnabled={hustleMarketplaceOn}
          sharesEnabled={hustleSharesOn}
          governanceEnabled={hustleGovernanceOn}
          recoveryEnabled={hustleRecoveryOn}
          unifiedEconomyUi={unifiedEconomyUi}
          wallet={wallet}
          marketplace={marketplace}
          equity={equity}
          governance={governance}
          wellness={wellness}
          isLoggedIn={Boolean(user)}
          liveInitial={liveInitial}
          duelGames={duelGames}
          liveEventsOn={liveEventsOn}
          interconnectOn={interconnectOn}
          spectatorDuels={spectatorDuels}
          arcadePanel={<PlayArenaEmbed isLoggedIn={Boolean(user)} />}
          watchPanel={<PlayWatchEmbed />}
          installedModules={installedModules}
        />
      </Suspense>
    </div>
  );
}

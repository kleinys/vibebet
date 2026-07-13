"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LiveArenaBoard } from "@/components/live-arena-board";
import { HustleSparkBoard } from "@/components/hustle/hustle-spark-board";
import { DuelGameCard } from "@/components/duel-game-card";
import { FeatureOffPanel } from "@/components/feature-off-panel";
import { DuelSpectatorStrip } from "@/components/duel-spectator-strip";
import type { SpectatorDuel } from "@/lib/duels";
import type { GameDefinition } from "@/lib/game-catalog";
import type { DailyHustleTask } from "@/lib/hustle/shared";
import type {
  HustleEquityState,
  HustleGovernanceState,
  HustleMarketplaceState,
  HustleOracleProfile,
  HustleWalletState,
  HustleWellnessState,
} from "@/lib/hustle/shared";
import type { ComponentProps, ReactNode } from "react";

export type PlayHubTab = "live" | "duels" | "arcade" | "hustle" | "watch";

const TABS: { id: PlayHubTab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "duels", label: "Duels" },
  { id: "arcade", label: "Arcade" },
  { id: "hustle", label: "Hustle" },
  { id: "watch", label: "Watch" },
];

type LiveInitial = ComponentProps<typeof LiveArenaBoard>["initial"];

export function PlayHub({
  initialTab,
  hustleEnabled,
  sparkTasks,
  flashTasks,
  dailyTasks,
  vibeBalance,
  oracle,
  trustEnabled,
  bridgeEnabled,
  marketplaceEnabled,
  sharesEnabled,
  governanceEnabled,
  recoveryEnabled,
  unifiedEconomyUi = false,
  wallet,
  marketplace,
  equity,
  governance,
  wellness,
  isLoggedIn,
  liveInitial,
  duelGames,
  liveEventsOn,
  interconnectOn = false,
  spectatorDuels = [],
  arcadePanel,
  watchPanel,
}: {
  initialTab: PlayHubTab;
  hustleEnabled: boolean;
  sparkTasks: DailyHustleTask[];
  flashTasks: DailyHustleTask[];
  dailyTasks: DailyHustleTask[];
  vibeBalance: number;
  oracle: HustleOracleProfile | null;
  trustEnabled: boolean;
  bridgeEnabled: boolean;
  marketplaceEnabled: boolean;
  sharesEnabled: boolean;
  governanceEnabled: boolean;
  recoveryEnabled: boolean;
  unifiedEconomyUi?: boolean;
  wallet: HustleWalletState | null;
  marketplace: HustleMarketplaceState | null;
  equity: HustleEquityState | null;
  governance: HustleGovernanceState | null;
  wellness: HustleWellnessState | null;
  isLoggedIn: boolean;
  liveInitial: LiveInitial | null;
  duelGames: GameDefinition[];
  liveEventsOn: boolean;
  interconnectOn?: boolean;
  spectatorDuels?: SpectatorDuel[];
  arcadePanel: ReactNode;
  watchPanel: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: PlayHubTab =
    rawTab === "vibe"
      ? "arcade"
      : TABS.some((t) => t.id === rawTab)
        ? (rawTab as PlayHubTab)
        : initialTab;

  function setTab(next: PlayHubTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/play?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="play-hub">
      <div className="play-hub__chrome">
        <div>
          <p className="play-hub__eyebrow">VibeBet Play</p>
          <h1 className="play-hub__title">One hub for everything</h1>
          <p className="play-hub__sub">
            Live windows, duels, arcade games, earn tasks, and streams — no hunting around.
          </p>
        </div>
      </div>

      <div className="play-hub__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`play-hub__tab ${tab === t.id ? "play-hub__tab--active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="play-hub__panel" role="tabpanel">
        {tab === "live" && (
          <div>
            {liveInitial ? (
              <LiveArenaBoard initial={liveInitial} />
            ) : (
              <FeatureOffPanel
                title="Live windows unavailable"
                body="Fast markets and live arena feeds are coming soon."
                ctaHref="/markets/fast"
                ctaLabel="Browse fast markets"
              />
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/markets/fast" className="play-hub__link">
                Crypto Up/Down →
              </Link>
              <Link href="/markets/equities" className="play-hub__link">
                Equities →
              </Link>
            </div>
          </div>
        )}

        {tab === "duels" && (
          <div>
            <p className="mb-4 text-sm text-zinc-400">
              Head-to-head skill games, luck duels, and arcade classics.
            </p>
            {interconnectOn && spectatorDuels.length > 0 && (
              <div className="mb-6">
                <DuelSpectatorStrip duels={spectatorDuels} />
              </div>
            )}
            {duelGames.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {duelGames.map((game) => (
                  <DuelGameCard key={game.key} game={game} />
                ))}
              </ul>
            ) : (
              <FeatureOffPanel
                title="Duels coming soon"
                body="Challenge friends and matchmake across chess, trivia, RPS, and more."
                ctaHref="/duels"
                ctaLabel="Prediction duels"
              />
            )}
            <Link href="/duels" className="play-hub__link mt-6 inline-block">
              Market prediction duels →
            </Link>
          </div>
        )}

        {tab === "arcade" && (
          <div className="play-hub__arcade-panel">
            {vibeBalance < 100 && isLoggedIn && (
              <div className="hustle-spark-board__banner hustle-spark-board__banner--play mb-4">
                Low VIBE — complete a Hustle task or win a duel to top up.
              </div>
            )}
            {arcadePanel}
          </div>
        )}

        {tab === "hustle" && (
          <div>
            {!hustleEnabled ? (
              <FeatureOffPanel
                title="Hustle earn loop"
                body="Complete micro-tasks and gigs to earn VIBE. Coming soon."
                ctaHref="/account"
                ctaLabel="Your account"
              />
            ) : !isLoggedIn ? (
              <FeatureOffPanel
                title="Log in to earn"
                body="Spark tasks pay VIBE for quick platform work."
                ctaHref="/login?next=/play?tab=hustle"
                ctaLabel="Log in"
              />
            ) : (
              <HustleSparkBoard
                sparkTasks={sparkTasks}
                flashTasks={flashTasks}
                dailyTasks={dailyTasks}
                vibeBalance={vibeBalance}
                oracle={oracle}
                trustEnabled={trustEnabled}
                bridgeEnabled={bridgeEnabled}
                marketplaceEnabled={marketplaceEnabled}
                sharesEnabled={sharesEnabled}
                governanceEnabled={governanceEnabled}
                recoveryEnabled={recoveryEnabled}
                unifiedEconomyUi={unifiedEconomyUi}
                wallet={wallet}
                marketplace={marketplace}
                equity={equity}
                governance={governance}
                wellness={wellness}
              />
            )}
          </div>
        )}

        {tab === "watch" && (
          <div>
            {watchPanel}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LiveArenaBoard } from "@/components/live-arena-board";
import { HustleSparkBoard } from "@/components/hustle/hustle-spark-board";
import type { DailyHustleTask } from "@/lib/hustle/shared";
import type {
  HustleEquityState,
  HustleGovernanceState,
  HustleMarketplaceState,
  HustleOracleProfile,
  HustleWalletState,
  HustleWellnessState,
} from "@/lib/hustle/shared";
import type { ComponentProps } from "react";

export type PlayHubTab = "live" | "duels" | "vibe" | "hustle" | "watch";

const TABS: { id: PlayHubTab; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "duels", label: "Duels" },
  { id: "vibe", label: "Vibe" },
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
  wallet,
  marketplace,
  equity,
  governance,
  wellness,
  isLoggedIn,
  liveInitial,
  duelGameLinks,
  liveEventsOn,
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
  wallet: HustleWalletState | null;
  marketplace: HustleMarketplaceState | null;
  equity: HustleEquityState | null;
  governance: HustleGovernanceState | null;
  wellness: HustleWellnessState | null;
  isLoggedIn: boolean;
  liveInitial: LiveInitial | null;
  duelGameLinks: { name: string; href: string; desc: string }[];
  liveEventsOn: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as PlayHubTab | null) ?? initialTab;

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
            Live windows, duels, locker games, earn tasks, and streams — no hunting around.
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
              <EmptyPanel
                title="Live Arena off"
                body="Enable live_arena_enabled or fast_markets_enabled in Admin."
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
              Head-to-head skill games and prediction duels.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {duelGameLinks.map((g) => (
                <li key={g.href} className="play-hub__card">
                  <p className="font-medium text-zinc-100">{g.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{g.desc}</p>
                  <Link href={g.href} className="play-hub__link mt-3 inline-block">
                    Play →
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/games/duels" className="play-hub__link mt-6 inline-block">
              Open full duel hub →
            </Link>
            <Link href="/duels" className="play-hub__link mt-2 ml-4 inline-block">
              Market duels →
            </Link>
          </div>
        )}

        {tab === "vibe" && (
          <div className="play-hub__vibe-panel">
            <p className="text-sm text-zinc-400">
              Daily wheel, VIBE case, and Plinko — fullscreen locker arena with your trainer.
            </p>
            {vibeBalance < 100 && (
              <div className="hustle-spark-board__banner hustle-spark-board__banner--play mt-4">
                Need VIBE? Switch to the Hustle tab and complete a Spark task.
              </div>
            )}
            <Link href="/account/profile/arena" className="play-hub__cta mt-6 inline-flex">
              Open VIBE arena (fullscreen)
            </Link>
            <Link href="/account/profile#trainer" className="play-hub__link mt-3 block">
              Trainer &amp; locker →
            </Link>
          </div>
        )}

        {tab === "hustle" && (
          <div>
            {!hustleEnabled ? (
              <EmptyPanel
                title="Hustle tasks off"
                body="Enable hustle_spark_enabled and daily_hustle_enabled in Admin."
              />
            ) : !isLoggedIn ? (
              <EmptyPanel
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
            <p className="text-sm text-zinc-400">
              Hosted streams and discovered Twitch/YouTube watch-and-bet.
            </p>
            {liveEventsOn ? (
              <Link href="/live" className="play-hub__cta mt-6 inline-flex">
                Open Watch hub
              </Link>
            ) : (
              <EmptyPanel
                title="Watch hub off"
                body="Enable live_events_enabled in Admin."
              />
            )}
            <Link href="/games" className="play-hub__link mt-3 block">
              Live Arena dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-8 text-center">
      <p className="font-semibold text-zinc-200">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{body}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="play-hub__cta mt-4 inline-flex">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

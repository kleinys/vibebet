"use client";

import Link from "next/link";
import { CreateDuelForm } from "@/app/duels/create-duel-form";
import { CreateLiveEventForm } from "@/app/live/create-live-event-form";

const TABS = [
  {
    id: "stream",
    label: "Live stream",
    icon: "📺",
    blurb: "Paste a stream link. Viewers watch and bet on the same page.",
    needsFlag: "live_events_enabled",
  },
  {
    id: "duel",
    label: "Prediction duel",
    icon: "⚔️",
    blurb: "Stake VIBE on opposite sides of an open market.",
    needsFlag: "duels_enabled",
  },
  {
    id: "arcade",
    label: "Arcade",
    icon: "🎲",
    blurb: "Coin flip & dice duel — instant luck games.",
    needsFlag: "arcade_games_enabled",
    href: "/games/arcade",
  },
] as const;

export function GameCreateHub({
  markets,
  flags,
}: {
  markets: { id: string; question: string }[];
  flags: {
    liveOn: boolean;
    duelsOn: boolean;
    arcadeOn: boolean;
  };
}) {
  const flagMap = {
    live_events_enabled: flags.liveOn,
    duels_enabled: flags.duelsOn,
    arcade_games_enabled: flags.arcadeOn,
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-2 sm:grid-cols-2">
        {TABS.map((tab) => {
          const on = flagMap[tab.needsFlag as keyof typeof flagMap];
          if ("href" in tab && tab.href) {
            return (
              <Link
                key={tab.id}
                href={on ? tab.href : "#"}
                className={`rounded-xl border p-4 text-left transition ${
                  on
                    ? "border-fuchsia-500/30 bg-fuchsia-500/5 hover:border-fuchsia-400/50"
                    : "border-white/5 bg-zinc-900/30 opacity-60 pointer-events-none"
                }`}
              >
                <p className="text-lg">{tab.icon}</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">{tab.label}</p>
                <p className="mt-1 text-xs text-zinc-500">{tab.blurb}</p>
                {!on && (
                  <p className="mt-2 text-[10px] text-amber-300">
                    Enable {tab.needsFlag} in Admin
                  </p>
                )}
              </Link>
            );
          }
          return (
            <div
              key={tab.id}
              className={`rounded-xl border p-4 ${
                on
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-white/5 bg-zinc-900/30"
              }`}
            >
              <p className="text-lg">{tab.icon}</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">{tab.label}</p>
              <p className="mt-1 text-xs text-zinc-500">{tab.blurb}</p>
              {!on && (
                <p className="mt-2 text-[10px] text-amber-300">
                  Enable {tab.needsFlag} in Admin
                </p>
              )}
            </div>
          );
        })}
      </div>

      {flags.liveOn ? (
        <CreateLiveEventForm />
      ) : (
        <section className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-5">
          <h2 className="text-sm font-semibold text-fuchsia-100">
            📺 Live stream (paste YouTube / Twitch link)
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Hosts paste a stream URL — viewers see the embed and bet panel on one page
            at <code className="font-mono">/live/[id]</code>. Enable{" "}
            <code className="font-mono">live_events_enabled</code> in Admin to unlock
            the form below.
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-zinc-500">
            <li>Copy a YouTube or Twitch link</li>
            <li>Title your event + name the two sides (Team A / Team B)</li>
            <li>Share the watch link — betting opens automatically</li>
          </ol>
        </section>
      )}

      {flags.duelsOn && (
        <div>
          <CreateDuelForm markets={markets} />
          <p className="mt-2 text-xs text-zinc-500">
            Enable <code className="font-mono">duel_spectator_markets_enabled</code> so
            viewers get a bet-on-who-wins market when your duel is accepted.
          </p>
        </div>
      )}

    </div>
  );
}

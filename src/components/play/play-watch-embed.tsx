import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { getLiveEvents } from "@/lib/live-events";
import { getActiveSpectatorDuels } from "@/lib/duels";
import {
  fetchDiscoveredStreamsWithMeta,
  streamWatchHref,
  type DiscoveredStream,
} from "@/lib/stream-discovery";
import { StreamEmbed } from "@/components/stream-embed";
import { DuelSpectatorStrip } from "@/components/duel-spectator-strip";
import { ArenaRaidBanner } from "@/components/arena-raid-banner";
import { getActiveArenaRaid } from "@/lib/arena-raid";
import { createClient } from "@/lib/supabase/server";

/** Embedded Watch tab — streams + spectator duels inline. */
export async function PlayWatchEmbed() {
  const [liveOn, duelsOn, spectatorOn, raidOn] = await Promise.all([
    isEnabled("live_events_enabled"),
    isEnabled("duels_enabled"),
    isEnabled("duel_spectator_markets_enabled"),
    isEnabled("arena_raid_enabled"),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!liveOn) {
    return (
      <p className="text-sm text-zinc-500">
        Watch hub is rolling out. Check back soon or browse{" "}
        <Link href="/markets" className="text-fuchsia-400 hover:underline">
          markets
        </Link>
        .
      </p>
    );
  }

  const [events, duels, discovery, raid] = await Promise.all([
    getLiveEvents(6),
    duelsOn && spectatorOn ? getActiveSpectatorDuels(8) : Promise.resolve([]),
    fetchDiscoveredStreamsWithMeta({ youtubeLimit: 6, twitchLimit: 6 }),
    raidOn ? getActiveArenaRaid() : Promise.resolve(null),
  ]);

  const featured: DiscoveredStream | null = discovery.streams[0] ?? null;
  const liveNow = events.filter((e) => e.status === "live").slice(0, 4);

  return (
    <div className="space-y-6">
      {raid && <ArenaRaidBanner raid={raid} isLoggedIn={Boolean(user)} />}

      {featured && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
          <div className="aspect-video w-full bg-black">
            <StreamEmbed streamUrl={featured.watchUrl} title={featured.title} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">{featured.title}</p>
              <p className="text-xs text-zinc-500">{featured.channel}</p>
            </div>
            <Link
              href={streamWatchHref(featured)}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              Watch & bet →
            </Link>
          </div>
        </div>
      )}

      {duels.length > 0 && <DuelSpectatorStrip duels={duels} />}

      {liveNow.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Hosted live
          </h3>
          <ul className="mt-2 space-y-2">
            {liveNow.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/live/${e.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/8 bg-zinc-900/40 px-3 py-2 text-sm hover:border-sky-500/30"
                >
                  <span className="text-zinc-200">{e.title}</span>
                  <span className="text-[10px] font-bold uppercase text-rose-300">
                    Live
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/live" className="play-hub__link">
          Full Watch hub →
        </Link>
        <Link href="/apps" className="play-hub__link">
          Platform Apps →
        </Link>
        <Link href="/games/create" className="play-hub__link">
          Host a stream →
        </Link>
      </div>
    </div>
  );
}

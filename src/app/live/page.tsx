import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { getLiveEvents } from "@/lib/live-events";
import { getActiveSpectatorDuels } from "@/lib/duels";
import { fetchDiscoveredStreams, streamDiscoveryConfigured } from "@/lib/stream-discovery";
import { LIVE_EVENT_CATEGORIES } from "@/lib/stream-url";
import { formatVibe } from "@/lib/utils";

export const revalidate = 0;

function categoryMeta(id: string) {
  return LIVE_EVENT_CATEGORIES.find((c) => c.id === id) ?? LIVE_EVENT_CATEGORIES[4];
}

export default async function LiveHubPage() {
  const [enabled, duelsOn, spectatorOn] = await Promise.all([
    isEnabled("live_events_enabled"),
    isEnabled("duels_enabled"),
    isEnabled("duel_spectator_markets_enabled"),
  ]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Watch hub off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">live_events_enabled</code> in Admin.
        </p>
        <Link href="/games" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
          ← Live Arena (Up/Down)
        </Link>
      </div>
    );
  }

  const [events, duels, discovered] = await Promise.all([
    getLiveEvents(40),
    duelsOn && spectatorOn ? getActiveSpectatorDuels(12) : Promise.resolve([]),
    fetchDiscoveredStreams({ youtubeLimit: 20 }),
  ]);

  const liveNow = events.filter((e) => e.status === "live");
  const upcoming = events.filter((e) => e.status === "scheduled");
  const hasDiscovery = discovered.length > 0;
  const discoveryHint = !streamDiscoveryConfigured();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Watch hub</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Hosted streams, live duels, and trending Twitch / YouTube — bet alongside
            or jump into the Live Arena for auto-resolved windows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/games"
            className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            Live Arena
          </Link>
          <Link
            href="/games/duels"
            className="rounded-md border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
          >
            Duel hub
          </Link>
          <Link
            href="/games/create"
            className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500"
          >
            Host a stream
          </Link>
        </div>
      </div>

      {duels.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Duels in progress
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {duels.map((d) => (
              <li key={d.duel_id}>
                <Link
                  href={d.spectator_market_id ? `/markets/${d.spectator_market_id}` : "/games/duels"}
                  className="block rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-violet-500/35"
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-300">
                    Spectator duel
                  </span>
                  <p className="mt-2 font-medium leading-snug text-zinc-100">{d.market_question}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {d.challenger_name} vs {d.opponent_name}
                    {d.stake ? ` · ${formatVibe(d.stake)} VIBE` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {liveNow.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-400">
            Live now (hosted)
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {liveNow.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {upcoming.length > 0 ? "Scheduled" : "Hosted events"}
        </h2>
        {events.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-8 text-center">
            <p className="text-sm text-zinc-400">No hosted streams yet.</p>
            <Link
              href="/games/create"
              className="mt-3 inline-block text-sm text-fuchsia-400 hover:underline"
            >
              Host the first one →
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(upcoming.length > 0 ? upcoming : events).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
            Live on YouTube
          </h2>
          {discoveryHint && (
            <p className="text-[11px] text-zinc-500">
              Add <code className="font-mono">YOUTUBE_API_KEY</code> in Vercel env to enable.
            </p>
          )}
        </div>
        {hasDiscovery ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {discovered.slice(0, 20).map((s) => (
              <li key={s.id}>
                <a
                  href={s.watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-white/5 bg-zinc-900/40 transition hover:border-sky-500/35"
                >
                  {s.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-zinc-800/60 text-xs text-zinc-500">
                      No preview
                    </div>
                  )}
                  <div className="p-3">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">
                      {s.provider}
                      {s.viewerCount > 0 ? ` · ${s.viewerCount.toLocaleString()} watching` : ""}
                    </span>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-zinc-100">
                      {s.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{s.channel}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-zinc-900/20 p-6 text-sm text-zinc-500">
            External stream discovery uses the YouTube Data API (server-side fetch).
            Add <code className="font-mono">YOUTUBE_API_KEY</code> to show top live streams here.
            Twitch can be added later when your dev account has 2FA enabled.
          </div>
        )}
      </section>
    </div>
  );
}

function EventCard({
  event: e,
}: {
  event: Awaited<ReturnType<typeof getLiveEvents>>[number];
}) {
  const cat = categoryMeta(e.category);
  return (
    <li>
      <Link
        href={`/live/${e.id}`}
        className="block rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-fuchsia-500/35"
      >
        <div className="flex items-center gap-2">
          {e.status === "live" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
              Live
            </span>
          )}
          <span className="text-xs text-zinc-500">
            {cat.icon} {cat.label}
          </span>
        </div>
        <p className="mt-2 font-medium leading-snug text-zinc-100">{e.title}</p>
        <p className="mt-1 text-xs text-zinc-500">Host: {e.creator_name}</p>
        {e.betting_market_id && (
          <p className="mt-2 text-xs text-fuchsia-300">Betting open →</p>
        )}
      </Link>
    </li>
  );
}

import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";
import { getLiveEvents } from "@/lib/live-events";
import { LIVE_EVENT_CATEGORIES } from "@/lib/stream-url";

export const revalidate = 0;

function categoryMeta(id: string) {
  return LIVE_EVENT_CATEGORIES.find((c) => c.id === id) ?? LIVE_EVENT_CATEGORIES[4];
}

export default async function LiveHubPage() {
  const enabled = await isEnabled("live_events_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Live hub off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">live_events_enabled</code> in Admin.
        </p>
        <Link href="/games" className="mt-4 inline-block text-sm text-emerald-400 hover:underline">
          ← Live Arena
        </Link>
      </div>
    );
  }

  const events = await getLiveEvents(40);
  const liveNow = events.filter((e) => e.status === "live");
  const upcoming = events.filter((e) => e.status === "scheduled");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/games" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Live Arena
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Watch &amp; Bet</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Live streams with side-by-side betting — volleyball, poker, chess,
            esports, or anything you host. YouTube and Twitch embeds supported.
          </p>
        </div>
        <Link
          href="/games/create"
          className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500"
        >
          Create a game
        </Link>
      </div>

      {liveNow.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-400">
            Live now
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
          {upcoming.length > 0 ? "Scheduled" : "All events"}
        </h2>
        {events.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-8 text-center">
            <p className="text-sm text-zinc-400">No live events yet.</p>
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

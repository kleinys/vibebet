import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";

export const revalidate = 0;

export default async function TryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [liveOn, duelsOn, paperOn, arcadeOn, arenaOn, fastOn, layerOn] =
    await Promise.all([
      isEnabled("live_events_enabled"),
      isEnabled("duels_enabled"),
      isEnabled("paper_trading_duels_enabled"),
      isEnabled("arcade_games_enabled"),
      isEnabled("live_arena_enabled"),
      isEnabled("fast_markets_enabled"),
      isEnabled("game_layer_enabled"),
    ]);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const links = [
    {
      title: "Watch & Bet (live streams)",
      desc: "Paste YouTube, Twitch, Kick, Vimeo, and more — watch and bet together.",
      href: "/live",
      on: liveOn,
      cta: "Browse live events",
    },
    {
      title: "Duel Games",
      desc: "RPS, High Card, dice — ranked head-to-head with matchmaking.",
      href: "/games/duels",
      on: layerOn || arcadeOn,
      cta: "Open duel hub",
    },
    {
      title: "Create a game",
      desc: "Host a stream, post a market duel, or open arcade games.",
      href: "/games/create",
      on: liveOn || duelsOn || paperOn || arcadeOn,
      cta: "Create",
    },
    {
      title: "Live Arena",
      desc: "Crypto up/down windows, equities, duel spectators — auto-resolved.",
      href: "/games",
      on: arenaOn || fastOn,
      cta: "Open Live Arena",
    },
    {
      title: "Arcade",
      desc: "Coin flip & dice duel — instant luck games.",
      href: "/games/arcade",
      on: arcadeOn,
      cta: "Play arcade",
    },
    {
      title: "Sign up (1,000 VIBE free)",
      desc: "Play-money only — no real cash.",
      href: user ? "/games" : "/signup",
      on: true,
      cta: user ? "Go to app" : "Create account",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-400">
          Try Vibebet
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Watch. Bet. Play.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
          Share this page with friends — play-money prediction markets, live streams
          with side-by-side betting, and mini-games. No real money.
        </p>
        <p className="mt-4 break-all text-xs text-zinc-600">
          Share link: {base}/try
        </p>
      </div>

      <ul className="mt-10 space-y-4">
        {links.map((item) => (
          <li
            key={item.title}
            className={`rounded-xl border p-5 ${
              item.on
                ? "border-white/10 bg-zinc-900/50"
                : "border-white/5 bg-zinc-950/50 opacity-70"
            }`}
          >
            <h2 className="font-semibold text-zinc-100">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-400">{item.desc}</p>
            {!item.on && (
              <p className="mt-2 text-xs text-amber-300/90">
                Not enabled yet — flip the flag in Admin or ask the host.
              </p>
            )}
            <Link
              href={item.on ? item.href : "/login"}
              className={`mt-4 inline-flex rounded-md px-4 py-2 text-sm font-medium ${
                item.on
                  ? "bg-fuchsia-600 text-white hover:bg-fuchsia-500"
                  : "border border-white/10 text-zinc-400"
              }`}
            >
              {item.on ? item.cta : "Sign in"}
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-12 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-zinc-300">
        <h3 className="font-semibold text-emerald-200">Launch a stream event (hosts)</h3>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-zinc-400">
          <li>
            Admin → enable <code className="font-mono">live_events_enabled</code>
          </li>
          <li>
            Go to <Link href="/games/create" className="text-fuchsia-400 hover:underline">/games/create</Link> →{" "}
            <strong>Host a live stream</strong>
          </li>
          <li>Paste YouTube or Twitch URL, name your sides, click Go live</li>
          <li>
            Share <code className="font-mono">/live/[event-id]</code> — embed + betting
            on one screen
          </li>
        </ol>
      </section>
    </div>
  );
}

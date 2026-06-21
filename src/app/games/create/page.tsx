import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { listMarkets } from "@/lib/markets";
import { GameCreateHub } from "@/components/game-create-hub";

export const revalidate = 0;

export default async function GameCreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/create");

  const [duelsOn, paperOn, liveOn, arcadeOn, arenaOn] = await Promise.all([
    isEnabled("duels_enabled"),
    isEnabled("paper_trading_duels_enabled"),
    isEnabled("live_events_enabled"),
    isEnabled("arcade_games_enabled"),
    isEnabled("live_arena_enabled"),
  ]);

  if (!duelsOn && !paperOn && !liveOn && !arcadeOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Game creation off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable at least one flag in Admin:{" "}
          <code className="font-mono">live_events_enabled</code>,{" "}
          <code className="font-mono">duels_enabled</code>,{" "}
          <code className="font-mono">paper_trading_duels_enabled</code>, or{" "}
          <code className="font-mono">arcade_games_enabled</code>.
        </p>
        <Link href="/try" className="mt-4 inline-block text-sm text-fuchsia-400 hover:underline">
          Public try page →
        </Link>
      </div>
    );
  }

  const markets = duelsOn
    ? (await listMarkets({ status: "open", limit: 40 }))
        .filter((m) => m.kind === "binary")
        .map((m) => ({ id: m.id, question: m.question }))
    : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={arenaOn ? "/games" : "/try"}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← {arenaOn ? "Live Arena" : "Try Vibebet"}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Create a game</h1>
      <p className="mt-1 text-sm text-zinc-400">
        <strong className="text-zinc-200">Live stream:</strong> paste a YouTube/Twitch
        URL → viewers watch + bet together. Or post a duel, return race, or arcade game.
      </p>

      <GameCreateHub
        markets={markets}
        flags={{ liveOn, duelsOn, paperOn, arcadeOn }}
      />
    </div>
  );
}

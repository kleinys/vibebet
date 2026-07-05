import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { GAME_CATALOG, liveGames } from "@/lib/game-catalog";

export const revalidate = 0;

const KIND_LABELS = {
  luck: "Luck",
  skill: "Skill",
  prediction: "Prediction",
  oracle: "Auto-settled",
} as const;

export default async function DuelsHubPage() {
  const [layerOn, duelsOn, arcadeOn, paperOn, fastOn, triviaOn, connect4On, liarsOn, chessOn, checkersOn, goOn, shogiOn, pokerOn] =
    await Promise.all([
    isEnabled("game_layer_enabled"),
    isEnabled("duels_enabled"),
    isEnabled("arcade_games_enabled"),
    isEnabled("paper_trading_duels_enabled"),
    isEnabled("fast_markets_enabled"),
    isEnabled("trivia_enabled"),
    isEnabled("connect4_enabled"),
    isEnabled("liars_dice_enabled"),
    isEnabled("chess_enabled"),
    isEnabled("checkers_enabled"),
    isEnabled("go_enabled"),
    isEnabled("shogi_enabled"),
    isEnabled("poker_enabled"),
  ]);

  const flags = {
    game_layer_enabled: layerOn,
    duels_enabled: duelsOn,
    arcade_games_enabled: arcadeOn,
    paper_trading_duels_enabled: paperOn,
    fast_markets_enabled: fastOn,
    trivia_enabled: triviaOn,
    connect4_enabled: connect4On,
    liars_dice_enabled: liarsOn,
    chess_enabled: chessOn,
    checkers_enabled: checkersOn,
    go_enabled: goOn,
    shogi_enabled: shogiOn,
    poker_enabled: pokerOn,
  };

  const playable = liveGames(flags);
  const comingSoon = GAME_CATALOG.filter((g) => g.status === "coming_soon");

  let myRatings: { game_key: string; rating: number; wins: number; losses: number }[] = [];
  let leaderboards: Record<
    string,
    { display_name: string; rating: number; wins: number; losses: number }[]
  > = {};

  if (layerOn) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("game_player_ratings")
        .select("game_key, rating, wins, losses")
        .eq("user_id", user.id)
        .gt("games_played", 0);
      myRatings = (data ?? []) as typeof myRatings;
    }

    const [rpsLb, hcLb, c4Lb] = await Promise.all([
      supabase.rpc("get_game_leaderboard", { p_game_key: "rps", p_limit: 5 }),
      supabase.rpc("get_game_leaderboard", { p_game_key: "high_card", p_limit: 5 }),
      connect4On
        ? supabase.rpc("get_game_leaderboard", { p_game_key: "connect4", p_limit: 5 })
        : Promise.resolve({ data: [] }),
    ]);
    leaderboards = {
      rps: (rpsLb.data ?? []) as (typeof leaderboards)["rps"],
      high_card: (hcLb.data ?? []) as (typeof leaderboards)["high_card"],
      connect4: (c4Lb.data ?? []) as (typeof leaderboards)["connect4"],
    };
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/games" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Live Arena
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Duel Games</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        Head-to-head play-money duels with open challenges, online matchmaking, instant{" "}
        <strong className="font-normal text-emerald-300">Play vs Bot</strong> on luck games, and ELO
        ratings. Post a stake — someone takes the other side. Challenge a friend by their
        player code, or tick <strong className="font-normal text-zinc-300">Friendly match</strong> to
        skip ELO changes.
      </p>

      {layerOn && (
        <div className="mt-6">
          <PlayerCodeCard />
        </div>
      )}

      {!layerOn && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Enable <code className="font-mono">game_layer_enabled</code> in Admin to unlock
          RPS and High Card. Arcade games use{" "}
          <code className="font-mono">arcade_games_enabled</code>.
        </p>
      )}

      {myRatings.length > 0 && (
        <section className="mt-8 rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Your ratings
          </h2>
          <ul className="mt-3 flex flex-wrap gap-4 text-sm">
            {myRatings.map((r) => (
              <li key={r.game_key} className="rounded-lg bg-zinc-800/60 px-3 py-2">
                <span className="font-medium capitalize">{r.game_key.replace("_", " ")}</span>
                <span className="ml-2 text-fuchsia-300">{r.rating} ELO</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {r.wins}W / {r.losses}L
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-emerald-400">Play now</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {playable.map((g) => (
            <li
              key={g.key}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xl">{g.emoji}</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                  {KIND_LABELS[g.kind]}
                </span>
              </div>
              <p className="mt-2 font-medium text-zinc-100">{g.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{g.description}</p>
              {g.href && (
                <Link
                  href={g.href}
                  className="mt-3 inline-block text-sm font-medium text-emerald-400 hover:underline"
                >
                  Play →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {layerOn &&
        (leaderboards.rps?.length > 0 ||
          leaderboards.high_card?.length > 0 ||
          leaderboards.connect4?.length > 0) && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-zinc-200">Leaderboards</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  { key: "rps", label: "Rock Paper Scissors" },
                  { key: "high_card", label: "High Card" },
                  { key: "connect4", label: "Connect Four" },
                  { key: "lightning", label: "Lightning Duel" },
                  { key: "trivia", label: "Trivia Blitz" },
                ] as const
              ).map(({ key, label }) =>
                leaderboards[key]?.length ? (
                  <div
                    key={key}
                    className="rounded-xl border border-white/5 bg-zinc-900/40 p-4"
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {label}
                    </h3>
                    <ol className="mt-3 space-y-2 text-sm">
                      {leaderboards[key].map((row, i) => (
                        <li key={i} className="flex justify-between text-zinc-300">
                          <span>
                            {i + 1}. {row.display_name}
                          </span>
                          <span className="text-fuchsia-300">{row.rating}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null,
              )}
            </div>
          </section>
        )}

      {duelsOn && (
        <section className="mt-10 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
          <h2 className="text-sm font-semibold text-violet-200">Market duels</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Not a mini-game — stake VIBE head-to-head on an existing prediction market (YES vs
            NO). Winner takes both stakes when the market resolves. Different from solo betting
            where you trade shares with the whole crowd.
          </p>
          <Link
            href="/duels"
            className="mt-3 inline-block text-sm font-medium text-violet-300 hover:underline"
          >
            Go to market duels →
          </Link>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-400">Coming soon</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {comingSoon.map((g) => (
            <li
              key={g.key}
              className="rounded-xl border border-white/5 bg-zinc-900/30 p-4 opacity-80"
            >
              <span className="text-2xl">{g.emoji}</span>
              <p className="mt-2 font-medium text-zinc-300">{g.name}</p>
              <p className="mt-1 text-xs text-zinc-600">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

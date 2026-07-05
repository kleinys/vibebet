import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { SkillGameLobby } from "@/components/skill-game-lobby";

export const revalidate = 0;

export default async function ChessPage() {
  const enabled = await isEnabled("chess_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Chess off</h1>
        <p className="mt-2 text-sm text-zinc-400">Enable chess_enabled in Admin.</p>
        <Link href="/games/duels" className="mt-4 inline-block text-sm text-zinc-400 hover:underline">
          ← Duel hub
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/duels/chess");

  const { data } = await supabase.rpc("get_open_chess_games", { p_limit: 20 });
  const { data: liveGames } = await supabase.rpc("get_live_chess_games", { p_limit: 12 }).then(
    (r) => r,
    () => ({ data: [] }),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">♟️ Chess</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Rated chess duels — or hit <span className="text-emerald-300">Play vs Bot</span> for an instant friendly match.
      </p>
      <div className="mt-6">
        <SkillGameLobby
          gameKey="chess"
          title="Post chess duel"
          description="Creator = White, joiner = Black. Locked after both move once. Offer draw needs agreement."
          accentClass="border-stone-500/20 bg-stone-500/5"
          buttonClass="bg-stone-600 hover:bg-stone-500"
          openGames={(data ?? []) as never[]}
          userId={user.id}
        />
      </div>

      {(liveGames ?? []).length > 0 && (
        <section className="mt-10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Live games — watch
          </h3>
          <ul className="mt-3 space-y-2">
            {(liveGames ?? []).map(
              (g: {
                id: string;
                creator_name: string;
                opponent_name: string;
                is_friendly: boolean;
                stake: number;
                move_count: number;
                status: string;
              }) => (
                <li key={g.id}>
                  <Link
                    href={`/games/duels/chess/${g.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-sm hover:border-violet-400/40"
                  >
                    <span>
                      {g.creator_name} vs {g.opponent_name}
                      {g.is_friendly ? (
                        <span className="ml-2 text-[10px] text-sky-400">friendly</span>
                      ) : (
                        <> · {g.stake} VIBE</>
                      )}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {g.status === "matched" ? "Warm-up" : "In progress"} · {g.move_count} moves
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
          <p className="mt-2 text-xs text-zinc-600">
            Spectator betting on skill games is not live yet — watch only for now.
          </p>
        </section>
      )}

      <div className="mt-10">
        <PlayerCodeCard />
      </div>
    </div>
  );
}

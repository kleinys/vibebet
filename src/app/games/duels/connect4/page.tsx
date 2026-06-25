import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { Connect4Panel } from "../connect4-panels";

export const revalidate = 0;

async function getOpenConnect4Games() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_open_connect4_games", { p_limit: 20 });
  return (data ?? []) as {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
    is_friendly: boolean;
    invited_user_id: string | null;
  }[];
}

export default async function Connect4Page() {
  const enabled = await isEnabled("connect4_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Connect Four off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">connect4_enabled</code> in Admin.
        </p>
        <Link href="/games/duels" className="mt-4 inline-block text-sm text-indigo-400 hover:underline">
          ← Duel hub
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/duels/connect4");

  const openGames = await getOpenConnect4Games();
  const { data: liveGames } = await supabase.rpc("get_live_connect4_games", { p_limit: 12 }).then(
    (r) => r,
    () => ({ data: [] }),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">🔴 Connect Four</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Drop discs — first to connect four wins. Challenge a friend by their player code.
      </p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <Connect4Panel openGames={openGames} userId={user.id} />
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
                    href={`/games/duels/connect4/${g.id}`}
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
        </section>
      )}
    </div>
  );
}

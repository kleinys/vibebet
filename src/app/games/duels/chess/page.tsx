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

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">♟️ Chess</h1>
      <p className="mt-1 text-sm text-zinc-400">Rated chess duels — challenge friends by player code.</p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <SkillGameLobby
          gameKey="chess"
          title="Post chess duel"
          description="Standard rules. Winner takes 90% of the pool. Friendly = free, no ELO."
          accentClass="border-stone-500/20 bg-stone-500/5"
          buttonClass="bg-stone-600 hover:bg-stone-500"
          openGames={(data ?? []) as never[]}
          userId={user.id}
        />
      </div>
    </div>
  );
}

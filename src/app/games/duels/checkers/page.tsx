import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { SkillGameLobby } from "@/components/skill-game-lobby";

export const revalidate = 0;

export default async function CheckersPage() {
  const enabled = await isEnabled("checkers_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Checkers off</h1>
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
  if (!user) redirect("/login?next=/games/duels/checkers");

  const { data } = await supabase.rpc("get_open_checkers_games", { p_limit: 20 });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">⬛ Checkers</h1>
      <p className="mt-1 text-sm text-zinc-400">American checkers — jump captures, king promotion.</p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <SkillGameLobby
          gameKey="checkers"
          title="Post checkers duel"
          description="8×8 checkers. Winner takes 90% of the pool."
          accentClass="border-amber-500/20 bg-amber-500/5"
          buttonClass="bg-amber-700 hover:bg-amber-600"
          openGames={(data ?? []) as never[]}
          userId={user.id}
        />
      </div>
    </div>
  );
}

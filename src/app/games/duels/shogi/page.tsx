import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { SkillGameLobby } from "@/components/skill-game-lobby";
import { acceptShogiGame, cancelShogiGame, createShogiGame } from "../shogi-actions";

export const revalidate = 0;

export default async function ShogiPage() {
  const enabled = await isEnabled("shogi_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Shogi off</h1>
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
  if (!user) redirect("/login?next=/games/duels/shogi");

  const { data } = await supabase.rpc("get_open_shogi_games", { p_limit: 20 });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">将 Shogi</h1>
      <p className="mt-1 text-sm text-zinc-400">Japanese chess — drops and promotions.</p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <SkillGameLobby
          title="Post shogi duel"
          description="Standard 9×9 shogi. Winner takes 90% of the pool."
          accentClass="border-orange-500/20 bg-orange-500/5"
          buttonClass="bg-orange-700 hover:bg-orange-600"
          listPath="/games/duels/shogi"
          playPath={(id) => `/games/duels/shogi/${id}`}
          openGames={(data ?? []) as never[]}
          userId={user.id}
          createAction={createShogiGame}
          acceptAction={acceptShogiGame}
          cancelAction={cancelShogiGame}
        />
      </div>
    </div>
  );
}

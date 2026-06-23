import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { SkillGameAcceptButton } from "@/components/skill-game-accept-button";
import { ShogiBoard } from "../../shogi-board";

export const revalidate = 0;

export default async function ShogiGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isEnabled("shogi_enabled"))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/duels/shogi/${id}`);

  const { data } = await supabase.rpc("get_shogi_game", { p_game_id: id });
  const game = Array.isArray(data) ? data[0] : null;
  if (!game) notFound();

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/shogi" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Shogi
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Shogi</h1>
      {canJoin ? (
        <div className="mt-8 rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
          <SkillGameAcceptButton gameKey="shogi" gameId={id} className="rounded-md bg-orange-700 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50" />
        </div>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for opponent…</p>
      ) : (
        <div className="mt-8">
          <ShogiBoard
            gameId={id}
            sfen={game.sfen}
            currentTurnId={game.current_turn_id}
            userId={user.id}
            creatorId={game.creator_id}
            status={game.status}
            winnerId={game.winner_id}
          />
        </div>
      )}
    </div>
  );
}

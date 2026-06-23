import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { SkillGameAcceptButton } from "@/components/skill-game-accept-button";
import { CheckersBoard } from "../../checkers-board";
import type { CheckersCell } from "@/lib/checkers-engine";

export const revalidate = 0;

export default async function CheckersGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isEnabled("checkers_enabled"))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/duels/checkers/${id}`);

  const { data } = await supabase.rpc("get_checkers_game", { p_game_id: id });
  const game = Array.isArray(data) ? data[0] : null;
  if (!game) notFound();

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/checkers" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Checkers
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Checkers</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {game.creator_name} vs {game.opponent_name ?? "…"}
      </p>
      {canJoin ? (
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <SkillGameAcceptButton gameKey="checkers" gameId={id} className="mt-2 rounded-md bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50" />
        </div>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for opponent…</p>
      ) : (
        <div className="mt-8">
          <CheckersBoard
            gameId={id}
            board={(game.board ?? []) as CheckersCell[]}
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

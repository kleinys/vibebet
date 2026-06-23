import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { ChessBoard } from "../../chess-board";
import { SkillGameAcceptButton } from "@/components/skill-game-accept-button";
import { acceptChessGame } from "../../chess-actions";

export const revalidate = 0;

export default async function ChessGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isEnabled("chess_enabled"))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/duels/chess/${id}`);

  const { data } = await supabase.rpc("get_chess_game", { p_game_id: id });
  const game = Array.isArray(data) ? data[0] : null;
  if (!game) notFound();

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/chess" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Chess
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Chess</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {game.creator_name} vs {game.opponent_name ?? "…"}
        {game.is_friendly ? (
          <span className="ml-2 text-sky-300">· friendly</span>
        ) : (
          <> · {game.stake} VIBE</>
        )}
      </p>

      {canJoin ? (
        <div className="mt-8 rounded-xl border border-stone-500/20 bg-stone-500/5 p-5">
          <p className="text-sm text-zinc-300">Join this chess duel?</p>
          <SkillGameAcceptButton
            gameId={id}
            acceptAction={acceptChessGame}
            className="mt-4 rounded-md bg-stone-600 px-4 py-2 text-sm font-medium text-white hover:bg-stone-500 disabled:opacity-50"
          />
        </div>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for opponent…</p>
      ) : (
        <div className="mt-8">
          <ChessBoard
            gameId={id}
            fen={game.fen}
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { ChessBoard } from "../../chess-board";
import { SkillGameAcceptButton } from "@/components/skill-game-accept-button";
import { WaitForOpponentPanel } from "@/components/wait-for-opponent-panel";
import { serverEnv } from "@/lib/env";

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

  const isParticipant = game.creator_id === user.id || game.opponent_id === user.id;
  const isSpectator =
    !isParticipant && ["matched", "active", "settled", "draw"].includes(game.status);

  if (!isParticipant && game.status === "open") {
    if (game.invited_user_id && game.invited_user_id !== user.id) notFound();
  } else if (!isParticipant && !isSpectator) {
    notFound();
  }

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  const siteUrl = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const gameUrl = `${siteUrl}/games/duels/chess/${id}`;
  const isCreatorWaiting = game.status === "open" && game.creator_id === user.id;

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
        {isSpectator && <span className="ml-2 text-violet-300">· spectator</span>}
      </p>
      {game.status === "matched" && isParticipant && (
        <p className="mt-2 text-xs text-amber-300/90">
          Sides locked: {game.creator_name} = White, {game.opponent_name} = Black. Game locks after
          both players make one move each. No clock yet.
        </p>
      )}

      {canJoin ? (
        <div className="mt-8 rounded-xl border border-stone-500/20 bg-stone-500/5 p-5">
          <p className="text-sm text-zinc-300">Join this chess duel?</p>
          <SkillGameAcceptButton
            gameKey="chess"
            gameId={id}
            className="mt-4 rounded-md bg-stone-600 px-4 py-2 text-sm font-medium text-white hover:bg-stone-500 disabled:opacity-50"
          />
        </div>
      ) : isCreatorWaiting ? (
        <>
          <WaitForOpponentPanel
            gameUrl={gameUrl}
            invitedName={game.invited_user_id ? "your invitee" : null}
          />
          <div className="mt-8 opacity-80">
            <p className="mb-2 text-xs text-zinc-500">Board preview (game starts when they join)</p>
            <ChessBoard
              gameId={id}
              fen={game.fen}
              currentTurnId={null}
              userId={user.id}
              creatorId={game.creator_id}
              status="open"
              winnerId={null}
            />
          </div>
        </>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">This game is waiting for another player.</p>
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
            moveCount={game.move_count ?? 0}
            drawOfferedBy={game.draw_offered_by}
            isSpectator={isSpectator}
          />
        </div>
      )}
    </div>
  );
}

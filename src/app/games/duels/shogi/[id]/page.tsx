import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { SkillGameAcceptButton } from "@/components/skill-game-accept-button";
import { WaitForOpponentPanel } from "@/components/wait-for-opponent-panel";
import { SkillSpectatorPanel } from "@/components/skill-spectator-panel";
import { WatchLinkBar } from "@/components/watch-link-bar";
import { WinSharePanel } from "@/components/win-share-panel";
import { watchSkillGameUrl } from "@/lib/site-url";
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

  const gameUrl = watchSkillGameUrl("shogi", id);
  const isCreatorWaiting = game.status === "open" && game.creator_id === user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const userWon =
    isParticipant && game.status === "settled" && game.winner_id === user.id;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/shogi" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Shogi
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Shogi</h1>
      {!isCreatorWaiting && game.status !== "open" && <WatchLinkBar url={gameUrl} />}
      {canJoin ? (
        <div className="mt-8 rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
          <SkillGameAcceptButton
            gameKey="shogi"
            gameId={id}
            className="rounded-md bg-orange-700 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
          />
        </div>
      ) : isCreatorWaiting ? (
        <WaitForOpponentPanel gameUrl={gameUrl} />
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for opponent…</p>
      ) : (
        <div className="mt-8">
          <SkillSpectatorPanel
            marketId={game.spectator_market_id}
            creatorName={game.creator_name}
            opponentName={game.opponent_name ?? "Opponent"}
            watchUrl={gameUrl}
          />
          <ShogiBoard
            gameId={id}
            sfen={game.sfen}
            currentTurnId={game.current_turn_id}
            userId={user.id}
            creatorId={game.creator_id}
            status={game.status}
            winnerId={game.winner_id}
            moveCount={game.move_count ?? 0}
            drawOfferedBy={game.draw_offered_by}
            isSpectator={isSpectator}
          />
          {userWon && (
            <WinSharePanel
              displayName={profile?.display_name ?? "Player"}
              username={profile?.username}
              headline="Won a shogi duel on Vibebet"
            />
          )}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { SkillGameAcceptButton } from "@/components/skill-game-accept-button";
import { PokerBoard } from "../../poker-board";
import type { PokerState } from "@/lib/poker-holdem";
import { DuelWinShareBlock } from "@/components/duel-win-share-block";

export const revalidate = 0;

export default async function PokerGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isEnabled("poker_enabled"))) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/duels/poker/${id}`);

  const { data } = await supabase.rpc("get_poker_game", { p_game_id: id });
  const game = Array.isArray(data) ? data[0] : null;
  if (!game) notFound();

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/poker" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Poker
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Hold&apos;em Showdown</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {game.creator_name} vs {game.opponent_name ?? "…"}
        {game.is_friendly ? (
          <span className="ml-2 text-sky-300">· friendly</span>
        ) : (
          <> · {game.stake} VIBE each</>
        )}
      </p>
      {canJoin ? (
        <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-sm text-zinc-300">Join and deal the hand?</p>
          <SkillGameAcceptButton gameKey="poker" gameId={id} className="mt-3 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50" />
        </div>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for opponent…</p>
      ) : (
        <div className="mt-8">
          <PokerBoard
            gameId={id}
            state={(game.state as PokerState | null) ?? null}
            status={game.status}
            winnerId={game.winner_id}
            userId={user.id}
            creatorId={game.creator_id}
            creatorHandRank={game.creator_hand_rank}
            opponentHandRank={game.opponent_hand_rank}
          />
          <DuelWinShareBlock
            userId={user.id}
            winnerId={game.winner_id}
            headline="Won Hold'em Showdown on Vibebet"
          />
        </div>
      )}
    </div>
  );
}

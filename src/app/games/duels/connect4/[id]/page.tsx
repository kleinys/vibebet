import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { Connect4Board } from "../../connect4-board";
import { AcceptConnect4Button } from "../../connect4-accept-button";

export const revalidate = 0;

export default async function Connect4GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enabled = await isEnabled("connect4_enabled");
  if (!enabled) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/duels/connect4/${id}`);

  const { data } = await supabase.rpc("get_connect4_game", { p_game_id: id });
  const game = Array.isArray(data) ? data[0] : null;
  if (!game) notFound();

  const isParticipant =
    game.creator_id === user.id ||
    game.opponent_id === user.id ||
    (game.status === "open" && game.invited_user_id === user.id);

  if (!isParticipant && game.status !== "open") notFound();
  if (game.status === "open" && game.invited_user_id && game.invited_user_id !== user.id) {
    notFound();
  }

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/connect4" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Connect Four
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Connect Four</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {game.creator_name} vs {game.opponent_name ?? "…"}
        {game.is_friendly ? (
          <span className="ml-2 text-sky-300">· friendly (free)</span>
        ) : (
          <> · {game.stake} VIBE</>
        )}
      </p>

      {canJoin ? (
        <div className="mt-8 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <p className="text-sm text-zinc-300">
            {game.creator_name} challenged you to Connect Four for {game.stake} VIBE.
          </p>
          <AcceptConnect4Button gameId={id} />
        </div>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for an opponent to join…</p>
      ) : (
        <div className="mt-8">
          <Connect4Board
            gameId={id}
            board={(game.board ?? []) as number[]}
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

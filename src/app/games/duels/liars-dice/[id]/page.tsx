import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { LiarsDicePlayPanel } from "../../liars-dice-panels";
import { acceptLiarsDiceGame } from "../../liars-dice-actions";

export const revalidate = 0;

async function acceptAndPlay(gameId: string) {
  "use server";
  const r = await acceptLiarsDiceGame(gameId);
  if (r.error) throw new Error(r.error);
  redirect(`/games/duels/liars-dice/${gameId}`);
}

export default async function LiarsDiceGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enabled = await isEnabled("liars_dice_enabled");
  if (!enabled) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/games/duels/liars-dice/${id}`);

  const { data } = await supabase.rpc("get_liars_dice_game", { p_game_id: id });
  const game = Array.isArray(data) ? data[0] : null;
  if (!game) notFound();

  const isParticipant =
    game.creator_id === user.id ||
    game.opponent_id === user.id ||
    (game.status === "open" && game.invited_user_id === user.id);

  if (!isParticipant && game.status !== "open") notFound();

  const canJoin =
    game.status === "open" &&
    game.creator_id !== user.id &&
    (game.invited_user_id === null || game.invited_user_id === user.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/liars-dice" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Liar&apos;s Dice
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Liar&apos;s Dice</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {game.creator_name} vs {game.opponent_name ?? "…"}
        {game.is_friendly ? (
          <span className="ml-2 text-sky-300">· friendly (free)</span>
        ) : (
          <> · {game.stake} VIBE</>
        )}
      </p>

      {canJoin ? (
        <form action={acceptAndPlay.bind(null, id)} className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-sm text-zinc-300">Join this Liar&apos;s Dice game?</p>
          <button
            type="submit"
            className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            Accept &amp; play
          </button>
        </form>
      ) : game.status === "open" ? (
        <p className="mt-8 text-sm text-zinc-400">Waiting for an opponent…</p>
      ) : (
        <div className="mt-8">
          <LiarsDicePlayPanel
            gameId={id}
            myDice={(game.my_dice ?? null) as number[] | null}
            bidQuantity={game.bid_quantity}
            bidFace={game.bid_face}
            currentTurnId={game.current_turn_id}
            userId={user.id}
            lastBidderId={game.last_bidder_id}
            status={game.status}
            winnerId={game.winner_id}
            creatorDice={(game.creator_dice ?? null) as number[] | null}
            opponentDice={(game.opponent_dice ?? null) as number[] | null}
          />
        </div>
      )}
    </div>
  );
}

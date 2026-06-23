import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { SkillGameLobby } from "@/components/skill-game-lobby";
import { acceptPokerGame, cancelPokerGame, createPokerGame } from "../poker-actions";

export const revalidate = 0;

export default async function PokerPage() {
  const enabled = await isEnabled("poker_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Poker off</h1>
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
  if (!user) redirect("/login?next=/games/duels/poker");

  const { data } = await supabase.rpc("get_open_poker_games", { p_limit: 20 });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">🃏 Hold&apos;em Showdown</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Heads-up Texas hold&apos;em — both ante, deal streets, best hand wins the pot.
      </p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <SkillGameLobby
          title="Post poker duel"
          description="All-in at ante. Reveal flop → turn → river → showdown."
          accentClass="border-emerald-500/20 bg-emerald-500/5"
          buttonClass="bg-emerald-600 hover:bg-emerald-500"
          listPath="/games/duels/poker"
          playPath={(id) => `/games/duels/poker/${id}`}
          openGames={(data ?? []) as never[]}
          userId={user.id}
          createAction={createPokerGame}
          acceptAction={acceptPokerGame}
          cancelAction={cancelPokerGame}
        />
      </div>
    </div>
  );
}

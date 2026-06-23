import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { LiarsDicePanel } from "../liars-dice-panels";

export const revalidate = 0;

export default async function LiarsDicePage() {
  const enabled = await isEnabled("liars_dice_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Liar&apos;s Dice off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">liars_dice_enabled</code> in Admin.
        </p>
        <Link href="/games/duels" className="mt-4 inline-block text-sm text-amber-400 hover:underline">
          ← Duel hub
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/duels/liars-dice");

  const { data } = await supabase.rpc("get_open_liars_dice_games", { p_limit: 20 });
  const openGames = (data ?? []) as {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
    is_friendly: boolean;
    invited_user_id: string | null;
  }[];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">🎲 Liar&apos;s Dice</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Bluff, bid, and call liar — classic 1v1 dice duel.
      </p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <div className="mt-6">
        <LiarsDicePanel openGames={openGames} userId={user.id} />
      </div>
    </div>
  );
}

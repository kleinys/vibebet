import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import {
  getOpenPaperDuels,
  getActivePaperDuels,
  getMyPaperDuels,
} from "@/lib/paper-duels";
import { CreatePaperDuelForm } from "./create-paper-duel-form";
import { PaperDuelBoard } from "./paper-duel-board";

export const revalidate = 0;

export default async function PaperTradingPage() {
  const [enabled, arenaOn] = await Promise.all([
    isEnabled("paper_trading_duels_enabled"),
    isEnabled("live_arena_enabled"),
  ]);
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Return Races off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable{" "}
          <code className="font-mono">paper_trading_duels_enabled</code> in Admin
          {arenaOn ? " (Live Arena is already on — just flip this flag)." : "."}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Requires migration phase 23 if the flag is missing from Admin.
        </p>
        <Link href="/games" className="mt-4 inline-block text-sm text-cyan-400 hover:underline">
          ← Live Arena
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/paper");

  const [openDuels, activeDuels, myDuels] = await Promise.all([
    getOpenPaperDuels(25),
    getActivePaperDuels(15),
    getMyPaperDuels(20),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/games" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Live Arena
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Return Races</h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-400">
        Head-to-head crypto return duels — each player picks BTC, ETH, or SOL for
        5–15 minutes; highest % gain wins the pool. Oracle auto-settles. This is
        not Quick Exit on regular markets (85% of cost back).
      </p>

      <CreatePaperDuelForm />
      <PaperDuelBoard
        openDuels={openDuels}
        activeDuels={activeDuels}
        myDuels={myDuels}
        userId={user.id}
      />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { listMarkets } from "@/lib/markets";
import { getMyDuels, getOpenDuels, getActiveSpectatorDuels } from "@/lib/duels";
import { DuelBoard } from "./duel-board";
import { CreateDuelForm } from "./create-duel-form";

export const revalidate = 0;

export default async function DuelsPage() {
  const enabled = await isEnabled("duels_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Duels off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">duels_enabled</code> in Admin.
        </p>
        <Link href="/guide" className="mt-4 inline-block text-sm text-fuchsia-400 hover:underline">
          Read the Playbook →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/duels");

  const spectatorOn = await isEnabled("duel_spectator_markets_enabled");

  const [openDuels, myDuels, markets, spectatorDuels] = await Promise.all([
    getOpenDuels(25),
    getMyDuels(20),
    listMarkets({ status: "open", limit: 30 }),
    spectatorOn ? getActiveSpectatorDuels(12) : Promise.resolve([]),
  ]);

  const binaryMarkets = markets
    .filter((m) => m.kind === "binary")
    .map((m) => ({ id: m.id, question: m.question }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/guide" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Playbook
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Prediction Duels</h1>
        <Link
          href="/games/create"
          className="rounded-md border border-violet-500/40 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/10"
        >
          Create a game
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        Head-to-head VIBE stakes on open markets. Pick a side, lock your stake, and
        challenge a friend or leave it open for anyone.
        {spectatorOn && (
          <>
            {" "}
            When a duel is accepted, spectators can bet on who wins via a live side
            market.
          </>
        )}
      </p>

      <CreateDuelForm markets={binaryMarkets} />
      <DuelBoard
        openDuels={openDuels}
        myDuels={myDuels}
        spectatorDuels={spectatorDuels}
        userId={user.id}
      />
    </div>
  );
}

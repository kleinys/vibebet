import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getDuel } from "@/lib/duels";
import { getBalance } from "@/lib/ledger";
import { getUserPosition } from "@/lib/markets";
import { DuelWatchView } from "./duel-watch-view";

export const revalidate = 0;

export default async function DuelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await isEnabled("duels_enabled");
  if (!enabled) notFound();

  const { id } = await params;
  const duel = await getDuel(id);
  if (!duel) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const marketId = duel.spectator_market_id ?? duel.market_id;
  const [vibeBalance, position, quickExitEnabled] = await Promise.all([
    user ? getBalance(user.id, "vibe") : Promise.resolve(0),
    user ? getUserPosition(marketId, user.id) : Promise.resolve(null),
    isEnabled("quick_exit_enabled"),
  ]);

  return (
    <DuelWatchView
      duel={duel}
      userId={user?.id ?? null}
      vibeBalance={vibeBalance}
      yesShares={position?.yesShares ?? 0}
      noShares={position?.noShares ?? 0}
      totalCost={position?.totalCost ?? 0}
      quickExitEnabled={quickExitEnabled}
    />
  );
}

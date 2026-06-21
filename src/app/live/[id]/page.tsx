import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getLiveEvent } from "@/lib/live-events";
import { getBalance } from "@/lib/ledger";
import { getUserPosition } from "@/lib/markets";
import { LiveEventWatchView } from "./live-event-watch-view";

export const revalidate = 0;

export default async function LiveEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const enabled = await isEnabled("live_events_enabled");
  if (!enabled) notFound();

  const { id } = await params;
  const event = await getLiveEvent(id);
  if (!event) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reserveYes = 1500;
  let reserveNo = 1500;
  let yesLabel = "Side A";
  let noLabel = "Side B";
  let bettingOpen = false;

  if (event.betting_market_id) {
    const { data: market } = await supabase
      .from("markets")
      .select(
        "reserve_yes, reserve_no, outcome_yes_label, outcome_no_label, status",
      )
      .eq("id", event.betting_market_id)
      .maybeSingle();
    if (market) {
      reserveYes = market.reserve_yes;
      reserveNo = market.reserve_no;
      yesLabel = market.outcome_yes_label;
      noLabel = market.outcome_no_label;
      bettingOpen = market.status === "open";
    }
  }

  const [vibeBalance, position, quickExitEnabled] = await Promise.all([
    user ? getBalance(user.id, "vibe") : Promise.resolve(0),
    user && event.betting_market_id
      ? getUserPosition(event.betting_market_id, user.id)
      : Promise.resolve(null),
    isEnabled("quick_exit_enabled"),
  ]);

  return (
    <LiveEventWatchView
      event={event}
      isHost={user?.id === event.creator_id}
      vibeBalance={user ? vibeBalance : -1}
      yesShares={position?.yesShares ?? 0}
      noShares={position?.noShares ?? 0}
      totalCost={position?.totalCost ?? 0}
      yesLabel={yesLabel}
      noLabel={noLabel}
      reserveYes={reserveYes}
      reserveNo={reserveNo}
      bettingOpen={bettingOpen}
      quickExitEnabled={quickExitEnabled}
    />
  );
}

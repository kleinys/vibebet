import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { LightningLiveView } from "../../lightning-panels";
import { tickLightningDuels } from "../../lightning-actions";

export const revalidate = 0;

export default async function LightningDuelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enabled = await isEnabled("game_layer_enabled");
  if (!enabled) notFound();

  await tickLightningDuels();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data } = await supabase.rpc("get_lightning_duel", { p_duel_id: id });
  const duel = Array.isArray(data) ? data[0] : null;
  if (!duel) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels/lightning" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Lightning duels
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Lightning duel</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {duel.creator_name} vs {duel.opponent_name ?? "waiting…"} · {duel.stake} VIBE each
      </p>
      <div className="mt-6">
        <LightningLiveView duel={duel} userId={user.id} />
      </div>
    </div>
  );
}

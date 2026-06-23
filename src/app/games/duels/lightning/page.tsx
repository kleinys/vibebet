import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { LightningDuelPanel } from "../lightning-panels";

export const revalidate = 0;

async function getOpenLightningDuels() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_open_lightning_duels", { p_limit: 20 });
  return (data ?? []) as {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
    is_friendly: boolean;
    invited_user_id: string | null;
    creator_side: string;
    duration_sec: number;
  }[];
}

export default async function LightningDuelsPage() {
  const [layerOn, fastOn] = await Promise.all([
    isEnabled("game_layer_enabled"),
    isEnabled("fast_markets_enabled"),
  ]);
  if (!layerOn && !fastOn) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Lightning duels off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">game_layer_enabled</code> in Admin.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/duels/lightning");

  const openDuels = await getOpenLightningDuels();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">⚡ Lightning Duel</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Head-to-head BTC up/down for 60 seconds. Live price vs strike at accept.
      </p>
      <LightningDuelPanel openDuels={openDuels} userId={user.id} />
    </div>
  );
}

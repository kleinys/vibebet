import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { PlayerCodeCard } from "@/components/player-code-card";
import { RpsDuelPanel } from "../duel-panels";
import { getShareProfile } from "@/lib/share-profile";

export const revalidate = 0;

async function getOpenRpsDuels() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_open_rps_duels", { p_limit: 20 });
  return (data ?? []) as {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
    is_friendly: boolean;
    invited_user_id: string | null;
  }[];
}

export default async function RpsDuelsPage() {
  const enabled = await isEnabled("game_layer_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Game layer off</h1>
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
  if (!user) redirect("/login?next=/games/duels/rps");

  const openDuels = await getOpenRpsDuels();
  const shareProfile = (await getShareProfile(user.id)) ?? {
    displayName: "Player",
    username: null,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/games/duels" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Duel hub
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Rock Paper Scissors</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Head-to-head luck duel. Winner takes 90% of the pool.
      </p>
      <div className="mt-6">
        <PlayerCodeCard />
      </div>
      <RpsDuelPanel openDuels={openDuels} userId={user.id} shareProfile={shareProfile} />
    </div>
  );
}

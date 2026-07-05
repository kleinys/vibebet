import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { createClient as createSb } from "@/lib/supabase/server";
import { CoinFlipPanel, DiceDuelPanel } from "./arcade-panels";
import { getShareProfile } from "@/lib/share-profile";

export const revalidate = 0;

async function getOpenDiceDuels() {
  const supabase = await createSb();
  const { data } = await supabase.rpc("get_open_dice_duels", { p_limit: 15 });
  return (data ?? []) as {
    id: string;
    creator_id: string;
    creator_name: string;
    stake: number;
  }[];
}

export default async function ArcadePage() {
  const enabled = await isEnabled("arcade_games_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Arcade off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enable <code className="font-mono">arcade_games_enabled</code> in Admin.
        </p>
        <Link href="/try" className="mt-4 inline-block text-sm text-fuchsia-400 hover:underline">
          ← Try page
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/games/arcade");

  const openDuels = await getOpenDiceDuels();
  const shareProfile = (await getShareProfile(user.id)) ?? {
    displayName: "Player",
    username: null,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/try" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Try Vibebet
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Arcade</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Quick games — coin flip and dice duels. Plinko &amp; lucky slots live in the{" "}
        <Link href="/account/profile/arena" className="text-fuchsia-300 hover:underline">
          VIBE arena
        </Link>
        .
      </p>
      <div className="mt-8 space-y-8">
        <CoinFlipPanel shareProfile={shareProfile} />
        <DiceDuelPanel openDuels={openDuels} userId={user.id} shareProfile={shareProfile} />
      </div>
    </div>
  );
}

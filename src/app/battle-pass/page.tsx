import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveSeason, getBattlePassProgress } from "@/lib/battle-pass";
import { isEnabled } from "@/lib/feature-flags";
import { BattlePassClient } from "@/components/battle-pass-client";

export const revalidate = 0;

export default async function BattlePassPage() {
  const enabled = await isEnabled("battle_pass_enabled");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const season = await getActiveSeason();

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Battle Pass</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Season 1 is coded but the feature flag is off. An admin can enable{" "}
          <code className="rounded bg-zinc-800 px-1">battle_pass_enabled</code>{" "}
          at <Link href="/admin" className="text-fuchsia-400 hover:underline">/admin</Link>.
        </p>
      </div>
    );
  }

  if (!user) redirect("/login?next=/battle-pass");
  if (!season) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-zinc-500">
        No active season right now.
      </div>
    );
  }

  const progress = await getBattlePassProgress(user.id, season.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/guide" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Guide
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{season.name}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Earn XP from daily login (+15) and trades (+10). Claim VIBE at each tier.
        Ends {new Date(season.ends_at).toLocaleDateString()}.
      </p>

      <BattlePassClient
        season={season}
        progress={
          progress ?? {
            xp: 0,
            tier: 0,
            premium_unlocked: false,
            claimed_free: [],
            claimed_premium: [],
          }
        }
      />
    </div>
  );
}

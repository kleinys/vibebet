import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEquippedCosmetics } from "@/lib/cosmetics";
import { getCompanionInput } from "@/lib/companion-stats";
import { HypnoticArenaExperience } from "@/components/hypnotic/hypnotic-arena-experience";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { resolveFigureConfig } from "@/lib/companion-figure";
import { getAllBalances } from "@/lib/ledger";
import { getLockerMomentum, lockerMomentumToSession } from "@/lib/locker-momentum-server";

export const revalidate = 0;

export default async function LockerArenaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile/arena");

  const utcToday = new Date().toISOString().slice(0, 10);
  const [equipped, companionInput, balances, wheelDaily, lockerMomentum] = await Promise.all([
    getEquippedCosmetics(user.id).catch(() => ({ skin: null, badge: null })),
    getCompanionInput(user.id).catch(() => ({
      currentStreak: 0,
      streakShields: 0,
      inventoryCount: 0,
    })),
    getAllBalances(user.id).catch(() => ({ vibe: 0, gem: 0 })),
    supabase
      .from("locker_wheel_daily")
      .select("spins_used")
      .eq("user_id", user.id)
      .eq("spin_date", utcToday)
      .maybeSingle()
      .then((r) => r.data?.spins_used ?? 0),
    getLockerMomentum(user.id),
  ]);

  const figureConfig = resolveFigureConfig(companionInput);
  const skinSlug = equipped.skin?.slug ?? figureConfig.skinSlug;
  const initialSession = lockerMomentumToSession(lockerMomentum);

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/account/profile#trainer"
            className="text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            ← Trainer &amp; locker
          </Link>
          <div className="inline-flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-200">
            <CurrencyIconVibe className="h-4 w-4" />
            <span className="font-semibold tabular-nums">{formatVibe(balances.vibe)} VIBE</span>
          </div>
        </div>
      </div>

      <div className="px-2 py-2 sm:px-4 sm:py-3">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-zinc-900/70 to-zinc-950 shadow-2xl shadow-black/60 ring-1 ring-violet-500/20">
          <HypnoticArenaExperience
            figureConfig={figureConfig}
            vibeBalance={balances.vibe}
            spinsUsedToday={wheelDaily}
            equippedSkinSlug={skinSlug}
            initialSession={initialSession}
            initialAffinityLabel={lockerMomentum.affinityLabel ?? null}
          />
        </div>
      </div>
    </div>
  );
}

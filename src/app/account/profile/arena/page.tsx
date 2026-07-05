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
import { orbitModifierSummary } from "@/lib/orbit-affinity";

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
  const modifier = orbitModifierSummary(skinSlug);
  const initialSession = lockerMomentumToSession(lockerMomentum);

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="border-b border-white/5 bg-zinc-950/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400/90">
            VIBE arena
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-50 sm:text-3xl">
            Hypnotic play floor
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
            One tap to spin. Winnings flow into your spirit. Momentum builds — morph between
            wheel and case without breaking the trance.
          </p>
          {modifier && (
            <p className="mt-2 text-xs text-violet-300/80">
              {modifier.affinity.icon} {modifier.morphLabel} orbit active
            </p>
          )}
        </header>

        <div className="mt-6 overflow-hidden rounded-sm border border-white/10 bg-gradient-to-b from-zinc-900/60 to-zinc-950 shadow-2xl shadow-black/50 ring-1 ring-violet-500/15">
          <HypnoticArenaExperience
            figureConfig={figureConfig}
            vibeBalance={balances.vibe}
            spinsUsedToday={wheelDaily}
            equippedSkinSlug={skinSlug}
            initialSession={initialSession}
            initialAffinityLabel={lockerMomentum.affinityLabel ?? modifier?.affinity.label ?? null}
          />
        </div>
      </div>
    </div>
  );
}

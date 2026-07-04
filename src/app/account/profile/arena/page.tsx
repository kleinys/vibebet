import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEquippedCosmetics } from "@/lib/cosmetics";
import { getCompanionInput } from "@/lib/companion-stats";
import { CompanionLockerRewards } from "@/components/companion-locker-rewards";
import { ThemedProfileAvatar } from "@/components/themed-profile-avatar";
import { figureLabels, resolveFigureConfig } from "@/lib/companion-figure";
import { getAllBalances } from "@/lib/ledger";
import { orbitModifierSummary } from "@/lib/orbit-affinity";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";

export const revalidate = 0;

export default async function LockerArenaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile/arena");

  const utcToday = new Date().toISOString().slice(0, 10);
  const [equipped, companionInput, balances, wheelDaily] = await Promise.all([
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
  ]);

  const figureConfig = resolveFigureConfig(companionInput);
  const labels = figureLabels(figureConfig);
  const skinSlug = equipped.skin?.slug ?? figureConfig.skinSlug;
  const modifier = orbitModifierSummary(skinSlug);

  return (
    <div className="min-h-screen bg-[#020617]">
      <div className="border-b border-white/5 bg-zinc-950/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400/90">
            VIBE arena
          </p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-50 sm:text-4xl">
            Locker gambling floor
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
            Stake play-money VIBE on cases and the wheel. Your equipped trainer&apos;s orbit
            phenomenon applies an affinity modifier to how you play.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-sm border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950 shadow-xl shadow-black/40 ring-1 ring-violet-500/20">
          <div className="border-b border-white/5 px-4 py-2 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Active loadout
            </span>
          </div>
          <div className="flex flex-col items-center px-6 py-8">
            <ThemedProfileAvatar config={figureConfig} size="lg" className="!h-20 !w-20" />
            <p className="mt-4 text-xl font-bold text-zinc-100">{labels.humanTitle}</p>
            <p className="text-sm text-orange-300">{labels.animalTitle}</p>
            {modifier && (
              <div className="mt-4 w-full rounded-sm border border-violet-500/25 bg-violet-950/30 px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
                  Orbit modifier
                </p>
                <p className="mt-1 text-sm font-semibold text-violet-100">
                  {modifier.affinity.icon} {modifier.morphLabel} — {modifier.affinity.label}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{modifier.affinity.wheelEffect}</p>
                {modifier.synergy && (
                  <p className="mt-2 text-[11px] text-emerald-300">
                    {modifier.synergy.label}: {modifier.synergy.effect}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10">
          <CompanionLockerRewards
            vibeBalance={balances.vibe}
            spinsUsedToday={wheelDaily}
            equippedSkinSlug={skinSlug}
            variant="arena"
          />
        </div>
      </div>
    </div>
  );
}

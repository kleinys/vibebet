import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEquippedCosmetics } from "@/lib/cosmetics";
import { getCompanionInput } from "@/lib/companion-stats";
import { HypnoticArenaExperience } from "@/components/hypnotic/hypnotic-arena-experience";
import { resolveFigureConfig } from "@/lib/companion-figure";
import { getAllBalances } from "@/lib/ledger";
import { getLockerMomentum, lockerMomentumToSession } from "@/lib/locker-momentum-server";
import { getAdrenalineTokenCount } from "@/lib/consumables-server";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";

/** Embedded locker arena for Play hub Arcade tab. */
export async function PlayArenaEmbed({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    return (
      <div className="play-arena-embed play-arena-embed--locked">
        <p className="text-sm text-zinc-400">
          Log in to spin the wheel, open VIBE cases, and play Plinko with your trainer.
        </p>
        <Link href="/login?next=/play?tab=arcade" className="play-hub__cta mt-4 inline-flex">
          Log in to play
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/play?tab=arcade");

  const utcToday = new Date().toISOString().slice(0, 10);
  const [equipped, companionInput, balances, wheelDaily, lockerMomentum, adrenalineTokens] = await Promise.all([
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
    getAdrenalineTokenCount(),
  ]);

  const figureConfig = resolveFigureConfig(companionInput);
  const skinSlug = equipped.skin?.slug ?? figureConfig.skinSlug;
  const initialSession = lockerMomentumToSession(lockerMomentum);

  return (
    <div className="play-arena-embed">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-zinc-500">
            Wheel · case · Plinko
          </p>
          <span className="rounded border border-emerald-500/25 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-200/90">
            Visual theme only
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200">
          <CurrencyIconVibe className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums">{formatVibe(balances.vibe)}</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-zinc-900/70 to-zinc-950 shadow-xl ring-1 ring-violet-500/20">
        <HypnoticArenaExperience
          figureConfig={figureConfig}
          vibeBalance={balances.vibe}
          spinsUsedToday={wheelDaily}
          equippedSkinSlug={skinSlug}
          initialSession={initialSession}
          initialAffinityLabel={lockerMomentum.affinityLabel ?? null}
          adrenalineTokens={adrenalineTokens}
        />
      </div>
      <Link
        href="/account/profile/arena"
        className="play-hub__link mt-3 inline-block text-xs"
      >
        Open fullscreen arena →
      </Link>
    </div>
  );
}

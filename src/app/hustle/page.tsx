import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEnabled } from "@/lib/feature-flags";
import { getAllBalances } from "@/lib/ledger";
import { getSparkHustle, getFlashHustle, getDailyHustle } from "@/lib/daily-hustle";
import { getHustleOracle } from "@/lib/hustle-oracle";
import { getHustleWallet } from "@/lib/hustle-wallet";
import { getHustleMarketplace } from "@/lib/hustle-marketplace";
import { getHustleEquity } from "@/lib/hustle-equity";
import { getHustleGovernance } from "@/lib/hustle-governance";
import { getHustleWellness } from "@/lib/hustle-wellness";
import { HustleSparkBoard } from "@/components/hustle/hustle-spark-board";
import { FeatureOffPanel } from "@/components/feature-off-panel";
import { LegacyCathedralView } from "@/components/legacy-cathedral";
import { getLegacyCathedral } from "@/lib/legacy-cathedral";

export const revalidate = 0;

export default async function HustleHubPage() {
  const [
    interconnectOn,
    hustleSparkOn,
    dailyHustleOn,
    hustleTrustOn,
    hustleBridgeOn,
    hustleMarketplaceOn,
    hustleSharesOn,
    hustleGovernanceOn,
    hustleRecoveryOn,
    unifiedEconomyUi,
  ] = await Promise.all([
    isEnabled("interconnect_layer_enabled"),
    isEnabled("hustle_spark_enabled"),
    isEnabled("daily_hustle_enabled"),
    isEnabled("hustle_trust_enabled"),
    isEnabled("hustle_bridge_enabled"),
    isEnabled("hustle_marketplace_enabled"),
    isEnabled("hustle_shares_enabled"),
    isEnabled("hustle_governance_enabled"),
    isEnabled("hustle_recovery_enabled"),
    isEnabled("unified_economy_ui_enabled"),
  ]);

  if (!interconnectOn) {
    redirect("/play?tab=hustle");
  }

  const hustleEnabled = hustleSparkOn && dailyHustleOn;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/hustle");

  if (!hustleEnabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <FeatureOffPanel
          title="Hustle earn loop"
          body="Micro-tasks and gigs are coming soon."
          ctaHref="/play"
          ctaLabel="Back to Play"
        />
      </div>
    );
  }

  const [
    balances,
    sparkTasks,
    flashTasks,
    dailyTasks,
    oracle,
    wallet,
    marketplace,
    equity,
    governance,
    wellness,
    cathedral,
  ] = await Promise.all([
    getAllBalances(user.id).catch(() => ({ vibe: 0, gem: 0 })),
    getSparkHustle().catch(() => []),
    getFlashHustle().catch(() => []),
    getDailyHustle().catch(() => []),
    hustleTrustOn ? getHustleOracle().catch(() => null) : Promise.resolve(null),
    hustleBridgeOn || unifiedEconomyUi ? getHustleWallet().catch(() => null) : Promise.resolve(null),
    hustleMarketplaceOn ? getHustleMarketplace().catch(() => null) : Promise.resolve(null),
    hustleSharesOn ? getHustleEquity().catch(() => null) : Promise.resolve(null),
    hustleGovernanceOn ? getHustleGovernance().catch(() => null) : Promise.resolve(null),
    hustleRecoveryOn ? getHustleWellness().catch(() => null) : Promise.resolve(null),
    getLegacyCathedral(user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
          HustleOS
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Earn VIBE in minutes</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Complete tasks, gigs, and trust milestones. Wins in duels drop adrenaline tokens
          for Arcade — everything feeds your Legacy Cathedral.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link href="/play?tab=duels" className="play-hub__link">
            Duels →
          </Link>
          <Link href="/play?tab=arcade" className="play-hub__link">
            Arcade →
          </Link>
          <Link href="/markets" className="play-hub__link">
            Markets →
          </Link>
        </div>
      </header>

      {cathedral && (
        <div className="mb-8 rounded-xl border border-violet-500/20 bg-zinc-900/40 p-4">
          <LegacyCathedralView cathedral={cathedral} />
        </div>
      )}

      <HustleSparkBoard
        sparkTasks={sparkTasks}
        flashTasks={flashTasks}
        dailyTasks={dailyTasks}
        vibeBalance={balances.vibe}
        oracle={oracle}
        trustEnabled={hustleTrustOn}
        bridgeEnabled={hustleBridgeOn}
        marketplaceEnabled={hustleMarketplaceOn}
        sharesEnabled={hustleSharesOn}
        governanceEnabled={hustleGovernanceOn}
        recoveryEnabled={hustleRecoveryOn}
        unifiedEconomyUi={unifiedEconomyUi}
        wallet={wallet}
        marketplace={marketplace}
        equity={equity}
        governance={governance}
        wellness={wellness}
      />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account-nav";
import { ProfileForm } from "@/components/profile-form";
import { getEquippedCosmetics } from "@/lib/cosmetics";
import { getCompanionInput } from "@/lib/companion-stats";
import { VibeCompanionCard } from "@/components/vibe-companion";
import type { LockerEquipItem } from "@/components/companion-locker-equip";
import type { ItemKind, Rarity } from "@/lib/supabase/types";
import { getMyGuild } from "@/lib/guilds";
import { isEnabled } from "@/lib/feature-flags";
import { getStreakInfo } from "@/lib/streaks";
import { getMyPlayerCode } from "@/lib/player-code";
import { ProfileShareSection } from "@/components/profile-share-section";
import { CompanionEvolutionShare } from "@/components/companion-evolution-share";
import { ClaimLockerPackButton } from "@/components/claim-locker-pack-button";
import { LockerArenaEntry } from "@/components/locker-arena-entry";
import { CompanionDiscoverBar } from "@/components/companion-discover-bar";
import { CompanionRosterPanel } from "@/components/companion-roster-panel";
import { figureLabels, resolveFigureConfig } from "@/lib/companion-figure";
import { LegacyCathedralView } from "@/components/legacy-cathedral";
import { getLegacyCathedral } from "@/lib/legacy-cathedral";
import { getAllBalances } from "@/lib/ledger";

export const revalidate = 0;

function isLockerPackEligible(
  email: string | undefined,
  profile: { username?: string | null; display_name?: string | null } | null,
) {
  const e = email?.toLowerCase() ?? "";
  const username = profile?.username?.toLowerCase() ?? "";
  const display = profile?.display_name?.toLowerCase().replace(/\s/g, "") ?? "";
  return (
    e === "test3@example.com" ||
    username === "kbab" ||
    e.includes("kbab") ||
    display === "cool$guy1"
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, created_at, companion_name")
    .eq("id", user.id)
    .maybeSingle();

  const guildsOn = await isEnabled("guilds_enabled");
  const utcToday = new Date().toISOString().slice(0, 10);
  const [equipped, streak, companionInput, myGuild, playerCode, inventoryRes, catalogRes, balances, wheelDaily, cathedral] =
    await Promise.all([
    getEquippedCosmetics(user.id).catch(() => ({ skin: null, badge: null })),
    getStreakInfo(user.id),
    getCompanionInput(user.id).catch(() => ({
      currentStreak: 0,
      streakShields: 0,
      inventoryCount: 0,
    })),
    guildsOn ? getMyGuild().catch(() => null) : Promise.resolve(null),
    getMyPlayerCode().catch(() => null),
    supabase
      .from("user_inventory")
      .select("id, is_equipped, shop_items (slug, name, kind, rarity)")
      .eq("user_id", user.id)
      .then((r) => r.data ?? []),
    supabase
      .from("shop_items")
      .select("slug, name, kind, rarity, price_gems, is_active")
      .in("kind", ["skin", "badge"])
      .then((r) => r.data ?? []),
    getAllBalances(user.id).catch(() => ({ vibe: 0, gem: 0 })),
    supabase
      .from("locker_wheel_daily")
      .select("spins_used")
      .eq("user_id", user.id)
      .eq("spin_date", utcToday)
      .maybeSingle()
      .then((r) => r.data?.spins_used ?? 0),
    getLegacyCathedral(user.id),
  ]);

  const ownedSlugs = new Set<string>();
  const lockerItems = { skins: [] as LockerEquipItem[], badges: [] as LockerEquipItem[] };
  for (const row of inventoryRes) {
    const item = Array.isArray(row.shop_items) ? row.shop_items[0] : row.shop_items;
    if (!item || (item.kind !== "skin" && item.kind !== "badge")) continue;
    ownedSlugs.add(item.slug);
    const entry: LockerEquipItem = {
      inventoryId: row.id,
      slug: item.slug,
      name: item.name,
      kind: item.kind as ItemKind,
      rarity: item.rarity as Rarity,
      isEquipped: row.is_equipped,
      owned: true,
    };
    if (item.kind === "skin") lockerItems.skins.push(entry);
    else lockerItems.badges.push(entry);
  }

  for (const item of catalogRes) {
    if (!item.is_active && !ownedSlugs.has(item.slug)) continue;
    if (ownedSlugs.has(item.slug)) continue;
    const entry: LockerEquipItem = {
      inventoryId: "",
      slug: item.slug,
      name: item.name,
      kind: item.kind as ItemKind,
      rarity: item.rarity as Rarity,
      isEquipped: false,
      owned: false,
      priceGems: item.price_gems,
    };
    if (item.kind === "skin") lockerItems.skins.push(entry);
    else lockerItems.badges.push(entry);
  }

  lockerItems.skins.sort((a, b) => a.name.localeCompare(b.name));
  lockerItems.badges.sort((a, b) => a.name.localeCompare(b.name));

  const missingLockerCount = catalogRes.filter(
    (item) => item.is_active && !ownedSlugs.has(item.slug),
  ).length;

  const figureConfig = resolveFigureConfig(companionInput);
  const companionLabels = figureLabels(figureConfig);
  const lockerPackEligible = isLockerPackEligible(user.email, profile);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/profile" />

      <section
        id="trainer"
        className="mt-6 scroll-mt-24 overflow-hidden rounded-sm border border-fuchsia-500/30 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 shadow-lg shadow-fuchsia-950/30"
      >
        <CompanionDiscoverBar compact />
        <h2 className="mt-4 text-xs font-semibold uppercase tracking-wider text-fuchsia-300/90">
          Your trainer &amp; companion
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tap a skin pill to equip — each skin pairs a trainer with a spirit animal. Open the
          VIBE arena below to stake on cases and the wheel.
        </p>
        <div className="mt-5">
          <VibeCompanionCard
            input={companionInput}
            lockerItems={lockerItems}
            freeSpinAvailable={wheelDaily === 0}
            lastActiveDate={streak.lastActiveDate}
            companionName={profile?.companion_name}
          />
          <ClaimLockerPackButton
            missingCount={missingLockerCount}
            eligible={lockerPackEligible}
          />
          <LockerArenaEntry
            input={companionInput}
            vibeBalance={balances.vibe}
            equippedSkinSlug={equipped.skin?.slug ?? figureConfig.skinSlug}
            freeSpinAvailable={wheelDaily === 0}
          />
          <CompanionRosterPanel activeSkinSlug={equipped.skin?.slug ?? figureConfig.skinSlug} />
        </div>
        <CompanionEvolutionShare
          displayName={profile?.display_name ?? playerCode?.display_name ?? "Player"}
          username={profile?.username ?? playerCode?.username}
          companion={figureConfig.companion}
          humanTitle={companionLabels.humanTitle}
          animalTitle={companionLabels.animalTitle}
        />
        <p className="mt-4 text-xs text-zinc-500">
          Equipped: {equipped.skin?.name ?? "Default Oracle"}
          {equipped.badge ? ` · ${equipped.badge.name}` : ""}.
          {" "}
          <Link href="/shop" className="text-fuchsia-400 hover:underline">
            Get more items →
          </Link>
        </p>
        {profile?.username && (
          <Link
            href={`/players/${profile.username}`}
            className="mt-2 inline-block text-xs text-fuchsia-400 hover:underline"
          >
            View public profile →
          </Link>
        )}
      </section>

      {cathedral && (
        <section className="mt-6 rounded-sm border border-violet-500/25 bg-zinc-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
            Legacy Cathedral
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Your cross-mode achievements — shareable at /players/{profile?.username}
          </p>
          <div className="mt-4">
            <LegacyCathedralView cathedral={cathedral} />
          </div>
        </section>
      )}

      {myGuild && (
        <section className="mt-6 rounded-sm border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
            Guild
          </h2>
          <p className="mt-2 text-sm font-medium text-emerald-100">
            [{myGuild.tag}] {myGuild.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Role: {myGuild.role} ·{" "}
            <Link href={`/guilds/${myGuild.slug}`} className="text-emerald-300 hover:underline">
              View guild →
            </Link>
          </p>
        </section>
      )}

      <section className="mt-6 rounded-sm border border-white/5 bg-zinc-900/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Public profile
        </h2>
        <ProfileForm initial={profile?.display_name ?? ""} />
        {playerCode && (
          <ProfileShareSection
            displayName={playerCode.display_name ?? profile?.display_name ?? "Player"}
            username={playerCode.username ?? profile?.username}
            playerCode={playerCode.referral_code}
            streak={streak.currentStreak}
          />
        )}
      </section>

      <section className="mt-6 rounded-sm border border-white/5 bg-zinc-900/40 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Account
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-zinc-200">{user.email}</dd>
          </div>
          {profile?.username && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Username</dt>
              <dd className="text-zinc-200">
                <Link
                  href={`/players/${profile.username}`}
                  className="text-fuchsia-300 hover:underline"
                >
                  @{profile.username}
                </Link>
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Member since</dt>
            <dd className="text-zinc-200">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

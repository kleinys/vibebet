import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountNav } from "@/components/account-nav";
import { ProfileForm } from "@/components/profile-form";
import { getEquippedCosmetics } from "@/lib/cosmetics";
import { getCompanionInput } from "@/lib/companion-stats";
import { VibeCompanionCard } from "@/components/vibe-companion";
import { getMyGuild } from "@/lib/guilds";
import { isEnabled } from "@/lib/feature-flags";
import { getStreakInfo } from "@/lib/streaks";
import { getMyPlayerCode } from "@/lib/player-code";
import { ProfileShareSection } from "@/components/profile-share-section";

export const revalidate = 0;

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const guildsOn = await isEnabled("guilds_enabled");
  const [equipped, streak, companionInput, myGuild, playerCode] = await Promise.all([
    getEquippedCosmetics(user.id).catch(() => ({ skin: null, badge: null })),
    getStreakInfo(user.id),
    getCompanionInput(user.id).catch(() => ({
      currentStreak: 0,
      streakShields: 0,
      inventoryCount: 0,
    })),
    guildsOn ? getMyGuild().catch(() => null) : Promise.resolve(null),
    getMyPlayerCode().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>
      <AccountNav active="/account/profile" />

      <section className="mt-6 overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 shadow-lg shadow-fuchsia-950/30">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300/90">
          Your trainer &amp; companion
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Human form + spirit animal — both evolve with streaks and shop items.
        </p>
        <div className="mt-5">
          <VibeCompanionCard input={companionInput} />
        </div>
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

      {myGuild && (
        <section className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
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

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-5">
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

      <section className="mt-6 rounded-xl border border-white/5 bg-zinc-900/40 p-5">
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

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/cosmetics";
import { resolveFigureConfig, figureLabels } from "@/lib/companion-figure";
import { CompanionFigureScene } from "@/components/companion-figure";
import { formatVibe } from "@/lib/utils";
import { tierFromProfit } from "@/lib/ranks";
import { LegacyCathedralView } from "@/components/legacy-cathedral";
import { getLegacyCathedral } from "@/lib/legacy-cathedral";
import { isEnabled } from "@/lib/feature-flags";
import { ogImageUrl } from "@/lib/og-image";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) {
    return { title: "Player not found · Vibebet" };
  }

  const tier = tierFromProfit(profile.profit);
  const title = `${profile.display_name} (@${profile.username}) · Vibebet`;
  const description = `${tier.emoji} ${tier.title} · ${formatVibe(profile.profit)} VIBE lifetime profit on Vibebet.`;
  const image = ogImageUrl({
    kind: "profile",
    name: profile.display_name,
    subline: `${tier.title} · Hall of Fame player`,
  });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: profile.display_name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicPlayerPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const interconnectOn = await isEnabled("interconnect_layer_enabled");
  const cathedral = interconnectOn
    ? await getLegacyCathedral(profile.user_id)
    : null;

  const tier = tierFromProfit(profile.profit);
  const figureConfig = resolveFigureConfig({
    currentStreak: profile.current_streak,
    streakShields: profile.streak_shields,
    inventoryCount: 0,
    equippedSkinSlug: profile.skin_slug,
    equippedBadgeSlug: profile.badge_slug ?? undefined,
  });
  const figureLabel = figureLabels(figureConfig);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/leaderboard"
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        ← Hall of Fame
      </Link>

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-full max-w-[min(100%,420px)] shrink-0">
          <CompanionFigureScene config={figureConfig} labels={figureLabel} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            {profile.display_name}
          </h1>
          <p className="text-sm text-zinc-500">@{profile.username}</p>
          {profile.is_pro && (
            <span className="mt-2 inline-block rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-200">
              Pro
            </span>
          )}
        </div>
      </header>

      {cathedral && (
        <section className="mt-8 rounded-xl border border-violet-500/20 bg-zinc-900/40 p-4">
          <LegacyCathedralView cathedral={cathedral} compact />
        </section>
      )}

      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        <Stat label="Rank tier" value={`${tier.emoji} ${tier.title}`} />
        <Stat
          label="Lifetime profit"
          value={`${profile.profit > 0 ? "+" : ""}${formatVibe(profile.profit)} VIBE`}
          valueClass={
            profile.profit > 0
              ? "text-emerald-300"
              : profile.profit < 0
                ? "text-rose-300"
                : "text-zinc-300"
          }
        />
        {profile.rank != null && (
          <Stat label="Hall of Fame" value={`#${profile.rank}`} />
        )}
        <Stat
          label="Daily streak"
          value={
            profile.current_streak > 0
              ? `🔥 ${profile.current_streak} days`
              : "—"
          }
        />
        <Stat
          label="Longest streak"
          value={`${profile.longest_streak} days`}
        />
        <Stat
          label="Member since"
          value={new Date(profile.member_since).toLocaleDateString()}
        />
      </dl>

      <p className="mt-8 text-xs text-zinc-500">
        Public profiles show equipped cosmetics and trading stats only. Balances
        and positions stay private.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = "text-zinc-100",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-1 text-lg font-semibold ${valueClass}`}>{value}</dd>
    </div>
  );
}

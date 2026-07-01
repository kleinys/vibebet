"use client";

import { CopyLinkButton } from "@/components/copy-link-button";
import { challengeUrl, getSiteUrl, playerProfileUrl } from "@/lib/site-url";
import { ogImageUrl, type ShareCardKind } from "@/lib/og-image";

export type { ShareCardKind };

export function ShareCard({
  kind,
  displayName,
  username,
  playerCode,
  streak,
  headline,
  subline,
  profilePath,
}: {
  kind: ShareCardKind;
  displayName: string;
  username?: string | null;
  playerCode?: string;
  streak?: number;
  headline?: string;
  subline?: string;
  profilePath?: string;
}) {
  const profileUrl =
    profilePath ??
    (username ? playerProfileUrl(username) : getSiteUrl());
  const challengeLink = playerCode ? challengeUrl(playerCode) : profileUrl;

  const shareText = (() => {
    switch (kind) {
      case "streak":
        return `🔥 ${displayName} is on a ${streak ?? 0}-day streak on Vibebet — predict, duel, and climb the Hall of Fame. ${profileUrl}`;
      case "challenge":
        return `⚔ Challenge ${displayName} on Vibebet — duels, markets, and skill games. ${challengeLink}`;
      case "win":
        return headline
          ? `🎯 ${headline} — ${displayName} on Vibebet. ${profileUrl}`
          : `${displayName} just scored on Vibebet. ${profileUrl}`;
      case "companion":
        return `✨ Check out ${displayName}'s trainer & companion on Vibebet. ${profileUrl}`;
      default:
        return `${displayName} on Vibebet — play-money predictions & skill duels. ${profileUrl}`;
    }
  })();

  const title = (() => {
    switch (kind) {
      case "streak":
        return `${streak ?? 0}-day streak`;
      case "challenge":
        return "Challenge me";
      case "win":
        return headline ?? "Big win";
      case "companion":
        return "Trainer & companion";
      default:
        return displayName;
    }
  })();

  const imageUrl = ogImageUrl({
    kind,
    name: displayName,
    headline,
    streak,
    subline,
  });

  return (
    <div className="rounded-xl border border-fuchsia-500/25 bg-gradient-to-br from-violet-950/60 via-[#020617] to-fuchsia-950/40 p-4 ring-1 ring-violet-500/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300/80">
        Share
      </p>
      <h3 className="mt-1 text-lg font-semibold text-zinc-100">{title}</h3>
      {subline && <p className="mt-1 text-xs text-zinc-400">{subline}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="mt-3 w-full rounded-lg border border-white/10 bg-black/40"
        loading="lazy"
      />
      <p className="mt-3 rounded-lg border border-white/5 bg-black/40 p-3 text-xs leading-relaxed text-zinc-300">
        {shareText}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyLinkButton
          url={shareText}
          label="Copy share text"
          copiedLabel="Copied!"
          successMessage="Share text copied — paste on X, Discord, or iMessage"
          className="rounded-md bg-fuchsia-600/35 px-3 py-1.5 text-xs font-medium text-fuchsia-100 ring-1 ring-fuchsia-500/30 hover:bg-fuchsia-500/45"
        />
        <CopyLinkButton
          url={imageUrl}
          label="Copy image link"
          successMessage="OG image link copied — paste for rich previews"
        />
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20 hover:text-zinc-100"
        >
          Open image
        </a>
        {kind === "challenge" && playerCode && (
          <CopyLinkButton
            url={challengeLink}
            label="Copy challenge link"
            successMessage="Challenge link copied!"
          />
        )}
        {kind !== "challenge" && (
          <CopyLinkButton
            url={profileUrl}
            label="Copy profile link"
            successMessage="Profile link copied!"
          />
        )}
      </div>
    </div>
  );
}

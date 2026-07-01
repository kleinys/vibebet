import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePlayerCode } from "@/lib/resolve-player";
import { challengeUrl } from "@/lib/site-url";
import { ogImageUrl } from "@/lib/og-image";
import { ChallengeActions } from "./challenge-actions";

export const revalidate = 0;

const DUEL_LINKS = [
  { href: "/games/duels/connect4", label: "Connect Four", emoji: "🔴" },
  { href: "/games/duels/chess", label: "Chess", emoji: "♟" },
  { href: "/games/duels/liars-dice", label: "Liar's Dice", emoji: "🎲" },
  { href: "/games/duels/lightning", label: "Lightning", emoji: "⚡" },
  { href: "/games/duels/trivia", label: "Trivia Blitz", emoji: "🧠" },
  { href: "/duels", label: "Prediction duel", emoji: "📊" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const player = await resolvePlayerCode(code);
  if (!player) {
    return { title: "Challenge not found · Vibebet" };
  }

  const title = `Challenge ${player.display_name} on Vibebet`;
  const description = `Pick a duel and challenge ${player.display_name} — predictions, skill games, and arcade duels.`;
  const image = ogImageUrl({ kind: "challenge", name: player.display_name });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const player = await resolvePlayerCode(code);

  if (!player) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-100">Code not found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          No player matches <span className="font-mono text-zinc-300">{code}</span>.
          Check the code and try again.
        </p>
        <Link
          href="/games/duels"
          className="mt-6 inline-block text-sm text-violet-400 hover:underline"
        >
          Browse duels →
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id === player.user_id) {
    redirect("/games/duels");
  }

  const challengeLink = challengeUrl(player.referral_code);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
        Friend challenge
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
        Challenge {player.display_name}
      </h1>
      {player.username && (
        <p className="mt-1 text-sm text-zinc-500">@{player.username}</p>
      )}

      <div className="mt-6 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-950/50 to-[#020617] p-5 ring-1 ring-violet-500/20">
        <p className="text-sm text-zinc-300">
          Pick a duel below. When you post a game, enter their player code{" "}
          <span className="font-mono text-violet-200">{player.referral_code}</span>{" "}
          to send the challenge directly — or share this page so they can challenge you back.
        </p>
        <ChallengeActions
          challengeLink={challengeLink}
          playerCode={player.referral_code}
          displayName={player.display_name}
        />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DUEL_LINKS.map((d) => (
          <Link
            key={d.href}
            href={`${d.href}?challenge=${encodeURIComponent(player.referral_code)}`}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 transition hover:border-violet-500/40 hover:bg-violet-950/30"
          >
            <span className="text-xl">{d.emoji}</span>
            <span className="text-sm font-medium text-zinc-200">{d.label}</span>
          </Link>
        ))}
      </div>

      {!user && (
        <p className="mt-8 text-center text-xs text-zinc-500">
          <Link href={`/login?next=/challenge/${code}`} className="text-violet-400 hover:underline">
            Sign in
          </Link>{" "}
          to post a challenge with VIBE stakes.
        </p>
      )}

      {player.username && (
        <Link
          href={`/players/${player.username}`}
          className="mt-6 block text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          View public profile →
        </Link>
      )}
    </div>
  );
}

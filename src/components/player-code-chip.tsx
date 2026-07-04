"use client";

import { useState } from "react";
import Link from "next/link";
import {
  REFERRAL_TOTAL_VIBE_PER_FRIEND,
  referralRewardsShort,
} from "@/lib/referral-copy";
import { challengeUrl } from "@/lib/site-url";

export function PlayerCodeChip({
  code,
  referralsOn,
  compact = false,
}: {
  code: string;
  referralsOn: boolean;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCode(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  if (compact) {
    return (
      <Link
        href={`/challenge/${code}`}
        title={
          referralsOn
            ? `Your invite code — earn up to ${REFERRAL_TOTAL_VIBE_PER_FRIEND} VIBE per friend`
            : "Your player code for duel challenges"
        }
        className="hidden items-center gap-1.5 rounded-sm bg-violet-950/80 px-2 py-1 ring-1 ring-violet-500/35 transition hover:ring-violet-400/50 md:inline-flex"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
          Code
        </span>
        <span className="font-mono text-xs text-violet-100">{code}</span>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-sm px-1 text-[10px] text-violet-300 hover:bg-violet-500/20 hover:text-white"
        >
          {copied ? "OK" : "Copy"}
        </button>
      </Link>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-sm bg-violet-950/60 px-2.5 py-1.5 ring-1 ring-violet-500/30">
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/70">
          Your code
        </span>
        <span className="ml-2 font-mono text-sm text-violet-100">{code}</span>
      </div>
      <button
        type="button"
        onClick={copyCode}
        className="rounded-sm bg-violet-600/40 px-2 py-0.5 text-[10px] font-medium text-violet-100 hover:bg-violet-500/50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      {referralsOn && (
        <Link href="/invite" className="text-[10px] text-fuchsia-300 hover:underline">
          Invite →
        </Link>
      )}
    </div>
  );
}

export function InviteRewardsStrip({
  code,
  referralsOn,
  inviteLink,
}: {
  code: string;
  referralsOn: boolean;
  inviteLink: string | null;
}) {
  const [copied, setCopied] = useState<"code" | "link" | "challenge" | null>(null);
  const challengeLink = challengeUrl(code);

  async function copy(text: string, kind: "code" | "link" | "challenge") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="border-b border-violet-500/10 bg-gradient-to-r from-violet-950/40 via-[#020617] to-fuchsia-950/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400/70">
            Player code
          </span>
          <span className="font-mono text-sm font-medium text-violet-100">{code}</span>
          <button
            type="button"
            onClick={() => copy(code, "code")}
            className="rounded-sm bg-violet-600/30 px-2 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/40"
          >
            {copied === "code" ? "Copied!" : "Copy code"}
          </button>
          <button
            type="button"
            onClick={() => copy(challengeLink, "challenge")}
            className="rounded-sm bg-sky-600/25 px-2 py-0.5 text-[10px] font-medium text-sky-200 ring-1 ring-sky-500/30 hover:bg-sky-500/35"
          >
            {copied === "challenge" ? "Copied!" : "Copy challenge link"}
          </button>
          {inviteLink && referralsOn && (
            <button
              type="button"
              onClick={() => copy(inviteLink, "link")}
              className="rounded-sm bg-fuchsia-600/25 px-2 py-0.5 text-[10px] font-medium text-fuchsia-200 ring-1 ring-fuchsia-500/30 hover:bg-fuchsia-500/35"
            >
              {copied === "link" ? "Link copied!" : "Copy invite link"}
            </button>
          )}
        </div>

        <p className="min-w-0 flex-1 text-xs leading-relaxed text-zinc-400 sm:text-right">
          {referralsOn ? (
            <>
              <span className="text-zinc-300">Invite friends</span> — signup link or{" "}
              <Link href={`/challenge/${code}`} className="text-sky-300 hover:underline">
                challenge link
              </Link>
              .{" "}
              <span className="text-amber-200/90">{referralRewardsShort()}</span>
              {" · "}
              <span className="text-zinc-500">
                Up to {REFERRAL_TOTAL_VIBE_PER_FRIEND} VIBE per friend.
              </span>{" "}
              <Link href="/invite" className="text-fuchsia-400 hover:underline">
                Details →
              </Link>
            </>
          ) : (
            <>
              <Link href={`/challenge/${code}`} className="text-sky-300 hover:underline">
                Challenge friends
              </Link>{" "}
              or use your code in{" "}
              <Link href="/games/duels" className="text-violet-300 hover:underline">
                duels
              </Link>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}

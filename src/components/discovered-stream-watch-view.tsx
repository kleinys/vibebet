"use client";

import Link from "next/link";
import { StreamEmbed } from "@/components/stream-embed";
import { streamProviderLabel, type StreamProvider } from "@/lib/stream-url";

export function DiscoveredStreamWatchView({
  watchUrl,
  title,
  channel,
  provider,
}: {
  watchUrl: string;
  title: string;
  channel: string;
  provider: string;
}) {
  const label =
    provider in { youtube: 1, twitch: 1, kick: 1 }
      ? streamProviderLabel(provider as StreamProvider)
      : provider;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link href="/live" className="text-xs text-zinc-500 hover:text-zinc-300">
        ← Watch hub
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
            {label} · in-app player
          </span>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{title}</h1>
          {channel && <p className="mt-1 text-sm text-zinc-400">{channel}</p>}
        </div>
        <Link
          href="/games/duels"
          className="rounded-md border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20"
        >
          Duel hub
        </Link>
      </div>

      <div className="mt-6">
        <StreamEmbed streamUrl={watchUrl} title={title} className="shadow-[0_20px_60px_rgba(0,0,0,0.45)]" />
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Stream plays here — no jump to YouTube, Twitch, or Kick. When you ship the native app, this
        same embed shell becomes the in-app player.
      </p>
    </div>
  );
}

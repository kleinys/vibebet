"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { playVsBot, type BotGameKey } from "@/app/games/duels/bot-actions";
import { PlayChessVsBotButton } from "@/components/play-chess-vs-bot-button";
import type { GameDefinition } from "@/lib/game-catalog";

const KIND_STYLES = {
  luck: {
    ring: "ring-emerald-500/25",
    badge: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    glow: "from-emerald-500/10 via-transparent to-transparent",
    accent: "text-emerald-300",
  },
  skill: {
    ring: "ring-violet-500/25",
    badge: "bg-violet-500/15 text-violet-200 border-violet-500/30",
    glow: "from-violet-500/10 via-transparent to-transparent",
    accent: "text-violet-300",
  },
  prediction: {
    ring: "ring-sky-500/25",
    badge: "bg-sky-500/15 text-sky-200 border-sky-500/30",
    glow: "from-sky-500/10 via-transparent to-transparent",
    accent: "text-sky-300",
  },
  oracle: {
    ring: "ring-amber-500/25",
    badge: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    glow: "from-amber-500/10 via-transparent to-transparent",
    accent: "text-amber-300",
  },
} as const;

const KIND_LABELS = {
  luck: "Luck",
  skill: "Skill",
  prediction: "Prediction",
  oracle: "Auto-settled",
} as const;

const BOT_KEYS: Partial<Record<string, BotGameKey>> = {
  rps: "rps",
  high_card: "high_card",
  dice: "dice",
};

export function DuelGameCard({ game }: { game: GameDefinition }) {
  const [pending, startTransition] = useTransition();
  const style = KIND_STYLES[game.kind];
  const botKey = BOT_KEYS[game.key];

  function quickBot() {
    if (!botKey) return;
    startTransition(async () => {
      const move = botKey === "rps" ? ("rock" as const) : undefined;
      const result = await playVsBot(botKey, 50, move);
      if (result.error) toast.error(result.error);
      else toast.success(result.ok ?? "Done!");
    });
  }

  return (
    <li className="group list-none">
      <article
        className={`duel-game-tablet relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/95 to-zinc-950 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.35)] ring-1 ${style.ring} transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]`}
      >
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} opacity-80`}
          aria-hidden
        />

        <div className="relative flex items-start justify-between gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-3xl shadow-inner"
            aria-hidden
          >
            {game.emoji}
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.badge}`}
          >
            {KIND_LABELS[game.kind]}
          </span>
        </div>

        <div className="relative mt-4 flex flex-1 flex-col">
          <h3 className="font-[family-name:var(--font-geist-sans)] text-lg font-semibold tracking-tight text-zinc-50">
            {game.name}
          </h3>
          <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-zinc-400">{game.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {game.href && (
              <Link
                href={game.href}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold ${style.accent} transition hover:bg-white/10`}
              >
                Play
                <span aria-hidden>→</span>
              </Link>
            )}
            {botKey && (
              <button
                type="button"
                disabled={pending}
                onClick={quickBot}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {pending ? "…" : "vs Bot"}
              </button>
            )}
            {game.key === "chess" && (
              <PlayChessVsBotButton className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50" />
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

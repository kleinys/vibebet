import Link from "next/link";
import { formatVibe } from "@/lib/utils";
import type { SpectatorDuel } from "@/lib/duels";

export function DuelSpectatorStrip({ duels }: { duels: SpectatorDuel[] }) {
  if (duels.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
        Bet on live duels
      </h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        Spectator markets — pick the winner while matches play out.
      </p>
      <ul className="mt-3 space-y-2">
        {duels.slice(0, 6).map((d) => (
          <li key={d.duel_id}>
            <Link
              href={`/markets/${d.spectator_market_id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-zinc-950/60 px-3 py-2 text-sm transition hover:border-violet-400/30"
            >
              <span className="min-w-0 text-zinc-200">
                {d.challenger_name}
                <span className="mx-1 text-zinc-600">vs</span>
                {d.opponent_name}
              </span>
              <span className="text-xs tabular-nums text-amber-200">
                {formatVibe(d.stake)} VIBE
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/duels" className="mt-3 inline-block text-xs text-violet-300 hover:underline">
        All prediction duels →
      </Link>
    </div>
  );
}

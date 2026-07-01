import Link from "next/link";
import { WatchLinkBar } from "@/components/watch-link-bar";

export function SkillSpectatorPanel({
  marketId,
  creatorName,
  opponentName,
  watchUrl,
}: {
  marketId: string | null;
  creatorName: string;
  opponentName: string;
  watchUrl?: string;
}) {
  if (!marketId) return null;
  return (
    <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300">
        Spectator betting
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        Bet on who wins: <span className="text-zinc-200">{creatorName}</span> (YES) vs{" "}
        <span className="text-zinc-200">{opponentName}</span> (NO).
      </p>
      {watchUrl && <WatchLinkBar url={watchUrl} />}
      <Link
        href={`/markets/${marketId}`}
        className="mt-3 inline-block rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
      >
        Open spectator market →
      </Link>
    </div>
  );
}

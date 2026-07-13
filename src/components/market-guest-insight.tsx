import Link from "next/link";
import { formatProbability } from "@/lib/cpmm";

export function MarketGuestInsight({
  marketId,
  question,
  yesLabel,
  noLabel,
  yesPrice,
  noPrice,
  yesPrice24hAgo,
  volume24h,
  topComment,
}: {
  marketId: string;
  question: string;
  yesLabel: string;
  noLabel: string;
  yesPrice: number;
  noPrice: number;
  yesPrice24hAgo: number;
  volume24h: number;
  topComment?: { body: string; authorName: string } | null;
}) {
  const delta = yesPrice - yesPrice24hAgo;
  const deltaPct = yesPrice24hAgo > 0 ? (delta / yesPrice24hAgo) * 100 : 0;
  const trending =
    Math.abs(deltaPct) >= 3
      ? delta > 0
        ? `${yesLabel} trending up`
        : `${yesLabel} trending down`
      : null;

  return (
    <div className="mt-4 rounded-xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/40 to-zinc-900/60 p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/90">
        Free preview
      </p>
      <p className="mt-2 text-sm font-medium text-zinc-100">{question}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <p className="text-[10px] uppercase text-emerald-300/80">{yesLabel}</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-200">
            {formatProbability(yesPrice)}
          </p>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2">
          <p className="text-[10px] uppercase text-rose-300/80">{noLabel}</p>
          <p className="text-lg font-semibold tabular-nums text-rose-200">
            {formatProbability(noPrice)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {trending && (
          <span className={delta > 0 ? "text-emerald-300" : "text-rose-300"}>
            {trending} ({delta > 0 ? "+" : ""}
            {deltaPct.toFixed(1)}% 24h)
          </span>
        )}
        {volume24h > 0 && <span>{volume24h.toLocaleString()} VIBE traded today</span>}
      </div>

      {topComment && (
        <blockquote className="mt-3 border-l-2 border-violet-500/40 pl-3 text-xs italic text-zinc-400">
          &ldquo;{topComment.body.slice(0, 120)}
          {topComment.body.length > 120 ? "…" : ""}&rdquo;
          <span className="mt-1 block not-italic text-zinc-500">
            — {topComment.authorName}
          </span>
        </blockquote>
      )}

      <p className="mt-4 text-sm text-zinc-300">
        Sign up for{" "}
        <span className="font-medium text-amber-300">1,000 free VIBE</span> and
        place your first prediction in under a minute.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/signup?next=/markets/${marketId}`}
          className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400"
        >
          Claim 1,000 VIBE →
        </Link>
        <Link
          href={`/login?next=/markets/${marketId}`}
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:border-white/20"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

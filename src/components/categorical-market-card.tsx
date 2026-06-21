import Link from "next/link";
import { formatOutcomeProbability } from "@/lib/lmsr";
import { formatVibe } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/supabase/types";
import type { CategoricalMarket } from "@/lib/categorical";

/** Compact card for multi-outcome markets on /markets and home. */
export function CategoricalMarketCard({ market }: { market: CategoricalMarket }) {
  const sorted = [...market.outcomes].sort(
    (a, b) => b.probability - a.probability,
  );
  const top = sorted.slice(0, 2);
  const rest = market.outcomes.length - top.length;

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group flex h-full flex-col rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-violet-500/30 hover:bg-zinc-900"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-violet-500/20 bg-violet-500/10 text-sm font-semibold text-violet-300">
          {market.outcomes.length}
        </div>
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">
            Multi-outcome
          </span>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-zinc-100 group-hover:text-white">
            {market.question}
          </h3>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
            {CATEGORY_LABELS[market.category]}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {top.map((o) => (
          <li
            key={o.outcome_index}
            className="flex items-center justify-between rounded-md bg-zinc-950/60 px-2.5 py-1.5 text-xs"
          >
            <span className="truncate font-medium text-zinc-200">{o.label}</span>
            <span className="shrink-0 tabular-nums text-violet-300">
              {formatOutcomeProbability(o.probability)}
            </span>
          </li>
        ))}
        {rest > 0 && (
          <li className="px-2.5 text-[11px] text-zinc-500">+{rest} more outcomes</li>
        )}
      </ul>

      <div className="mt-auto pt-3 text-[11px] text-zinc-500">
        {formatVibe(market.volume)} VIBE vol · {market.trade_count} trades
      </div>
    </Link>
  );
}

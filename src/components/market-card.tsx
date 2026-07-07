import Link from "next/link";
import { formatProbability } from "@/lib/cpmm";
import { formatVibe } from "@/lib/utils";
import { formatUsdVolume } from "@/lib/polymarket";
import { CATEGORY_LABELS, type MarketSource } from "@/lib/supabase/types";
import type { MarketSummary } from "@/lib/markets";

/**
 * Polymarket-style market card.
 * Compact: question + YES/NO probabilities + meta footer.
 */
export function MarketCard({ market }: { market: MarketSummary }) {
  const yesPct = market.yes_price;
  const noPct = 1 - yesPct;
  const delta = market.yes_price - market.yes_price_24h_ago;
  const showDelta = market.volume_24h > 0;
  const isMirror = market.source === "polymarket_mirror";
  const mirrorVol24h = market.external_volume_24h_usd ?? 0;
  const img =
    market.image_url ||
    placeholderMarketImage({ question: market.question, category: market.category });

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group flex h-full flex-col rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-white/10 hover:bg-zinc-900"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt=""
          className="h-9 w-9 shrink-0 rounded-md border border-white/5 object-cover"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SourceBadge source={market.source} />
            {market.is_featured && market.source === "platform" && (
              <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                Featured
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-zinc-100 group-hover:text-white">
            {market.question}
          </h3>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">
            {CATEGORY_LABELS[market.category]}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <OutcomeRow
          label={market.outcome_yes_label}
          probability={yesPct}
          variant="yes"
        />
        <OutcomeRow
          label={market.outcome_no_label}
          probability={noPct}
          variant="no"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          {isMirror && mirrorVol24h > 0 ? (
            <span className="text-amber-300/90" title="Polymarket USD volume (24h)">
              {formatUsdVolume(mirrorVol24h)} PM 24h
            </span>
          ) : (
            <span title="Vibebet play-money volume (24h)">
              {formatVibe(market.volume_24h)} VIBE 24h
            </span>
          )}
          {!isMirror && showDelta && <PriceDelta delta={delta} />}
          {isMirror && showDelta && market.volume_24h > 0 && (
            <span className="text-zinc-500">
              · {formatVibe(market.volume_24h)} VIBE
            </span>
          )}
        </div>
        <span title={isMirror ? "Polymarket all-time USD volume" : "Trade count on Vibebet"}>
          {isMirror && (market.external_volume_usd ?? 0) > 0
            ? `${formatUsdVolume(market.external_volume_usd ?? 0)} PM`
            : `${market.trade_count} trades`}
        </span>
      </div>
    </Link>
  );
}

function SourceBadge({ source }: { source: MarketSource }) {
  if (source === "community") return null;
  const styles =
    source === "platform"
      ? "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/30"
      : "bg-amber-500/10 text-amber-300 ring-amber-500/30";
  const label = source === "platform" ? "Official" : "Polymarket";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${styles}`}
    >
      {label}
    </span>
  );
}

function OutcomeRow({
  label,
  probability,
  variant,
}: {
  label: string;
  probability: number;
  variant: "yes" | "no";
}) {
  const colors =
    variant === "yes"
      ? "bg-emerald-500/5 ring-emerald-500/10 text-emerald-200"
      : "bg-rose-500/5 ring-rose-500/10 text-rose-200";
  return (
    <div className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ring-1 ${colors}`}>
      <span className="truncate text-xs font-medium">{label}</span>
      <span className="shrink-0 text-xs tabular-nums">
        {formatProbability(probability)}
      </span>
    </div>
  );
}

function PriceDelta({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.005) {
    return <span className="text-zinc-500">±0%</span>;
  }
  const up = delta > 0;
  const pct = (delta * 100).toFixed(1);
  return (
    <span className={up ? "text-emerald-300" : "text-rose-300"}>
      {up ? "↑" : "↓"}
      {Math.abs(Number(pct))}%
    </span>
  );
}

const CATEGORY_EMOJI: Record<string, string> = {
  politics: "🏛️",
  sports: "⚽",
  crypto: "₿",
  tech: "💻",
  entertainment: "🎬",
  finance: "📈",
  world: "🌍",
  culture: "🎨",
  other: "🔮",
};

function placeholderMarketImage({
  question,
  category,
}: {
  question: string;
  category: string;
}): string {
  const emoji = CATEGORY_EMOJI[category] ?? CATEGORY_EMOJI.other;
  const title = escapeSvg(question.trim().slice(0, 42) || "Market");
  const sub = escapeSvg((CATEGORY_LABELS as Record<string, string>)[category] ?? "Market");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a855f7"/>
      <stop offset="0.55" stop-color="#0ea5e9"/>
      <stop offset="1" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="rgba(0,0,0,0.45)"/>
    </filter>
  </defs>
  <rect x="6" y="6" width="84" height="84" rx="16" fill="url(#g)" filter="url(#s)"/>
  <rect x="8" y="8" width="80" height="80" rx="14" fill="rgba(0,0,0,0.32)"/>
  <text x="18" y="34" font-size="20">${emoji}</text>
  <text x="18" y="54" font-size="10" font-weight="700" fill="rgba(255,255,255,0.92)">${sub}</text>
  <text x="18" y="70" font-size="10" fill="rgba(255,255,255,0.82)">${title}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return ch;
    }
  });
}

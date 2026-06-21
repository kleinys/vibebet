import Link from "next/link";
import { formatUsdVolume } from "@/lib/polymarket";
import type { MirrorCatalogSidebar } from "@/lib/mirror-catalog";
import {
  CATEGORY_LABELS,
  MARKET_CATEGORIES,
  type MarketCategory,
} from "@/lib/supabase/types";

interface MarketsSidebarProps {
  catalog: MirrorCatalogSidebar;
  activeCategory?: MarketCategory;
  activeEventSlug?: string;
  hrefBase: string;
  /** Preserve these query params in sidebar links. */
  preserve: {
    sort?: string;
    q?: string;
    status?: string;
    source?: string;
    kind?: string;
  };
}

export function MarketsSidebar({
  catalog,
  activeCategory,
  activeEventSlug,
  hrefBase,
  preserve,
}: MarketsSidebarProps) {
  const countByCategory = new Map(
    catalog.categories.map((c) => [c.category, c.count]),
  );

  return (
    <aside className="space-y-6 text-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Polymarket mirrors
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {catalog.total_open.toLocaleString()} open · odds synced from PM
        </p>
      </div>

      <nav>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Categories
        </p>
        <ul className="space-y-0.5">
          <SidebarLink
            href={buildSidebarHref(hrefBase, preserve, {})}
            active={!activeCategory && !activeEventSlug}
            label="All mirrors"
            count={catalog.total_open}
          />
          {MARKET_CATEGORIES.map((cat) => {
            const count = countByCategory.get(cat) ?? 0;
            if (count === 0) return null;
            return (
              <SidebarLink
                key={cat}
                href={buildSidebarHref(hrefBase, preserve, { category: cat })}
                active={activeCategory === cat && !activeEventSlug}
                label={CATEGORY_LABELS[cat]}
                count={count}
              />
            );
          })}
        </ul>
      </nav>

      {catalog.events.length > 0 && (
        <nav>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Top events
          </p>
          <ul className="space-y-0.5">
            {catalog.events.slice(0, 12).map((ev) => (
              <SidebarLink
                key={ev.slug}
                href={buildSidebarHref(hrefBase, preserve, { event: ev.slug })}
                active={activeEventSlug === ev.slug}
                label={ev.title}
                count={ev.market_count}
                sublabel={
                  ev.volume_24h_usd > 0
                    ? `${formatUsdVolume(ev.volume_24h_usd)} PM 24h`
                    : undefined
                }
              />
            ))}
          </ul>
        </nav>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-500">
        USD volume is from Polymarket. VIBE trades on Vibebet are separate play-money
        activity.
      </p>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  label,
  count,
  sublabel,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  sublabel?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={
          active
            ? "flex items-start justify-between gap-2 rounded-md bg-zinc-800/80 px-2.5 py-1.5 text-zinc-100"
            : "flex items-start justify-between gap-2 rounded-md px-2.5 py-1.5 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
        }
      >
        <span className="min-w-0 flex-1 line-clamp-2 text-xs leading-snug">{label}</span>
        <span className="shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
          {count != null && <span>{count}</span>}
          {sublabel && (
            <span className="mt-0.5 block text-[10px] text-amber-400/80">{sublabel}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function buildSidebarHref(
  base: string,
  preserve: MarketsSidebarProps["preserve"],
  extra: { category?: MarketCategory; event?: string },
): string {
  const params = new URLSearchParams();
  params.set("source", "polymarket_mirror");
  if (preserve.sort && preserve.sort !== "trending") params.set("sort", preserve.sort);
  if (preserve.q) params.set("q", preserve.q);
  if (preserve.status && preserve.status !== "open") params.set("status", preserve.status);
  if (preserve.kind && preserve.kind !== "all") params.set("kind", preserve.kind);
  if (extra.category) params.set("category", extra.category);
  if (extra.event) params.set("event", extra.event);
  return `${base}?${params.toString()}`;
}

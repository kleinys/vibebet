import Link from "next/link";
import { listMarkets, type MarketSort } from "@/lib/markets";
import { getMirrorCatalogSidebar } from "@/lib/mirror-catalog";
import { runPlatformBackgroundTicks } from "@/lib/platform-activity";
import { isEnabled } from "@/lib/feature-flags";
import { MarketCard } from "@/components/market-card";
import { CategoricalMarketCard } from "@/components/categorical-market-card";
import { MarketsSidebar } from "@/components/markets-sidebar";
import { listCategoricalMarkets } from "@/lib/categorical";
import {
  CATEGORY_LABELS,
  MARKET_CATEGORIES,
  type MarketCategory,
  type MarketSource,
  type MarketStatus,
} from "@/lib/supabase/types";

export const revalidate = 0;

const KIND_FILTERS: {
  id: "all" | "binary" | "categorical";
  label: string;
}[] = [
  { id: "all", label: "All types" },
  { id: "binary", label: "Yes / No" },
  { id: "categorical", label: "Multi-outcome" },
];

const SOURCE_FILTERS: {
  id: "all" | MarketSource;
  label: string;
  source?: MarketSource;
}[] = [
  { id: "all", label: "All sources" },
  { id: "platform", label: "Official", source: "platform" },
  { id: "polymarket_mirror", label: "Polymarket mirror", source: "polymarket_mirror" },
  { id: "community", label: "Community", source: "community" },
];

const SORT_OPTIONS: { id: MarketSort; label: string }[] = [
  { id: "trending", label: "Trending" },
  { id: "mirror_volume", label: "PM volume" },
  { id: "new", label: "New" },
  { id: "volume", label: "All-time volume" },
  { id: "closing", label: "Closing soon" },
];

/**
 * `status` query param maps to a SET of underlying market statuses:
 *   open       → ['open']                — live trading
 *   challenge  → ['resolving']           — admin proposed, 24h window
 *   court      → ['in_court']            — community vote in progress
 *   resolved   → ['resolved', 'voided']  — settled
 *   all        → all of the above
 */
const STATUS_FILTERS: {
  id: "open" | "challenge" | "court" | "resolved" | "all";
  label: string;
  statuses?: MarketStatus[];
}[] = [
  { id: "open", label: "Open", statuses: ["open"] },
  { id: "challenge", label: "Challenge", statuses: ["resolving"] },
  { id: "court", label: "In court", statuses: ["in_court"] },
  {
    id: "resolved",
    label: "Resolved",
    statuses: ["resolved", "voided"],
  },
  { id: "all", label: "All" },
];

interface PageProps {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    q?: string;
    status?: string;
    source?: string;
    kind?: string;
    event?: string;
  }>;
}

export default async function MarketsPage({ searchParams }: PageProps) {
  const enabled = await isEnabled("markets_enabled");
  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Markets are off</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The <code className="font-mono">markets_enabled</code> flag is
          currently disabled. An admin can flip it on.
        </p>
      </div>
    );
  }

  await runPlatformBackgroundTicks({ activityLimit: 2 });

  const params = await searchParams;
  const category = (
    MARKET_CATEGORIES.includes(params.category as MarketCategory)
      ? (params.category as MarketCategory)
      : undefined
  );
  const q = (params.q ?? "").trim();
  const statusFilter =
    STATUS_FILTERS.find((s) => s.id === params.status) ?? STATUS_FILTERS[0];
  const sourceFilter =
    SOURCE_FILTERS.find((s) => s.id === params.source) ?? SOURCE_FILTERS[0];
  const kindFilter =
    KIND_FILTERS.find((k) => k.id === params.kind) ?? KIND_FILTERS[0];
  const eventSlug = (params.event ?? "").trim() || undefined;
  const sort = (
    SORT_OPTIONS.some((s) => s.id === params.sort)
      ? (params.sort as MarketSort)
      : sourceFilter.id === "polymarket_mirror" || eventSlug
        ? "mirror_volume"
        : "trending"
  );
  const showMirrorSidebar =
    sourceFilter.id === "polymarket_mirror" || Boolean(eventSlug);

  const listLimit =
    sourceFilter.id === "polymarket_mirror" || eventSlug ? 90 : 60;

  const [binaryMarkets, categoricalMarkets, mirrorCatalog] = await Promise.all([
    kindFilter.id !== "categorical"
      ? listMarkets({
          statuses: statusFilter.statuses,
          status: statusFilter.statuses ? undefined : "all",
          source: sourceFilter.source,
          category,
          eventSlug,
          sort: eventSlug ? "mirror_volume" : sort,
          search: q || undefined,
          limit: listLimit,
          kind: "binary",
        })
      : Promise.resolve([]),
    kindFilter.id !== "binary"
      ? listCategoricalMarkets({
          statuses: statusFilter.statuses,
          status: statusFilter.statuses ? undefined : "all",
          category,
          search: q || undefined,
          limit: listLimit,
        })
      : Promise.resolve([]),
    showMirrorSidebar ? getMirrorCatalogSidebar() : Promise.resolve(null),
  ]);

  type GridItem =
    | { kind: "binary"; id: string; market: (typeof binaryMarkets)[0] }
    | { kind: "categorical"; id: string; market: (typeof categoricalMarkets)[0] };

  const gridItems: GridItem[] = [
    ...binaryMarkets.map((m) => ({
      kind: "binary" as const,
      id: m.id,
      market: m,
    })),
    ...categoricalMarkets.map((m) => ({
      kind: "categorical" as const,
      id: m.id,
      market: m,
    })),
  ].sort((a, b) => {
    if (sort === "volume") {
      return (b.market.volume ?? 0) - (a.market.volume ?? 0);
    }
    return 0;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Markets</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {q
              ? `Searching for "${q}"`
              : eventSlug
                ? "Markets in this Polymarket event"
                : sourceFilter.id === "polymarket_mirror"
                  ? "Polymarket mirrors — live USD odds, play-money VIBE bets"
                  : "Bet VIBE on outcomes. Closed-loop play money — no withdrawals."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/markets/new/categorical"
            className="rounded-md border border-violet-500/40 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/10"
          >
            Multi-outcome
          </Link>
          <Link
            href="/markets/new"
            className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-400"
          >
            Create market
          </Link>
        </div>
      </div>

      {/* Search */}
      <form
        action="/markets"
        method="GET"
        className="mt-6 flex items-center gap-2"
      >
        {category && <input type="hidden" name="category" value={category} />}
        {eventSlug && <input type="hidden" name="event" value={eventSlug} />}
        <input type="hidden" name="sort" value={sort} />
        {statusFilter.id !== "open" && (
          <input type="hidden" name="status" value={statusFilter.id} />
        )}
        {sourceFilter.id !== "all" && (
          <input type="hidden" name="source" value={sourceFilter.id} />
        )}
        {kindFilter.id !== "all" && (
          <input type="hidden" name="kind" value={kindFilter.id} />
        )}
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search markets…"
          className="w-full max-w-md rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm hover:border-white/20"
        >
          Search
        </button>
      </form>

      {/* Category tabs */}
      <div className="mt-6 -mx-6 overflow-x-auto px-6">
        <div className="flex min-w-max gap-1 border-b border-white/5 pb-1">
          <CategoryTab
            href={buildHref({ sort, q, status: statusFilter.id, source: sourceFilter.id, kind: kindFilter.id, event: eventSlug })}
            active={!category}
            label="All"
          />
          {MARKET_CATEGORIES.map((c) => (
            <CategoryTab
              key={c}
              href={buildHref({ category: c, sort, q, status: statusFilter.id, source: sourceFilter.id, kind: kindFilter.id, event: eventSlug })}
              active={category === c}
              label={CATEGORY_LABELS[c]}
            />
          ))}
        </div>
      </div>

      {/* Kind tabs */}
      <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
        {KIND_FILTERS.map((k) => (
          <Link
            key={k.id}
            href={buildHref({
              category,
              sort,
              q,
              status: statusFilter.id,
              source: sourceFilter.id,
              kind: k.id,
              event: eventSlug,
            })}
            className={
              k.id === kindFilter.id
                ? "rounded-md bg-violet-500/20 px-2.5 py-1 text-violet-200 ring-1 ring-violet-500/30"
                : "rounded-md px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
            }
          >
            {k.label}
          </Link>
        ))}
      </div>

      {/* Source tabs */}
      <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
        {SOURCE_FILTERS.map((s) => (
          <Link
            key={s.id}
            href={buildHref({
              category,
              sort,
              q,
              status: statusFilter.id,
              source: s.id,
              kind: kindFilter.id,
              event: s.id === "polymarket_mirror" ? eventSlug : undefined,
            })}
            className={
              s.id === sourceFilter.id
                ? "rounded-md bg-fuchsia-500/20 px-2.5 py-1 text-fuchsia-200 ring-1 ring-fuchsia-500/30"
                : "rounded-md px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
            }
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Status + Sort tabs row */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s.id}
              href={buildHref({ category, sort, q, status: s.id, source: sourceFilter.id, kind: kindFilter.id, event: eventSlug })}
              className={
                s.id === statusFilter.id
                  ? "rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-100"
                  : "rounded-md px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
              }
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((s) => (
            <Link
              key={s.id}
              href={buildHref({ category, sort: s.id, q, status: statusFilter.id, source: sourceFilter.id, kind: kindFilter.id, event: eventSlug })}
              className={
                s.id === sort
                  ? "rounded-md bg-zinc-800 px-2.5 py-1 text-zinc-100"
                  : "rounded-md px-2.5 py-1 text-zinc-400 hover:text-zinc-200"
              }
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div
        className={
          mirrorCatalog && showMirrorSidebar
            ? "mt-6 flex flex-col gap-8 lg:flex-row lg:items-start"
            : "mt-6"
        }
      >
        {mirrorCatalog && showMirrorSidebar && (
          <div className="w-full shrink-0 lg:w-56 xl:w-64">
            <MarketsSidebar
              catalog={mirrorCatalog}
              activeCategory={category}
              activeEventSlug={eventSlug}
              hrefBase="/markets"
              preserve={{
                sort,
                q,
                status: statusFilter.id,
                kind: kindFilter.id,
              }}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
      {gridItems.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-white/10 p-12 text-center text-sm text-zinc-400">
          {q ? (
            <>
              No markets match &ldquo;{q}&rdquo;. Try a different search or{" "}
              <Link
                href="/markets/new"
                className="text-fuchsia-400 hover:underline"
              >
                create one
              </Link>
              .
            </>
          ) : statusFilter.id === "challenge" ? (
            <>No markets in their challenge window right now.</>
          ) : statusFilter.id === "court" ? (
            <>
              No markets in court right now.{" "}
              <Link href="/court" className="text-fuchsia-400 hover:underline">
                Visit the court
              </Link>{" "}
              for case history.
            </>
          ) : statusFilter.id === "resolved" ? (
            <>Nothing resolved yet.</>
          ) : sourceFilter.id !== "all" ? (
            <>
              No {sourceFilter.label.toLowerCase()} markets yet.{" "}
              {sourceFilter.id === "community" ? (
                <Link href="/markets/new" className="text-fuchsia-400 hover:underline">
                  Create one
                </Link>
              ) : (
                <Link href="/admin" className="text-fuchsia-400 hover:underline">
                  Admin: seed markets
                </Link>
              )}
              .
            </>
          ) : (
            <>
              No open markets in this slice yet.{" "}
              <Link
                href="/markets/new"
                className="text-fuchsia-400 hover:underline"
              >
                Be the first
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((item) => (
            <li key={item.id}>
              {item.kind === "binary" ? (
                <MarketCard market={item.market} />
              ) : (
                <CategoricalMarketCard market={item.market} />
              )}
            </li>
          ))}
        </ul>
      )}
        </div>
      </div>
    </div>
  );
}

function buildHref({
  category,
  sort,
  q,
  status,
  source,
  kind,
  event,
}: {
  category?: MarketCategory;
  sort: MarketSort;
  q?: string;
  status?: string;
  source?: string;
  kind?: string;
  event?: string;
}): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sort && sort !== "trending" && sort !== "mirror_volume") params.set("sort", sort);
  if (q) params.set("q", q);
  if (status && status !== "open") params.set("status", status);
  if (source && source !== "all") params.set("source", source);
  if (kind && kind !== "all") params.set("kind", kind);
  if (event) params.set("event", event);
  const qs = params.toString();
  return qs ? `/markets?${qs}` : "/markets";
}

function CategoryTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-t-md border-b-2 border-fuchsia-500 px-3 py-2 text-sm font-medium text-zinc-100"
          : "rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
      }
    >
      {label}
    </Link>
  );
}

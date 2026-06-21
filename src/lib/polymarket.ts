/**

 * Read-only Polymarket gamma API client.

 * Used to mirror trending markets into Vibebet as play-money clones.

 *

 * NOTE: We sync questions + live odds for display. Vibebet uses its own

 * CPMM and VIBE — this is NOT real-money Polymarket integration.

 */



export interface PolymarketTag {

  slug: string;

  label: string;

}



export interface PolymarketMarket {

  id: string;

  question: string;

  slug: string;

  description: string;

  outcomes: string[];

  outcomePrices: number[];

  volumeNum: number;

  volume24hr: number;

  endDate: string | null;

  image: string | null;

  category: string;

  eventId: string | null;

  eventSlug: string | null;

  eventTitle: string | null;

  tags: PolymarketTag[];

}



interface RawPolymarketEvent {

  id?: string;

  slug?: string;

  title?: string;

  tags?: Array<{ slug?: string; label?: string }>;

}



interface RawPolymarketMarket {

  id: string;

  question: string;

  slug: string;

  description?: string;

  outcomes?: string;

  outcomePrices?: string;

  volumeNum?: number;

  volume24hr?: number;

  endDate?: string;

  image?: string;

  events?: RawPolymarketEvent[];

}



const GAMMA_URL = "https://gamma-api.polymarket.com/markets";

const DEFAULT_CATALOG_LIMIT = 250;

const PAGE_SIZE = 100;



function parseJsonArray(raw: string | undefined): string[] {

  if (!raw) return ["Yes", "No"];

  try {

    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? parsed.map(String) : ["Yes", "No"];

  } catch {

    return ["Yes", "No"];

  }

}



function parsePriceArray(raw: string | undefined): number[] {

  if (!raw) return [0.5, 0.5];

  try {

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) return [0.5, 0.5];

    return parsed.map((v) => {

      const n = Number(v);

      return Number.isFinite(n) ? n : 0.5;

    });

  } catch {

    return [0.5, 0.5];

  }

}



const TAG_SLUG_TO_CATEGORY: Record<string, string> = {

  politics: "politics",

  elections: "politics",

  "us-politics": "politics",

  sports: "sports",

  crypto: "crypto",

  tech: "tech",

  entertainment: "entertainment",

  popculture: "entertainment",

  finance: "finance",

  business: "finance",

  world: "world",

  geopolitics: "world",

  culture: "culture",

};



const TAG_LABEL_TO_CATEGORY: Record<string, string> = {

  politics: "politics",

  sports: "sports",

  crypto: "crypto",

  tech: "tech",

  entertainment: "entertainment",

  finance: "finance",

  world: "world",

  culture: "culture",

  business: "finance",

};



/** Infer Vibebet category from PM tags, then question + event title. */

export function inferCategory(

  question: string,

  eventTitle?: string,

  tags?: PolymarketTag[],

): string {

  for (const tag of tags ?? []) {

    const fromSlug = TAG_SLUG_TO_CATEGORY[tag.slug.toLowerCase()];

    if (fromSlug) return fromSlug;

    const fromLabel = TAG_LABEL_TO_CATEGORY[tag.label.toLowerCase()];

    if (fromLabel) return fromLabel;

  }



  const text = `${question} ${eventTitle ?? ""}`.toLowerCase();

  if (/bitcoin|btc|ethereum|eth|crypto|solana|defi|token|blockchain/.test(text)) return "crypto";

  if (/trump|biden|election|president|congress|senate|vote|democrat|republican|prime minister|parliament|nomination|governor/.test(text)) return "politics";

  if (/fed|rate|gdp|recession|inflation|stock|s&p|nasdaq|tariff|treasury/.test(text)) return "finance";

  if (/nba|nfl|mlb|soccer|world cup|championship|super bowl|ufc|tennis|fifa|olympics|lakers|netherlands/.test(text)) return "sports";

  if (/openai|gpt|ai |spacex|apple|google|meta|tesla|iphone|tech|microsoft|nvidia/.test(text)) return "tech";

  if (/album|movie|oscar|grammy|gta|netflix|celebrity|rihanna|drake|tiktok ban/.test(text)) return "entertainment";

  if (/war|ukraine|russia|china|israel|ceasefire|nato|un |ethiopia|iran|troops|climate|temperature/.test(text)) return "world";

  if (/tiktok|twitter|meme|culture|viral/.test(text)) return "culture";

  return "other";

}



function parseTags(raw?: RawPolymarketEvent[]): PolymarketTag[] {

  const event = raw?.[0];

  if (!event?.tags?.length) return [];

  return event.tags

    .filter((t) => t.slug && t.label)

    .map((t) => ({ slug: String(t.slug), label: String(t.label) }))

    .slice(0, 12);

}



function mapRawMarket(m: RawPolymarketMarket): PolymarketMarket | null {

  if (!m.question || m.question.length < 10) return null;



  const outcomes = parseJsonArray(m.outcomes);

  const prices = parsePriceArray(m.outcomePrices);

  const event = m.events?.[0];

  const eventTitle = event?.title;

  const tags = parseTags(m.events);



  return {

    id: m.id,

    question: m.question.trim(),

    slug: m.slug,

    description: (m.description ?? "").slice(0, 2000),

    outcomes,

    outcomePrices: prices,

    volumeNum: m.volumeNum ?? 0,

    volume24hr: m.volume24hr ?? 0,

    endDate: m.endDate ?? null,

    image: m.image ?? null,

    category: inferCategory(m.question, eventTitle, tags),

    eventId: event?.id ?? null,

    eventSlug: event?.slug ?? null,

    eventTitle: eventTitle ?? null,

    tags,

  };

}



async function fetchPolymarketPage(

  limit: number,

  offset: number,

): Promise<RawPolymarketMarket[]> {

  const url = new URL(GAMMA_URL);

  url.searchParams.set("closed", "false");

  url.searchParams.set("active", "true");

  url.searchParams.set("limit", String(limit));

  url.searchParams.set("offset", String(offset));

  url.searchParams.set("order", "volume24hr");

  url.searchParams.set("ascending", "false");



  const res = await fetch(url.toString(), {

    next: { revalidate: 300 },

  });

  if (!res.ok) {

    throw new Error(`Polymarket API ${res.status}: ${res.statusText}`);

  }

  return (await res.json()) as RawPolymarketMarket[];

}



/** Paginated fetch of active PM markets sorted by 24h volume. */

export async function fetchTrendingPolymarketMarkets(

  totalLimit = DEFAULT_CATALOG_LIMIT,

): Promise<PolymarketMarket[]> {

  const cap = Math.min(Math.max(totalLimit, 1), 500);

  const byId = new Map<string, PolymarketMarket>();



  for (let offset = 0; offset < cap; offset += PAGE_SIZE) {

    const pageLimit = Math.min(PAGE_SIZE, cap - offset);

    const raw = await fetchPolymarketPage(pageLimit, offset);

    if (raw.length === 0) break;



    for (const row of raw) {

      const mapped = mapRawMarket(row);

      if (mapped) byId.set(mapped.id, mapped);

    }



    if (raw.length < pageLimit) break;

  }



  return [...byId.values()].sort((a, b) => b.volume24hr - a.volume24hr);
}

/** Status check for PM-2 mirror resolution sync. */
export interface PolymarketStatusUpdate {
  external_id: string;
  closed: boolean;
  yes_price: number;
}

/** Fetch current closed/active state for specific PM market ids. */
export async function fetchPolymarketMarketsByIds(
  ids: string[],
): Promise<PolymarketStatusUpdate[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 200);
  if (unique.length === 0) return [];

  const out: PolymarketStatusUpdate[] = [];
  const chunkSize = 15;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const url = new URL(GAMMA_URL);
    for (const id of chunk) {
      url.searchParams.append("id", id);
    }

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) continue;

    const raw = (await res.json()) as RawPolymarketMarket[];
    for (const m of raw) {
      const prices = parsePriceArray(m.outcomePrices);
      const closed =
        (m as RawPolymarketMarket & { closed?: boolean; active?: boolean }).closed ===
          true ||
        (m as RawPolymarketMarket & { active?: boolean }).active === false;
      out.push({
        external_id: m.id,
        closed,
        yes_price: prices[0] ?? 0.5,
      });
    }
  }

  return out;
}

export function polymarketUrl(slug: string): string {

  return `https://polymarket.com/event/${slug}`;

}



/** Prefer event slug for outbound links when available. */

export function polymarketMarketUrl(market: Pick<PolymarketMarket, "slug" | "eventSlug">): string {

  return polymarketUrl(market.eventSlug ?? market.slug);

}



/** Format USD volume for mirror badge (e.g. "$828K"). */

export function formatUsdVolume(n: number): string {

  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;

  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;

  return `$${Math.round(n)}`;

}



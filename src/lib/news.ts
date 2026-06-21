import "server-only";

export interface NewsHeadline {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

const STOP_WORDS = new Set([
  "will",
  "the",
  "a",
  "an",
  "be",
  "by",
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
  "and",
  "or",
  "is",
  "are",
  "before",
  "after",
  "this",
  "that",
  "with",
  "from",
  "as",
  "it",
  "its",
  "than",
  "any",
  "no",
  "yes",
  "us",
  "u.s",
  "2024",
  "2025",
  "2026",
  "2027",
]);

/** Build a short Google News query from a market question. */
export function newsQueryFromQuestion(question: string): string {
  const words = question
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const unique: string[] = [];
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!unique.some((u) => u.toLowerCase() === lower)) unique.push(w);
    if (unique.length >= 6) break;
  }

  return unique.join(" ") || question.slice(0, 80);
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function parseRssItems(xml: string, limit: number): NewsHeadline[] {
  const items: NewsHeadline[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = decodeXml(
      block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    );
    const link = decodeXml(
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "",
    );
    const pubDate = decodeXml(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "",
    );
    const source = decodeXml(
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "News",
    );

    if (!title || !link) continue;

    items.push({
      title,
      url: link,
      source: source || "News",
      publishedAt: pubDate || null,
    });
  }

  return items;
}

/** Fetch a few related headlines via Google News RSS (no API key). */
export async function fetchRelatedNews(
  question: string,
  limit = 3,
): Promise<NewsHeadline[]> {
  const q = newsQueryFromQuestion(question);
  if (!q.trim()) return [];

  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", q);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseRssItems(xml, limit);
  } catch {
    return [];
  }
}

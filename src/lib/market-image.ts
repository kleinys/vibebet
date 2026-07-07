import { CATEGORY_LABELS } from "@/lib/supabase/types";

/** Country / region names → ISO 3166-1 alpha-2 for flagcdn. */
const COUNTRY_ISO: Record<string, string> = {
  afghanistan: "af",
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  brazil: "br",
  canada: "ca",
  chile: "cl",
  china: "cn",
  colombia: "co",
  croatia: "hr",
  czech: "cz",
  "czech republic": "cz",
  denmark: "dk",
  ecuador: "ec",
  egypt: "eg",
  england: "gb-eng",
  finland: "fi",
  france: "fr",
  germany: "de",
  ghana: "gh",
  greece: "gr",
  hungary: "hu",
  india: "in",
  iran: "ir",
  ireland: "ie",
  israel: "il",
  italy: "it",
  japan: "jp",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  norway: "no",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  romania: "ro",
  russia: "ru",
  "saudi arabia": "sa",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  "south africa": "za",
  "south korea": "kr",
  korea: "kr",
  spain: "es",
  sweden: "se",
  switzerland: "ch",
  turkey: "tr",
  ukraine: "ua",
  "united states": "us",
  usa: "us",
  us: "us",
  uruguay: "uy",
  wales: "gb-wls",
};

/** Keywords → generated badge art (always local — no hotlink failures). */
const ENTITY_BADGES: Array<{ pattern: RegExp; label: string; accent: string }> = [
  { pattern: /\bbitcoin\b|\bbtc\b/i, label: "BTC", accent: "#f59e0b" },
  { pattern: /\bethereum\b|\beth\b/i, label: "ETH", accent: "#6366f1" },
  { pattern: /\bsolana\b|\bsol\b/i, label: "SOL", accent: "#14b8a6" },
  { pattern: /\bspacex\b|\bstarship\b|\bfalcon\b/i, label: "SX", accent: "#0ea5e9" },
  { pattern: /\btesla\b/i, label: "TSLA", accent: "#ef4444" },
  { pattern: /\bapple\b|\biphone\b|\bios\b|\bfoldable\b/i, label: "AAPL", accent: "#a3a3a3" },
  { pattern: /\bgoogle\b|\balphabet\b/i, label: "GOOG", accent: "#38bdf8" },
  { pattern: /\bmeta\b|\bfacebook\b|\binstagram\b/i, label: "META", accent: "#3b82f6" },
  { pattern: /\btiktok\b/i, label: "TT", accent: "#f472b6" },
  { pattern: /\bnvidia\b/i, label: "NVDA", accent: "#84cc16" },
  { pattern: /\bopenai\b|\bchatgpt\b|\bgpt-?5\b|\bgpt\b/i, label: "AI", accent: "#10b981" },
  { pattern: /\bgta\b|\brockstar\b|\bgrand theft auto\b/i, label: "GTA", accent: "#f97316" },
  { pattern: /\blakers\b|\blos angeles lakers\b/i, label: "LAL", accent: "#a855f7" },
  { pattern: /\bceltics\b|\bboston celtics\b/i, label: "BOS", accent: "#22c55e" },
  { pattern: /\bwarriors\b|\bgolden state\b/i, label: "GSW", accent: "#fbbf24" },
  { pattern: /\btrump\b|\bdonald trump\b/i, label: "US", accent: "#dc2626" },
  { pattern: /\bbiden\b|\bjoe biden\b/i, label: "US", accent: "#2563eb" },
  { pattern: /\belon\b|\bmusk\b/i, label: "EM", accent: "#64748b" },
  { pattern: /\bufc\b|\bmma\b/i, label: "UFC", accent: "#ef4444" },
  { pattern: /\bfifa\b|\bworld cup\b/i, label: "WC", accent: "#22d3ee" },
  { pattern: /\bfed\b|\brate cut\b|\bfederal reserve\b/i, label: "FED", accent: "#14b8a6" },
  { pattern: /\boscar\b|\bacademy award\b/i, label: "OSC", accent: "#eab308" },
  { pattern: /\brecession\b|\bgdp\b/i, label: "GDP", accent: "#f43f5e" },
  { pattern: /\btemperature\b|\bclimate\b/i, label: "CLM", accent: "#06b6d4" },
];

function isLikelyBrokenImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("data:")) return false;
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) return true;
    if (parsed.hostname === "localhost") return true;
    return false;
  } catch {
    return true;
  }
}

function detectEntityBadge(question: string): { label: string; accent: string } | null {
  for (const { pattern, label, accent } of ENTITY_BADGES) {
    if (pattern.test(question)) return { label, accent };
  }
  return null;
}

function entityBadgeSvg(question: string, category: string, badge: { label: string; accent: string }): string {
  const palette = CATEGORY_PALETTE[category] ?? CATEGORY_PALETTE.other;
  const [c1, c2] = palette;
  const title = escapeSvg(question.trim().slice(0, 28) || "Market");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="14" fill="url(#g)"/>
  <circle cx="48" cy="40" r="22" fill="rgba(0,0,0,0.32)"/>
  <circle cx="48" cy="40" r="18" fill="${badge.accent}"/>
  <text x="48" y="45" text-anchor="middle" font-size="13" font-weight="800" fill="#0f172a">${escapeSvg(badge.label)}</text>
  <text x="10" y="78" font-size="8" fill="rgba(255,255,255,0.82)">${title}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const CATEGORY_PALETTE: Record<string, [string, string, string]> = {
  politics: ["#6366f1", "#312e81", "#c4b5fd"],
  sports: ["#059669", "#064e3b", "#6ee7b7"],
  crypto: ["#f59e0b", "#78350f", "#fde68a"],
  tech: ["#0ea5e9", "#0c4a6e", "#7dd3fc"],
  entertainment: ["#ec4899", "#831843", "#f9a8d4"],
  finance: ["#14b8a6", "#134e4a", "#5eead4"],
  world: ["#8b5cf6", "#4c1d95", "#c4b5fd"],
  culture: ["#f97316", "#7c2d12", "#fdba74"],
  other: ["#64748b", "#1e293b", "#cbd5e1"],
};

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function detectCountryFlag(question: string): string | null {
  const lower = question.toLowerCase();
  const names = Object.keys(COUNTRY_ISO).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) {
      return `https://flagcdn.com/w80/${COUNTRY_ISO[name]}.png`;
    }
  }
  return null;
}

function detectEntityIcon(question: string, category: string): string | null {
  const badge = detectEntityBadge(question);
  if (!badge) return null;
  return entityBadgeSvg(question, category, badge);
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

function categoryPlaceholderSvg(question: string, category: string): string {
  const palette = CATEGORY_PALETTE[category] ?? CATEGORY_PALETTE.other;
  const h = hashString(question);
  const [c1, c2, c3] = palette;
  const accent = `hsl(${h % 360} 70% 55%)`;
  const title = escapeSvg(question.trim().slice(0, 36) || "Market");
  const sub = escapeSvg(CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? "Market");
  const initial = escapeSvg((question.trim()[0] ?? "?").toUpperCase());
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="0.5" stop-color="${c2}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="14" fill="url(#g)"/>
  <circle cx="48" cy="34" r="18" fill="rgba(0,0,0,0.28)"/>
  <text x="48" y="40" text-anchor="middle" font-size="18" font-weight="700" fill="${c3}">${initial}</text>
  <text x="10" y="62" font-size="9" font-weight="700" fill="rgba(255,255,255,0.9)">${sub}</text>
  <text x="10" y="76" font-size="8" fill="rgba(255,255,255,0.78)">${title}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Best image for a market card: entity badge → flag → distinct category art (skip broken stored URLs). */
export function resolveMarketImage(opts: {
  question: string;
  category: string;
  imageUrl?: string | null;
}): string {
  const stored = opts.imageUrl?.trim();
  if (stored && !isLikelyBrokenImageUrl(stored)) return stored;
  return (
    detectCountryFlag(opts.question) ??
    detectEntityIcon(opts.question, opts.category) ??
    categoryPlaceholderSvg(opts.question, opts.category)
  );
}

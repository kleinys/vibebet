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

/** Keywords → icon URL (simple, license-friendly sources). */
const ENTITY_ICONS: Array<{ pattern: RegExp; url: string }> = [
  { pattern: /\bbitcoin\b|\bbtc\b/i, url: "https://cryptologos.cc/logos/bitcoin-btc-logo.png" },
  { pattern: /\bethereum\b|\beth\b/i, url: "https://cryptologos.cc/logos/ethereum-eth-logo.png" },
  { pattern: /\bsolana\b|\bsol\b/i, url: "https://cryptologos.cc/logos/solana-sol-logo.png" },
  { pattern: /\bspacex\b|\bstarship\b|\bfalcon\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/SpaceX-Logo.svg/240px-SpaceX-Logo.svg.png" },
  { pattern: /\btesla\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Tesla_Motors.svg/240px-Tesla_Motors.svg.png" },
  { pattern: /\bapple\b|\biphone\b|\bios\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/240px-Apple_logo_black.svg.png" },
  { pattern: /\bgoogle\b|\balphabet\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/240px-Google_2015_logo.svg.png" },
  { pattern: /\bmeta\b|\bfacebook\b|\binstagram\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Meta-Logo.png/240px-Meta-Logo.png" },
  { pattern: /\btiktok\b/i, url: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/240px-TikTok_logo.svg.png" },
  { pattern: /\bnvidia\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Nvidia_logo.svg/240px-Nvidia_logo.svg.png" },
  { pattern: /\bopenai\b|\bchatgpt\b|\bgpt\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/240px-OpenAI_Logo.svg.png" },
  { pattern: /\bgta\b|\brockstar\b|\bgrand theft auto\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Rockstar_Games_Logo.svg/240px-Rockstar_Games_Logo.svg.png" },
  { pattern: /\blakers\b|\blos angeles lakers\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Los_Angeles_Lakers_logo.svg/240px-Los_Angeles_Lakers_logo.svg.png" },
  { pattern: /\bceltics\b|\bboston celtics\b/i, url: "https://upload.wikimedia.org/wikipedia/en/thumb/8/8f/Boston_Celtics.svg/240px-Boston_Celtics.svg.png" },
  { pattern: /\bwarriors\b|\bgolden state\b/i, url: "https://upload.wikimedia.org/wikipedia/en/thumb/0/01/Golden_State_Warriors_logo.svg/240px-Golden_State_Warriors_logo.svg.png" },
  { pattern: /\btrump\b|\bdonald trump\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/240px-Donald_Trump_official_portrait.jpg" },
  { pattern: /\bbiden\b|\bjoe biden\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Joe_Biden_presidential_portrait.jpg/240px-Joe_Biden_presidential_portrait.jpg" },
  { pattern: /\belon\b|\bmusk\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg/240px-Elon_Musk_Royal_Society_%28crop2%29.jpg" },
  { pattern: /\bufc\b|\bmma\b/i, url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/240px-UFC_Logo.svg.png" },
  { pattern: /\bfifa\b|\bworld cup\b/i, url: "https://upload.wikimedia.org/wikipedia/en/thumb/6/67/2022_FIFA_World_Cup.svg/240px-2022_FIFA_World_Cup.svg.png" },
];

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

function detectEntityIcon(question: string): string | null {
  for (const { pattern, url } of ENTITY_ICONS) {
    if (pattern.test(question)) return url;
  }
  return null;
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

/** Best image for a market card: stored URL → entity flag/logo → distinct category art. */
export function resolveMarketImage(opts: {
  question: string;
  category: string;
  imageUrl?: string | null;
}): string {
  if (opts.imageUrl?.trim()) return opts.imageUrl.trim();
  return (
    detectCountryFlag(opts.question) ??
    detectEntityIcon(opts.question) ??
    categoryPlaceholderSvg(opts.question, opts.category)
  );
}

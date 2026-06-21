import "server-only";

export type EquitySymbol = "aapl" | "tsla" | "nvda";

export const EQUITY_SYMBOLS: EquitySymbol[] = ["aapl", "tsla", "nvda"];

export const EQUITY_LABELS: Record<EquitySymbol, string> = {
  aapl: "Apple",
  tsla: "Tesla",
  nvda: "NVIDIA",
};

export interface EquityPrice {
  asset: EquitySymbol;
  price: number;
  label: string;
}

const YAHOO_TICKERS: Record<EquitySymbol, string> = {
  aapl: "AAPL",
  tsla: "TSLA",
  nvda: "NVDA",
};

/** US regular session Mon–Fri 9:30–16:00 Eastern. */
export function isUsEquitySessionOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (["Sat", "Sun"].includes(weekday)) return false;

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

async function fetchYahooQuote(ticker: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Vibebet/1.0" },
    next: { revalidate: 15 },
  });
  if (!res.ok) return null;
  const raw = (await res.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
  };
  const price = raw.chart?.result?.[0]?.meta?.regularMarketPrice;
  return price && price > 0 ? price : null;
}

export async function fetchEquitySpotPrices(
  symbols: EquitySymbol[] = EQUITY_SYMBOLS,
): Promise<EquityPrice[]> {
  const out: EquityPrice[] = [];
  await Promise.all(
    symbols.map(async (asset) => {
      try {
        const price = await fetchYahooQuote(YAHOO_TICKERS[asset]);
        if (price) {
          out.push({ asset, price, label: EQUITY_LABELS[asset] });
        }
      } catch {
        // skip failed symbol
      }
    }),
  );
  return out.sort(
    (a, b) => EQUITY_SYMBOLS.indexOf(a.asset) - EQUITY_SYMBOLS.indexOf(b.asset),
  );
}

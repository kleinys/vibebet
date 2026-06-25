"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatProbability } from "@/lib/cpmm";
import { formatUsdPrice, formatVibe } from "@/lib/utils";
import { FAST_ASSET_ICONS } from "@/lib/fast-assets";

interface LiveWindow {
  id: string;
  question: string;
  asset: string | null;
  intervalSec: number | null;
  strikePrice: number | null;
  windowEnd: string | null;
  yesPrice: number;
  isCommunity?: boolean;
  kind?: "crypto" | "equity";
}

interface LivePrice {
  asset: string;
  label: string;
  price: number;
  kind?: "crypto" | "equity";
}

interface LiveDuel {
  duelId: string;
  challenger: string;
  opponent: string;
  question: string;
  spectatorMarketId: string;
  stake: number;
  acceptedAt: string | null;
}

interface LivePaperRace {
  id: string;
  creator: string;
  opponent: string;
  creatorAsset: string;
  opponentAsset: string;
  stake: number;
  durationSec: number;
  endsAt: string;
}

interface LivePayload {
  at: number;
  prices: LivePrice[];
  windows: LiveWindow[];
  equityWindows?: LiveWindow[];
  duels: LiveDuel[];
  paperRaces: LivePaperRace[];
}

const EQUITY_ICONS: Record<string, string> = {
  aapl: "🍎",
  tsla: "⚡",
  nvda: "🟢",
};

function Countdown({ windowEnd }: { windowEnd: string }) {
  const [sec, setSec] = useState(() =>
    Math.max(0, Math.ceil((new Date(windowEnd).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setSec(Math.max(0, Math.ceil((new Date(windowEnd).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [windowEnd]);

  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span className={sec <= 30 ? "font-mono text-rose-400" : "font-mono text-zinc-200"}>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function LiveArenaBoard({ initial }: { initial: LivePayload }) {
  const [data, setData] = useState(initial);
  const [pulse, setPulse] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/games/live", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as LivePayload;
      setData((prev) => {
        const flash: Record<string, boolean> = {};
        for (const p of next.prices) {
          const old = prev.prices.find((x) => x.asset === p.asset);
          if (old && old.price !== p.price) flash[p.asset] = true;
        }
        if (Object.keys(flash).length) {
          setPulse(flash);
          setTimeout(() => setPulse({}), 600);
        }
        return next;
      });
    } catch {
      // ignore poll errors
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const priceByAsset = new Map(data.prices.map((p) => [p.asset, p.price]));

  return (
    <div className="space-y-8">
      {data.prices.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Live spot prices
            </h2>
            <span className="text-[10px] text-zinc-600">updates every 4s</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {data.prices.map((p) => (
              <div
                key={p.asset}
                className={`rounded-xl border px-4 py-3 transition-colors ${
                  pulse[p.asset]
                    ? "border-emerald-400/50 bg-emerald-500/10"
                    : "border-white/5 bg-zinc-900/40"
                }`}
              >
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  {p.kind === "equity"
                    ? `${EQUITY_ICONS[p.asset] ?? "📈"} `
                    : `${FAST_ASSET_ICONS[p.asset as keyof typeof FAST_ASSET_ICONS] ?? "◆"} `}
                  {p.label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatUsdPrice(p.price)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Crypto Up/Down — auto-resolve
          </h2>
          <Link
            href="/markets/fast"
            className="inline-flex rounded-full border border-amber-500/35 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            All fast windows →
          </Link>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Oracle decides Up vs Down at window end. No polls, no court — clear price output.
        </p>
        {data.windows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No open windows right now.</p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.windows.map((w) => {
              const asset = w.asset ?? "btc";
              const spot = priceByAsset.get(asset);
              const strike = w.strikePrice ?? 0;
              const up = spot != null && spot >= strike;
              return (
                <li key={w.id}>
                  <Link
                    href={`/markets/${w.id}`}
                    className="block rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-amber-500/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-amber-400/90">
                          LIVE · {asset.toUpperCase()}
                          {w.intervalSec
                            ? ` · ${w.intervalSec >= 60 ? `${w.intervalSec / 60}m` : `${w.intervalSec}s`}`
                            : ""}
                          {w.isCommunity ? " · community" : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-snug">{w.question}</p>
                      </div>
                      {w.windowEnd && <Countdown windowEnd={w.windowEnd} />}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-emerald-500/5 px-2 py-1.5 ring-1 ring-emerald-500/10">
                        Up {formatProbability(w.yesPrice)}
                      </div>
                      <div className="rounded-md bg-rose-500/5 px-2 py-1.5 ring-1 ring-rose-500/10">
                        Down {formatProbability(1 - w.yesPrice)}
                      </div>
                    </div>
                    {spot != null && (
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Strike {formatUsdPrice(strike)} · Now {formatUsdPrice(spot)}{" "}
                        <span className={up ? "text-emerald-400" : "text-orange-400"}>
                          ({up ? "winning Up" : "winning Down"})
                        </span>
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(data.equityWindows?.length ?? 0) > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Equities Up/Down — US session
            </h2>
            <Link
              href="/markets/equities"
              className="inline-flex rounded-full border border-sky-500/35 bg-sky-500/10 px-3.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20"
            >
              All stock windows →
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            AAPL, TSLA, NVDA — 15m windows during NYSE hours. Oracle auto-resolves.
          </p>
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.equityWindows!.map((w) => {
              const asset = w.asset ?? "aapl";
              const spot = priceByAsset.get(asset);
              const strike = w.strikePrice ?? 0;
              const up = spot != null && spot >= strike;
              return (
                <li key={w.id}>
                  <Link
                    href={`/markets/${w.id}`}
                    className="block rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition hover:border-sky-500/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-sky-400/90">
                          STOCK · {asset.toUpperCase()}
                          {w.intervalSec
                            ? ` · ${w.intervalSec >= 60 ? `${w.intervalSec / 60}m` : `${w.intervalSec}s`}`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-snug">{w.question}</p>
                      </div>
                      {w.windowEnd && <Countdown windowEnd={w.windowEnd} />}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-emerald-500/5 px-2 py-1.5 ring-1 ring-emerald-500/10">
                        Up {formatProbability(w.yesPrice)}
                      </div>
                      <div className="rounded-md bg-rose-500/5 px-2 py-1.5 ring-1 ring-rose-500/10">
                        Down {formatProbability(1 - w.yesPrice)}
                      </div>
                    </div>
                    {spot != null && (
                      <p className="mt-2 text-[11px] text-zinc-500">
                        Strike {formatUsdPrice(strike)} · Now {formatUsdPrice(spot)}{" "}
                        <span className={up ? "text-emerald-400" : "text-orange-400"}>
                          ({up ? "winning Up" : "winning Down"})
                        </span>
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data.duels.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-400">
              Duel spectators — auto-resolve
            </h2>
            <Link
              href="/duels"
              className="inline-flex rounded-full border border-violet-500/35 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
            >
              All duels →
            </Link>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Bet on who wins the head-to-head. Settles when the underlying market resolves.
          </p>
          <ul className="mt-4 space-y-2">
            {data.duels.map((d) => (
              <li key={d.duelId}>
                <Link
                  href={`/duels/${d.duelId}`}
                  className="block rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 transition hover:border-violet-400/40"
                >
                  <p className="text-sm font-medium text-zinc-100">
                    {d.challenger}{" "}
                    <span className="text-zinc-500">vs</span> {d.opponent}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{d.question}</p>
                  <p className="mt-2 text-xs text-amber-200">
                    Duel stake {formatVibe(d.stake)} VIBE each · tap to bet spectator market
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

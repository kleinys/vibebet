"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/lib/markets";
import { formatProbability } from "@/lib/cpmm";
import { formatVibe } from "@/lib/utils";

interface PriceChartProps {
  points: PricePoint[];
  yesLabel?: string;
  noLabel?: string;
  height?: number;
}

/**
 * Polymarket-style YES-price time series. Renders a placeholder if there
 * isn't enough data (just the synthetic baseline point with no real trades).
 */
export function PriceChart({
  points,
  yesLabel = "Yes",
  noLabel = "No",
  height = 240,
}: PriceChartProps) {
  if (points.length < 2) {
    return (
      <div
        className="grid w-full place-items-center rounded-lg border border-dashed border-white/10 text-xs text-zinc-500"
        style={{ height }}
      >
        Not enough trading activity yet. Place a bet to start the chart.
      </div>
    );
  }

  // Recharts wants plain numbers; we map yesPrice to a percentage for display.
  const data = points.map((p) => ({
    t: p.t,
    yesPct: p.yesPrice * 100,
    volume: p.volume,
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v: number) => formatTick(v, data[0].t, data[data.length - 1].t)}
            tick={{ fontSize: 10, fill: "#71717a" }}
            stroke="#27272a"
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: "#71717a" }}
            stroke="#27272a"
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0].payload as {
                t: number;
                yesPct: number;
                volume: number;
              };
              const yes = p.yesPct / 100;
              return (
                <div className="rounded-md border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg">
                  <div className="text-zinc-400">
                    {new Date(p.t).toLocaleString()}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4">
                    <span className="text-emerald-300">{yesLabel}</span>
                    <span className="tabular-nums text-zinc-100">
                      {formatProbability(yes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-rose-300">{noLabel}</span>
                    <span className="tabular-nums text-zinc-100">
                      {formatProbability(1 - yes)}
                    </span>
                  </div>
                  {p.volume > 0 && (
                    <div className="mt-1 flex items-center justify-between gap-4 border-t border-white/5 pt-1 text-zinc-500">
                      <span>Trade size</span>
                      <span className="tabular-nums">
                        {formatVibe(p.volume)} VIBE
                      </span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="yesPct"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#yesGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Picks a tick label format based on the visible time range:
 *   < 1 day:   HH:mm
 *   < 14 days: MMM d
 *   else:      MMM d, yyyy
 */
function formatTick(value: number, first: number, last: number): string {
  const spanMs = last - first;
  const oneDay = 86_400_000;
  const fourteenDays = 14 * oneDay;
  const d = new Date(value);
  if (spanMs < oneDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (spanMs < fourteenDays) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoricalPricePoint } from "@/lib/categorical";
import { formatOutcomeProbability } from "@/lib/lmsr";
import { formatVibe } from "@/lib/utils";

const LINE_COLORS = [
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#fbbf24",
  "#fb7185",
  "#4ade80",
  "#c084fc",
];

interface CategoricalPriceChartProps {
  points: CategoricalPricePoint[];
  labels: string[];
  height?: number;
}

export function CategoricalPriceChart({
  points,
  labels,
  height = 240,
}: CategoricalPriceChartProps) {
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

  const data = points.map((p) => {
    const row: Record<string, number> = { t: p.t, volume: p.volume };
    p.prices.forEach((price, i) => {
      row[`o${i}`] = price * 100;
    });
    return row;
  });

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v: number) =>
              formatTick(v, data[0]!.t, data[data.length - 1]!.t)
            }
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
              const p = payload[0]?.payload as Record<string, number>;
              return (
                <div className="rounded-md border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg">
                  <div className="text-zinc-400">
                    {new Date(p.t).toLocaleString()}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {labels.map((label, i) => (
                      <li
                        key={label}
                        className="flex items-center justify-between gap-4"
                      >
                        <span style={{ color: LINE_COLORS[i % LINE_COLORS.length] }}>
                          {label}
                        </span>
                        <span className="tabular-nums text-zinc-100">
                          {formatOutcomeProbability((p[`o${i}`] ?? 0) / 100)}
                        </span>
                      </li>
                    ))}
                  </ul>
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
          {labels.map((label, i) => (
            <Line
              key={label}
              type="monotone"
              dataKey={`o${i}`}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
        {labels.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

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

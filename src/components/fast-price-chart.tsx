"use client";

import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsdPrice } from "@/lib/utils";

interface FastPriceChartProps {
  asset: string;
  strikePrice: number;
  windowStartMs: number;
  height?: number;
}

interface TickPoint {
  t: number;
  price: number;
}

export function FastPriceChart({
  asset,
  strikePrice,
  windowStartMs,
  height = 220,
}: FastPriceChartProps) {
  const [points, setPoints] = useState<TickPoint[]>([]);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/fast/prices?asset=${encodeURIComponent(asset)}&since=${windowStartMs}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          ticks?: TickPoint[];
          current?: number;
        };
        if (cancelled) return;
        setPoints(json.ticks ?? []);
        if (json.current) setCurrent(json.current);
      } catch {
        /* ignore */
      }
    }

    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [asset, windowStartMs]);

  const data =
    points.length > 0
      ? points
      : current
        ? [{ t: Date.now(), price: current }]
        : [];

  if (data.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-white/10 text-xs text-zinc-500"
        style={{ height }}
      >
        Loading live price…
      </div>
    );
  }

  const up = (current ?? data[data.length - 1].price) >= strikePrice;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v: number) =>
              new Date(v).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            }
            tick={{ fontSize: 10, fill: "#71717a" }}
            stroke="#27272a"
            tickLine={false}
            minTickGap={50}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatUsdPrice(v)}
            tick={{ fontSize: 10, fill: "#71717a" }}
            stroke="#27272a"
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) =>
              new Date(Number(v)).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            }
            formatter={(value) => [formatUsdPrice(Number(value)), "Price"]}
          />
          <ReferenceLine
            y={strikePrice}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{
              value: `Strike ${formatUsdPrice(strikePrice)}`,
              fill: "#fbbf24",
              fontSize: 10,
              position: "insideTopRight",
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={up ? "#10b981" : "#f97316"}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

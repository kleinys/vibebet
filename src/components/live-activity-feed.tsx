"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatVibe } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/activity-feed";

export function LiveActivityFeed({
  initial,
  pollMs = 15000,
}: {
  initial: ActivityFeedItem[];
  pollMs?: number;
}) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/activity/feed", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ActivityFeedItem[];
        setItems(data);
      } catch {
        // ignore poll errors
      }
    }

    const id = setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  if (items.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No live trades yet. Place a bet to kick off the feed.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-xs"
        >
          <span className="font-medium text-zinc-200">
            {item.display_name ?? "Someone"}
          </span>{" "}
          <span className="text-zinc-500">bet</span>{" "}
          <span className="tabular-nums text-amber-200">
            {formatVibe(item.amount)} VIBE
          </span>{" "}
          <span className="text-zinc-500">on</span>{" "}
          {item.market_id ? (
            <Link
              href={`/markets/${item.market_id}`}
              className="text-fuchsia-300 hover:underline"
            >
              {item.market_question ?? "a market"}
            </Link>
          ) : (
            <span>{item.market_question ?? "a market"}</span>
          )}
          {item.side && (
            <span className="ml-1 text-zinc-500">({item.side.toUpperCase()})</span>
          )}
        </li>
      ))}
    </ul>
  );
}

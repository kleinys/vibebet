"use client";

import { useMemo, useState } from "react";
import { resolveMarketImage } from "@/lib/market-image";

export function MarketCardImage({
  question,
  category,
  imageUrl,
}: {
  question: string;
  category: string;
  imageUrl?: string | null;
}) {
  const primary = useMemo(
    () => resolveMarketImage({ question, category, imageUrl }),
    [question, category, imageUrl],
  );
  const fallback = useMemo(
    () => resolveMarketImage({ question, category, imageUrl: null }),
    [question, category],
  );

  const [src, setSrc] = useState(primary);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-9 w-9 shrink-0 rounded-md border border-white/5 object-cover"
      loading="lazy"
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}

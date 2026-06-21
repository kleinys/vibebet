import type { NewsHeadline } from "@/lib/news";

export function MarketNewsPanel({ headlines }: { headlines: NewsHeadline[] }) {
  if (headlines.length === 0) return null;

  return (
    <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
      <h2 className="text-sm font-semibold text-zinc-200">Related news</h2>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Headlines matched to this market question (via Google News).
      </p>
      <ul className="mt-3 space-y-3">
        {headlines.map((item) => (
          <li key={item.url}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block text-sm leading-snug text-zinc-300 hover:text-white"
            >
              {item.title}
            </a>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {item.source}
              {item.publishedAt && (
                <>
                  {" · "}
                  {new Date(item.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from "next/link";

/** User-facing empty state — never expose admin flag names. */
export function FeatureOffPanel({
  title,
  body = "This section is coming soon.",
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-8 text-center">
      <p className="font-semibold text-zinc-200">{title}</p>
      <p className="mt-2 text-sm text-zinc-500">{body}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="mt-4 inline-flex rounded-md bg-fuchsia-500/20 px-4 py-2 text-sm font-medium text-fuchsia-200 ring-1 ring-fuchsia-500/30 hover:bg-fuchsia-500/30">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

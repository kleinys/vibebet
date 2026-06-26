import Link from "next/link";
import { cn, formatVibe } from "@/lib/utils";

interface BalanceBadgeProps {
  currency: "vibe" | "gem";
  amount: number;
  className?: string;
  /** When set, badge links to the account wallet section. */
  href?: string;
}

const STYLES: Record<
  "vibe" | "gem",
  { ring: string; bg: string; text: string; symbol: string; label: string }
> = {
  vibe: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    symbol: "◉",
    label: "VIBE",
  },
  gem: {
    ring: "ring-fuchsia-500/30",
    bg: "bg-fuchsia-500/10",
    text: "text-fuchsia-300",
    symbol: "◆",
    label: "Gems",
  },
};

export function BalanceBadge({ currency, amount, className, href }: BalanceBadgeProps) {
  const s = STYLES[currency];
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1",
        s.bg,
        s.text,
        s.ring,
        href && "transition hover:brightness-110",
        className,
      )}
      title={href ? `${s.label} balance — open wallet` : `${s.label} balance`}
    >
      <span aria-hidden className="text-base leading-none">
        {s.symbol}
      </span>
      <span className="tabular-nums">{formatVibe(amount)}</span>
      <span className="sr-only">{s.label}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
        {inner}
      </Link>
    );
  }

  return inner;
}

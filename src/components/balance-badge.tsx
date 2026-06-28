import Link from "next/link";
import { cn, formatVibe } from "@/lib/utils";
import { CurrencyIconGem, CurrencyIconVibe } from "@/components/fantasy-icons";

interface BalanceBadgeProps {
  currency: "vibe" | "gem";
  amount: number;
  className?: string;
  href?: string;
}

const STYLES: Record<
  "vibe" | "gem",
  { ring: string; bg: string; text: string; label: string; glow: string }
> = {
  vibe: {
    ring: "ring-amber-400/35",
    bg: "bg-gradient-to-r from-amber-950/80 to-orange-950/60",
    text: "text-amber-200",
    label: "VIBE",
    glow: "shadow-amber-900/30",
  },
  gem: {
    ring: "ring-fuchsia-400/35",
    bg: "bg-gradient-to-r from-fuchsia-950/80 to-violet-950/60",
    text: "text-fuchsia-200",
    label: "Gems",
    glow: "shadow-fuchsia-900/30",
  },
};

export function BalanceBadge({ currency, amount, className, href }: BalanceBadgeProps) {
  const s = STYLES[currency];
  const Icon = currency === "vibe" ? CurrencyIconVibe : CurrencyIconGem;
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 shadow-md",
        s.bg,
        s.text,
        s.ring,
        s.glow,
        href && "transition hover:brightness-125",
        className,
      )}
      title={href ? `${s.label} balance — open wallet` : `${s.label} balance`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="tabular-nums">{formatVibe(amount)}</span>
      <span className="sr-only">{s.label}</span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

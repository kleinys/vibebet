import { cn, formatVibe } from "@/lib/utils";

interface BalanceBadgeProps {
  currency: "vibe" | "gem";
  amount: number;
  className?: string;
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

export function BalanceBadge({ currency, amount, className }: BalanceBadgeProps) {
  const s = STYLES[currency];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1",
        s.bg,
        s.text,
        s.ring,
        className,
      )}
      title={`${s.label} balance`}
    >
      <span aria-hidden className="text-base leading-none">
        {s.symbol}
      </span>
      <span className="tabular-nums">{formatVibe(amount)}</span>
      <span className="sr-only">{s.label}</span>
    </div>
  );
}

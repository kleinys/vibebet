import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVibe(amount: bigint | number): string {
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatUsdPrice(n: number): string {
  if (n >= 1000) {
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `$${n.toFixed(4)}`;
}

export function formatInterval(sec: number): string {
  if (sec < 120) return `${sec}s`;
  if (sec % 60 === 0) return `${sec / 60}m`;
  return `${sec}s`;
}

export function formatCreatorFeeBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

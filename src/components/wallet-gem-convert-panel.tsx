"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { convertGemsToVibe } from "@/app/account/wallet-actions";

const VIBE_PER_GEM = 10;
const MIN_GEMS = 10;
const PRESETS = [10, 50, 100, 500] as const;

export function WalletGemConvertPanel({
  gems,
  conversionEnabled,
}: {
  gems: number;
  conversionEnabled: boolean;
}) {
  const [amount, setAmount] = useState(String(MIN_GEMS));
  const [pending, startTransition] = useTransition();

  const parsed = Number.parseInt(amount, 10);
  const valid = Number.isFinite(parsed) && parsed >= MIN_GEMS && parsed <= gems;
  const vibeOut = valid ? parsed * VIBE_PER_GEM : 0;

  if (!conversionEnabled) {
    return (
      <section className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
        <h2 className="text-sm font-semibold text-sky-100">Convert Gems → VIBE</h2>
        <p className="mt-2 text-sm text-zinc-400">
          One-way conversion from premium Gems into play-money VIBE ({VIBE_PER_GEM} VIBE per Gem).
          Useful if you want more betting balance —{" "}
          <span className="text-zinc-300">not reversible and not cashable</span>.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Coming soon when enabled — one-way only, not cashable. See &quot;What
          we&apos;re planning&quot; below for why VIBE never converts to USD/EUR.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
      <h2 className="text-sm font-semibold text-sky-100">Convert Gems → VIBE</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Rate: 1 Gem = {VIBE_PER_GEM} VIBE · Minimum {MIN_GEMS} Gems · One-way only
      </p>
      <p className="mt-2 text-sm text-zinc-300">
        Balance: {gems.toLocaleString()} Gems
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={gems < n}
            onClick={() => setAmount(String(n))}
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:border-sky-400/40 disabled:opacity-40"
          >
            {n} Gems
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-zinc-500">
          Gems to convert
          <input
            type="number"
            min={MIN_GEMS}
            max={gems}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-32 rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        {valid && (
          <p className="text-sm text-emerald-300">
            → {vibeOut.toLocaleString()} VIBE
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={pending || !valid}
        onClick={() =>
          startTransition(async () => {
            const r = await convertGemsToVibe(parsed);
            if (r.error) toast.error(r.error);
            else toast.success(r.ok ?? "Converted");
          })
        }
        className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
      >
        Convert {valid ? parsed : MIN_GEMS} Gems
      </button>
    </section>
  );
}

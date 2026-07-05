import Link from "next/link";
import { formatVibe } from "@/lib/utils";
import { CurrencyIconVibe } from "@/components/fantasy-icons";
import { orbitModifierSummary } from "@/lib/orbit-affinity";
import { figureLabels, resolveFigureConfig } from "@/lib/companion-figure";
import type { CompanionInput } from "@/lib/vibe-companion";

export function LockerArenaEntry({
  input,
  vibeBalance,
  equippedSkinSlug,
  freeSpinAvailable,
}: {
  input: CompanionInput;
  vibeBalance: number;
  equippedSkinSlug?: string | null;
  freeSpinAvailable: boolean;
}) {
  const config = resolveFigureConfig(input);
  const labels = figureLabels(config);
  const modifier = orbitModifierSummary(equippedSkinSlug ?? config.skinSlug);

  return (
    <section
      id="locker-rewards"
      className="mt-6 scroll-mt-24 overflow-hidden rounded-sm border border-amber-500/25 bg-gradient-to-br from-zinc-950 via-[#0a0f1e] to-violet-950/40 ring-1 ring-amber-500/15"
    >
      <div className="border-b border-white/5 bg-gradient-to-r from-amber-950/30 via-transparent to-violet-950/30 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/80">
              VIBE arena
            </p>
            <h3 className="mt-1 text-xl font-bold text-zinc-100 sm:text-2xl">
              Stake · spin · win
            </h3>
            <p className="mt-2 max-w-lg text-sm text-zinc-400">
              Your equipped trainer shifts case odds and wheel segments. Enter the arena for
              the full VIBE case and daily wheel.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-sm border border-amber-500/35 bg-amber-950/50 px-4 py-2.5">
            <CurrencyIconVibe className="h-5 w-5" />
            <span className="text-lg font-bold tabular-nums text-amber-100">
              {formatVibe(vibeBalance)}
            </span>
            <span className="text-xs text-amber-300/80">VIBE</span>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
        <div className="border-b border-white/5 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="rounded-sm border border-white/10 bg-zinc-950/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Loadout
              </span>
              {modifier && (
                <span className="rounded-sm border border-violet-400/30 bg-violet-950/40 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                  {modifier.affinity.icon} {modifier.affinity.shortLabel}
                </span>
              )}
            </div>
            <p className="mt-2 text-lg font-semibold text-zinc-100">{labels.humanTitle}</p>
            <p className="text-sm text-orange-300">{labels.animalTitle}</p>
            {modifier && (
              <p className="mt-3 text-xs text-zinc-500">
                Orbit: {modifier.morphLabel} — {modifier.affinity.crateEffect}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
              <span className="rounded-sm border border-amber-500/25 bg-amber-950/30 px-2 py-1">
                VIBE case · 100–1,000 stake
              </span>
              <span className="rounded-sm border border-violet-500/25 bg-violet-950/30 px-2 py-1">
                Wheel · {freeSpinAvailable ? "free spin ready" : "100 VIBE / spin"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch justify-center gap-3 p-5 sm:p-6">
          <Link
            href="/account/profile/arena"
            className="hypnotic-cta hypnotic-cta--magnet inline-flex items-center justify-center rounded-sm bg-gradient-to-r from-amber-500 via-orange-500 to-fuchsia-600 px-8 py-4 text-center text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-900/40 transition hover:brightness-110 sm:text-base"
          >
            Enter VIBE arena
          </Link>
          <Link
            href="/account/profile/arena#vibe-case"
            className="text-center text-xs text-zinc-500 hover:text-zinc-300"
          >
            Or jump straight to case &amp; wheel →
          </Link>
        </div>
      </div>
    </section>
  );
}

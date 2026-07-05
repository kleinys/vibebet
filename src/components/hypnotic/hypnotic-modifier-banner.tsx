import { orbitModifierSummary } from "@/lib/orbit-affinity";
import { trinityBySkin } from "@/lib/trinity-buffs";

export function HypnoticModifierBanner({
  equippedSkinSlug,
}: {
  equippedSkinSlug?: string | null;
}) {
  const modifier = orbitModifierSummary(equippedSkinSlug ?? null);
  if (!modifier) return null;

  const theme = trinityBySkin(equippedSkinSlug ?? "");
  const { affinity, morphLabel, synergy } = modifier;

  return (
    <section
      className={`mx-4 mt-3 rounded-xl border bg-gradient-to-br p-4 ring-1 ${affinity.caseTheme} border-white/10 ring-white/5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Trainer affinity
          </p>
          <p className="mt-1 flex items-center gap-2 text-base font-semibold text-zinc-50">
            <span className="text-xl" aria-hidden>
              {affinity.icon}
            </span>
            {morphLabel}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{affinity.label}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-200">
          {affinity.shortLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            VIBE case
          </p>
          <p className="mt-1 text-sm leading-snug text-zinc-200">{affinity.crateEffect}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Daily wheel
          </p>
          <p className="mt-1 text-sm leading-snug text-zinc-200">{affinity.wheelEffect}</p>
        </div>
      </div>

      {synergy && (
        <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          <span className="font-semibold">{synergy.label}:</span> {synergy.effect}
        </p>
      )}

      {theme && (
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Every trainer has a case + wheel affinity. Complete the full trinity (trainer, animal,
          phenomenon) at rank 7+ in the shop for an extra{" "}
          <span className="text-zinc-400">{theme.buffLabel}</span> bonus — yours is rank{" "}
          {theme.rank} ({theme.trinityBuffPercent > 0 ? `+${theme.trinityBuffPercent}%` : "base only"}).
        </p>
      )}
    </section>
  );
}

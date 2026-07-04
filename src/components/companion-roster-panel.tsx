import { COMPANION_ROSTER } from "@/lib/companion-roster";
import { phenomenonImagePath } from "@/lib/phenomenon-art";
import { orbitAffinityForMorph } from "@/lib/orbit-affinity";

export function CompanionRosterPanel({
  activeSkinSlug,
}: {
  activeSkinSlug?: string | null;
}) {
  return (
    <section className="mt-6 rounded-sm border border-white/10 bg-zinc-950/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
        Trainer & spirit roster
      </h3>
      <p className="mt-1 text-[11px] text-zinc-500">
        Each skin pairs one trainer with a unique spirit animal. On orbit behind you, the animal
        morphs into its own phenomenon — all 13 are different.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {COMPANION_ROSTER.map((entry) => {
          const active = entry.skinSlug === activeSkinSlug;
          const affinity = orbitAffinityForMorph(entry.morph);
          return (
            <div
              key={entry.skinSlug}
              className={`flex gap-3 rounded-sm border p-3 ${
                active
                  ? "border-fuchsia-400/40 bg-fuchsia-500/10"
                  : "border-white/10 bg-zinc-900/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phenomenonImagePath(entry.morph)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-sm border border-white/10 bg-zinc-950 object-cover"
              />
              <div className="min-w-0 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <span className="font-semibold text-zinc-100">{entry.trainerName}</span>
                  {active && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
                      Equipped
                    </span>
                  )}
                </div>
                <p className="mt-1 text-zinc-400">
                  <span className="text-orange-300">{entry.animalName}</span>
                  {" → "}
                  <span className="text-violet-300">{entry.elementLabel}</span>
                  {" · "}
                  <span className="text-amber-200/90">
                    {affinity.icon} {affinity.shortLabel}
                  </span>
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">{entry.elementDescription}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

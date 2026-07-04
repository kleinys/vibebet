import { COMPANION_ROSTER, MORPH_PHENOMENA } from "@/lib/companion-roster";
import { SPIRIT_MORPH_LABELS } from "@/lib/companion-motion";

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
        Equip a skin in the locker pills above — each pairs a trainer theme with one spirit animal.
        When the animal orbits behind you it morphs into an elemental phenomenon.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {COMPANION_ROSTER.map((entry) => {
          const active = entry.skinSlug === activeSkinSlug;
          return (
            <div
              key={entry.skinSlug}
              className={`rounded-sm border px-3 py-2 text-xs ${
                active
                  ? "border-fuchsia-400/40 bg-fuchsia-500/10"
                  : "border-white/10 bg-zinc-900/40"
              }`}
            >
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
                {" · morphs into "}
                <span className="text-violet-300">{entry.elementLabel}</span>
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">
                {entry.theme} — {entry.trait}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/5 pt-4">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Orbit phenomena (all morph types)
        </h4>
        <ul className="mt-2 space-y-2">
          {MORPH_PHENOMENA.map((m) => (
            <li key={m.morph} className="text-[11px] text-zinc-400">
              <span className="font-medium text-violet-200">{m.label}</span>
              {" — "}
              {m.description}
              <span className="text-zinc-500">
                {" "}
                ({m.animals.map((a) => a.replace(/^./, (c) => c.toUpperCase())).join(", ")})
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-zinc-600">
          Labels: {Object.values(SPIRIT_MORPH_LABELS).join(" · ")}
        </p>
      </div>
    </section>
  );
}

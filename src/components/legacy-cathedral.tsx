import type { LegacyCathedral } from "@/lib/legacy-cathedral";

const WING_OFFSETS = [-3, -2, -1, 0, 1, 2, 3, 4];

export function LegacyCathedralView({
  cathedral,
  compact = false,
}: {
  cathedral: LegacyCathedral;
  compact?: boolean;
}) {
  const wings = cathedral.elements.filter((e) => e.done);

  return (
    <div
      className={`legacy-cathedral ${compact ? "legacy-cathedral--compact" : ""}`}
    >
      <div className="legacy-cathedral__sky" aria-hidden />
      <div className="legacy-cathedral__base">
        <div className="legacy-cathedral__foundation" />
        {wings.map((wing, i) => (
          <div
            key={wing.id}
            className="legacy-cathedral__wing"
            style={{ "--wing-i": WING_OFFSETS[i] ?? i } as React.CSSProperties}
            title={wing.label}
          />
        ))}
        {cathedral.percent >= 100 && (
          <div className="legacy-cathedral__crown" aria-hidden />
        )}
      </div>
      <div className="legacy-cathedral__meta">
        <p className="text-xs font-semibold text-violet-200">
          Legacy Cathedral · {cathedral.percent}%
        </p>
        {!compact && (
          <p className="mt-1 text-[11px] text-zinc-500">
            {cathedral.wings} of {cathedral.maxWings} wings — every mode you play
            adds stone.
          </p>
        )}
        <ul className="mt-2 flex flex-wrap gap-1">
          {cathedral.elements.map((el) => (
            <li
              key={el.id}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
                el.done
                  ? "bg-violet-500/20 text-violet-200"
                  : "bg-zinc-800 text-zinc-600"
              }`}
            >
              {el.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

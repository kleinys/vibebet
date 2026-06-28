import type { AnimalKind, FigureConfig, HumanArchetype } from "@/lib/companion-figure";

function AnimalSvg({
  kind,
  palette,
  scale = 1,
  x = 0,
  y = 0,
}: {
  kind: AnimalKind;
  palette: FigureConfig["palette"];
  scale?: number;
  x?: number;
  y?: number;
}) {
  const s = scale;
  const fill = palette.animal;
  const dark = palette.animalDark;

  if (kind === "fox") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="36" cy="58" rx="22" ry="16" fill={fill} />
        <path d="M52 52 Q68 48 72 38 Q66 44 58 46" fill={dark} opacity="0.85" />
        <circle cx="36" cy="38" r="14" fill={fill} />
        <polygon points="26,28 22,18 30,26" fill={dark} />
        <polygon points="46,28 50,18 42,26" fill={dark} />
        <circle cx="31" cy="37" r="2.5" fill="#1a1a2e" />
        <circle cx="41" cy="37" r="2.5" fill="#1a1a2e" />
        <ellipse cx="36" cy="42" rx="3" ry="2" fill={dark} opacity="0.5" />
      </g>
    );
  }

  if (kind === "cat") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="36" cy="58" rx="20" ry="15" fill={fill} />
        <path d="M54 54 Q66 60 64 70" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="36" cy="38" r="13" fill={fill} />
        <polygon points="25,30 22,20 31,27" fill={dark} />
        <polygon points="47,30 50,20 41,27" fill={dark} />
        <circle cx="31" cy="37" r="2.5" fill="#1a1a2e" />
        <circle cx="41" cy="37" r="2.5" fill="#1a1a2e" />
        <path d="M33 42 Q36 44 39 42" stroke={dark} strokeWidth="1.5" fill="none" />
      </g>
    );
  }

  if (kind === "owl") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="36" cy="56" rx="24" ry="20" fill={fill} />
        <circle cx="36" cy="38" r="16" fill={fill} />
        <polygon points="20,34 14,28 22,32" fill={dark} />
        <polygon points="52,34 58,28 50,32" fill={dark} />
        <circle cx="36" cy="38" r="10" fill="#fef3c7" opacity="0.9" />
        <circle cx="31" cy="38" r="4" fill="#1a1a2e" />
        <circle cx="41" cy="38" r="4" fill="#1a1a2e" />
        <polygon points="36,44 33,48 39,48" fill={dark} />
      </g>
    );
  }

  if (kind === "wolf") {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <ellipse cx="36" cy="58" rx="23" ry="16" fill={fill} />
        <circle cx="36" cy="36" r="14" fill={fill} />
        <polygon points="24,26 20,14 30,24" fill={dark} />
        <polygon points="48,26 52,14 42,24" fill={dark} />
        <ellipse cx="36" cy="40" rx="5" ry="4" fill="#cbd5e1" opacity="0.35" />
        <circle cx="31" cy="35" r="2.5" fill="#fef08a" />
        <circle cx="41" cy="35" r="2.5" fill="#fef08a" />
        <circle cx="31" cy="35" r="1.2" fill="#1a1a2e" />
        <circle cx="41" cy="35" r="1.2" fill="#1a1a2e" />
      </g>
    );
  }

  // dragon
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="36" cy="58" rx="24" ry="17" fill={fill} />
      <ellipse cx="36" cy="36" rx="15" ry="14" fill={fill} />
      <polygon points="22,28 18,16 28,24" fill={dark} />
      <polygon points="50,28 54,16 44,24" fill={dark} />
      <path d="M14 48 Q4 38 8 28 Q16 36 18 44" fill={dark} opacity="0.7" />
      <path d="M58 48 Q68 38 64 28 Q56 36 54 44" fill={dark} opacity="0.7" />
      <circle cx="31" cy="35" r="2.5" fill="#fef08a" />
      <circle cx="41" cy="35" r="2.5" fill="#fef08a" />
      <path d="M30 42 Q36 46 42 42" stroke={dark} strokeWidth="2" fill="none" />
    </g>
  );
}

function HumanSvg({
  archetype,
  palette,
  scale = 1,
  x = 0,
  y = 0,
  badge,
}: {
  archetype: HumanArchetype;
  palette: FigureConfig["palette"];
  scale?: number;
  x?: number;
  y?: number;
  badge: FigureConfig["badge"];
}) {
  const s = scale;

  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* legs */}
      <rect x="30" y="72" width="7" height="18" rx="3" fill={palette.outfitDark} />
      <rect x="39" y="72" width="7" height="18" rx="3" fill={palette.outfitDark} />

      {/* robe / armor body */}
      {archetype === "knight" ? (
        <path
          d="M22 48 L36 42 L50 48 L48 78 L24 78 Z"
          fill={palette.outfit}
          stroke={palette.accent}
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M20 48 Q36 38 52 48 L50 80 L22 80 Z"
          fill={palette.outfit}
        />
      )}

      {/* arms */}
      <rect x="14" y="50" width="8" height="22" rx="4" fill={palette.outfitDark} />
      <rect x="50" y="50" width="8" height="22" rx="4" fill={palette.outfitDark} />
      <circle cx="18" cy="74" r="4" fill={palette.skin} />
      <circle cx="54" cy="74" r="4" fill={palette.skin} />

      {/* head */}
      <circle cx="36" cy="32" r="13" fill={palette.skin} />
      <path
        d="M24 28 Q36 18 48 28 Q36 22 24 28"
        fill={palette.hair}
      />

      {archetype === "void" && (
        <path d="M24 26 Q36 20 48 26 L46 38 Q36 34 26 38 Z" fill="#1e1b4b" opacity="0.85" />
      )}

      {archetype === "seer" && (
        <>
          <rect x="24" y="30" width="24" height="5" rx="2" fill={palette.accent} opacity="0.9" />
          <rect x="28" y="31" width="6" height="3" rx="1" fill="#0f172a" />
          <rect x="38" y="31" width="6" height="3" rx="1" fill="#0f172a" />
        </>
      )}

      {archetype === "oracle" && (
        <path d="M22 24 Q36 10 50 24 L48 30 Q36 18 24 30 Z" fill={palette.outfitDark} opacity="0.9" />
      )}

      {archetype === "cosmic" && (
        <>
          {[0, 72, 144, 216, 288].map((deg) => (
            <circle
              key={deg}
              cx={36 + Math.cos((deg * Math.PI) / 180) * 14}
              cy={18 + Math.sin((deg * Math.PI) / 180) * 6}
              r="1.5"
              fill={palette.accent}
            />
          ))}
        </>
      )}

      {archetype === "knight" && (
        <>
          <rect x="18" y="46" width="10" height="8" rx="2" fill={palette.accent} opacity="0.8" />
          <rect x="44" y="46" width="10" height="8" rx="2" fill={palette.accent} opacity="0.8" />
        </>
      )}

      {/* face */}
      {archetype !== "void" && (
        <>
          <circle cx="31" cy="32" r="1.8" fill="#1a1a2e" />
          <circle cx="41" cy="32" r="1.8" fill="#1a1a2e" />
          <path d="M33 37 Q36 39 39 37" stroke="#1a1a2e" strokeWidth="1.2" fill="none" />
        </>
      )}

      {badge === "crown" && (
        <path
          d="M28 16 L31 10 L36 14 L41 10 L44 16 Z"
          fill="#fbbf24"
          stroke="#b45309"
          strokeWidth="0.8"
        />
      )}
      {badge === "verified" && (
        <circle cx="48" cy="22" r="6" fill="#0ea5e9" stroke="#fff" strokeWidth="1" />
      )}
    </g>
  );
}

export function CompanionFigure({
  config,
  size = "md",
  className = "",
}: {
  config: FigureConfig;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dim =
    size === "xl"
      ? "h-44 w-44"
      : size === "lg"
        ? "h-28 w-28"
        : size === "md"
          ? "h-12 w-12"
          : "h-9 w-9";

  const { companion, animal, human, showHuman, palette, animalScale, humanScale, badge, hasShield } =
    config;

  const animalX = showHuman ? 4 : 14;
  const animalY = showHuman ? 52 : 18;
  const humanX = showHuman ? 52 : 0;
  const humanY = showHuman ? 8 : 0;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${dim} ${className}`}
    >
      <svg
        viewBox="0 0 120 100"
        className="h-full w-full drop-shadow-lg"
        aria-hidden
      >
        <defs>
          <radialGradient id={`aura-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.aura} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.aura} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="88" rx="42" ry="8" fill="#000" opacity="0.25" />
        <circle cx="60" cy="50" r="46" fill={`url(#aura-${size})`} />

        {companion.stage <= 2 && (
          <ellipse cx="60" cy="78" rx="28" ry="10" fill="#27272a" opacity="0.6" />
        )}

        <AnimalSvg
          kind={animal}
          palette={palette}
          scale={animalScale * (showHuman ? 0.82 : 1.15)}
          x={animalX}
          y={animalY}
        />

        {showHuman && (
          <HumanSvg
            archetype={human}
            palette={palette}
            scale={humanScale}
            x={humanX}
            y={humanY}
            badge={badge}
          />
        )}

        {hasShield && size !== "sm" && (
          <g transform="translate(8 8)">
            <circle cx="10" cy="10" r="10" fill="#059669" stroke="#ecfdf5" strokeWidth="1.5" />
            <path
              d="M10 4 L10 14 M6 8 L10 4 L14 8"
              stroke="#ecfdf5"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}

        {badge === "verified" && size !== "sm" && showHuman && (
          <text x="94" y="24" fill="#fff" fontSize="8" fontWeight="bold">
            ✓
          </text>
        )}
      </svg>
    </div>
  );
}

export function CompanionFigureScene({
  config,
  labels,
}: {
  config: FigureConfig;
  labels?: { humanTitle: string; animalTitle: string };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-4 shadow-inner shadow-fuchsia-900/20">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at 50% 80%, ${config.palette.aura}55 0%, transparent 65%)`,
        }}
      />
      <div className="relative flex flex-col items-center">
        <CompanionFigure config={config} size="xl" />
        {labels && (
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-center">
            {config.showHuman && (
              <span className="rounded-full bg-fuchsia-600/20 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fuchsia-200">
                {labels.humanTitle}
              </span>
            )}
            <span className="rounded-full bg-orange-600/20 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-orange-200">
              {labels.animalTitle}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import type { AnimalKind, FigureConfig, HumanArchetype } from "@/lib/companion-figure";
import { animalImagePath, humanImagePath } from "@/lib/character-art";

function GlowEyes({
  y,
  leftX,
  rightX,
  glow,
}: {
  y: number;
  leftX: number;
  rightX: number;
  glow: string;
}) {
  return (
    <>
      <circle cx={leftX} cy={y} r="5" fill={glow} opacity="0.35" />
      <circle cx={rightX} cy={y} r="5" fill={glow} opacity="0.35" />
      <circle cx={leftX} cy={y} r="3.2" fill="#fef9c3" />
      <circle cx={rightX} cy={y} r="3.2" fill="#fef9c3" />
      <circle cx={leftX} cy={y} r="1.6" fill="#020617" />
      <circle cx={rightX} cy={y} r="1.6" fill="#020617" />
      <circle cx={leftX - 0.8} cy={y - 0.8} r="0.7" fill="#fff" opacity="0.9" />
      <circle cx={rightX - 0.8} cy={y - 0.8} r="0.7" fill="#fff" opacity="0.9" />
    </>
  );
}

function CharacterImageSprite({
  href,
  w = 72,
  h = 80,
}: {
  href: string;
  w?: number;
  h?: number;
}) {
  return (
    <g filter="url(#sprite-glow)">
      <image
        href={href}
        x={(72 - w) / 2}
        y={(80 - h) / 2}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
}

function OwlSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <rect x="14" y="68" width="44" height="3" rx="1.5" fill="#1e293b" />
      <path d="M14 71 Q36 74 58 71" stroke="#334155" strokeWidth="1" fill="none" />
      <path d="M12 50 Q6 58 8 66 Q16 60 20 52" fill={dark} stroke={fill} strokeWidth="0.5" />
      <path d="M60 50 Q66 58 64 66 Q56 60 52 52" fill={dark} stroke={fill} strokeWidth="0.5" />
      <path d="M36 62 L26 80 L36 73 L46 80 Z" fill={dark} opacity="0.9" />
      <ellipse cx="36" cy="54" rx="18" ry="20" fill={fill} />
      <path d="M28 48 Q36 62 44 48" fill={dark} opacity="0.18" />
      <ellipse cx="36" cy="38" rx="15" ry="14" fill={fill} />
      <ellipse cx="36" cy="39" rx="11" ry="10" fill="#e2e8f0" opacity="0.25" />
      <path d="M24 26 L21 12 L30 24 Z" fill={dark} />
      <path d="M48 26 L51 12 L42 24 Z" fill={dark} />
      <path d="M25 24 L27 15 L29 23 Z" fill={fill} opacity="0.55" />
      <path d="M47 24 L45 15 L43 23 Z" fill={fill} opacity="0.55" />
      <path d="M26 34 Q31 30 36 32" stroke={dark} strokeWidth="1.3" fill="none" />
      <path d="M46 34 Q41 30 36 32" stroke={dark} strokeWidth="1.3" fill="none" />
      <GlowEyes y={38} leftX={31} rightX={41} glow={accent} />
      <path d="M36 42 L33 46 L39 46 Z" fill="#f59e0b" />
      <path d="M30 52 Q36 58 42 52" stroke={dark} strokeWidth="0.7" fill="none" opacity="0.35" />
      <path
        d="M29 66 L27 72 M32 66 L32 72 M36 66 L36 72 M40 66 L40 72 M43 66 L45 72"
        stroke="#f8fafc"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  );
}

function FoxSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <ellipse cx="22" cy="68" rx="4" ry="3" fill={dark} />
      <ellipse cx="50" cy="68" rx="4" ry="3" fill={dark} />
      <path d="M28 62 L24 70 M44 62 L48 70" stroke={dark} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="36" cy="56" rx="16" ry="13" fill={fill} />
      <ellipse cx="36" cy="58" rx="10" ry="7" fill="#fef3c7" opacity="0.55" />
      <path
        d="M48 52 Q58 46 66 38 Q70 32 68 28 Q62 38 54 46 Q50 54 46 58 Z"
        fill={dark}
      />
      <path
        d="M50 50 Q58 44 64 36"
        stroke={accent}
        strokeWidth="1"
        fill="none"
        opacity="0.55"
      />
      <path d="M52 54 Q60 50 64 44" stroke={fill} strokeWidth="0.8" fill="none" opacity="0.4" />
      <ellipse cx="36" cy="36" rx="13" ry="12" fill={fill} />
      <ellipse cx="36" cy="40" rx="7" ry="5.5" fill="#fef3c7" opacity="0.9" />
      <path d="M24 28 L19 14 L30 26 Z" fill={dark} />
      <path d="M48 28 L53 14 L42 26 Z" fill={dark} />
      <path d="M25 26 L22 18 L28 25 Z" fill="#fca5a5" opacity="0.65" />
      <path d="M47 26 L50 18 L44 25 Z" fill="#fca5a5" opacity="0.65" />
      <GlowEyes y={35} leftX={31} rightX={41} glow={accent} />
      <ellipse cx="36" cy="42" rx="2.5" ry="1.8" fill="#020617" />
      <path d="M36 43 L36 45" stroke="#020617" strokeWidth="0.8" />
    </g>
  );
}

function CatSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <ellipse cx="24" cy="70" rx="3.5" ry="2.5" fill={dark} />
      <ellipse cx="48" cy="70" rx="3.5" ry="2.5" fill={dark} />
      <ellipse cx="36" cy="57" rx="15" ry="12" fill={fill} />
      <path
        d="M52 54 Q62 52 66 44 Q68 38 64 34"
        stroke={dark}
        strokeWidth="5.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="64" cy="33" r="3" fill={fill} stroke={dark} strokeWidth="1" />
      <ellipse cx="36" cy="37" rx="12" ry="11" fill={fill} />
      <path d="M25 30 L21 16 L31 28 Z" fill={dark} />
      <path d="M47 30 L51 16 L41 28 Z" fill={dark} />
      <path d="M26 28 L24 20 L29 27 Z" fill={accent} opacity="0.35" />
      <path d="M46 28 L48 20 L43 27 Z" fill={accent} opacity="0.35" />
      <GlowEyes y={36} leftX={31} rightX={41} glow={accent} />
      <path d="M34 41 L36 43 L38 41" stroke="#020617" strokeWidth="1" fill="none" />
      <line x1="26" y1="40" x2="18" y2="37" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.65" />
      <line x1="26" y1="43" x2="18" y2="43" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.65" />
      <line x1="46" y1="40" x2="54" y2="37" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.65" />
      <line x1="46" y1="43" x2="54" y2="43" stroke="#cbd5e1" strokeWidth="0.7" opacity="0.65" />
      <ellipse cx="36" cy="52" rx="6" ry="4" fill={dark} opacity="0.15" />
    </g>
  );
}

function WolfSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <path
        d="M54 58 Q62 62 60 72 Q58 76 52 74"
        stroke={dark}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="24" cy="70" rx="4" ry="3" fill={dark} />
      <ellipse cx="46" cy="70" rx="4" ry="3" fill={dark} />
      <ellipse cx="36" cy="57" rx="17" ry="13" fill={fill} />
      <path d="M28 50 Q36 58 44 50" fill={dark} opacity="0.2" />
      <ellipse cx="36" cy="35" rx="13" ry="12" fill={fill} />
      <ellipse cx="36" cy="40" rx="9" ry="7" fill="#cbd5e1" opacity="0.4" />
      <ellipse cx="36" cy="43" rx="5.5" ry="4" fill="#94a3b8" opacity="0.45" />
      <path d="M23 27 L17 10 L29 24 Z" fill={dark} />
      <path d="M49 27 L55 10 L43 24 Z" fill={dark} />
      <GlowEyes y={34} leftX={31} rightX={41} glow={accent} />
      <ellipse cx="36" cy="44" rx="2.2" ry="1.6" fill="#020617" />
    </g>
  );
}

function StagSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <ellipse cx="22" cy="70" rx="3" ry="2.5" fill={dark} />
      <ellipse cx="50" cy="70" rx="3" ry="2.5" fill={dark} />
      <ellipse cx="36" cy="58" rx="14" ry="12" fill={fill} />
      <ellipse cx="36" cy="38" rx="10" ry="9" fill={fill} />
      <path d="M28 30 L24 12 L32 28 Z" fill={dark} />
      <path d="M44 30 L48 12 L40 28 Z" fill={dark} />
      <path d="M30 28 L28 18 L34 26 Z" fill={accent} opacity="0.45" />
      <path d="M42 28 L44 18 L38 26 Z" fill={accent} opacity="0.45" />
      <path d="M29 26 L26 16 M33 26 L31 14" stroke={accent} strokeWidth="0.8" opacity="0.5" />
      <path d="M43 26 L46 16 M39 26 L41 14" stroke={accent} strokeWidth="0.8" opacity="0.5" />
      <GlowEyes y={37} leftX={32} rightX={40} glow={accent} />
      <path d="M32 44 L36 48 L40 44" stroke={dark} strokeWidth="0.8" fill="none" opacity="0.35" />
    </g>
  );
}

function PhoenixSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <path
        d="M36 62 Q28 72 20 78 Q30 70 34 64"
        stroke={dark}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M36 62 Q44 72 52 78 Q42 70 38 64"
        stroke={dark}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M8 50 Q2 38 8 26 Q16 36 20 46 Z" fill={dark} opacity="0.85" />
      <path d="M64 50 Q70 38 64 26 Q56 36 52 46 Z" fill={dark} opacity="0.85" />
      <path d="M10 44 Q6 34 10 28" stroke={accent} strokeWidth="0.9" fill="none" opacity="0.6" />
      <path d="M62 44 Q66 34 62 28" stroke={accent} strokeWidth="0.9" fill="none" opacity="0.6" />
      <ellipse cx="36" cy="52" rx="12" ry="10" fill={fill} />
      <ellipse cx="36" cy="36" rx="11" ry="10" fill={fill} />
      <path d="M34 40 L36 44 L38 40" fill="#f59e0b" />
      <GlowEyes y={35} leftX={32} rightX={40} glow={accent} />
      <path d="M30 48 Q36 54 42 48" stroke={accent} strokeWidth="0.7" fill="none" opacity="0.5" />
    </g>
  );
}

function RavenSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <path d="M10 44 Q4 36 8 28 Q14 34 18 42 Z" fill={dark} opacity="0.88" />
      <path d="M62 44 Q68 36 64 28 Q58 34 54 42 Z" fill={dark} opacity="0.88" />
      <ellipse cx="36" cy="54" rx="13" ry="11" fill={fill} />
      <ellipse cx="36" cy="36" rx="11" ry="10" fill={fill} />
      <path d="M36 40 L34 44 L38 44 Z" fill="#1e293b" />
      <path d="M28 30 L24 22 L30 28" stroke={accent} strokeWidth="0.8" opacity="0.6" />
      <path d="M44 30 L48 22 L42 28" stroke={accent} strokeWidth="0.8" opacity="0.6" />
      <GlowEyes y={35} leftX={32} rightX={40} glow={accent} />
      {/* left foot — 4 talons */}
      <path
        d="M24 68 L22 73 M26 68 L26 73 M28 68 L28 73 M30 68 L30 73"
        stroke="#f8fafc"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* right foot — 4 talons */}
      <path
        d="M42 68 L42 73 M44 68 L44 73 M46 68 L46 73 M48 68 L48 73"
        stroke="#f8fafc"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M48 56 Q58 60 62 68" stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  );
}

function DragonSprite({ fill, dark, accent }: { fill: string; dark: string; accent: string }) {
  return (
    <g filter="url(#sprite-glow)">
      <path
        d="M56 58 Q68 54 72 44 Q74 36 68 32 Q64 42 58 50 Q54 56 50 58"
        stroke={dark}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M66 34 L70 28 L68 36 Z" fill={accent} opacity="0.7" />
      <ellipse cx="36" cy="57" rx="18" ry="14" fill={fill} />
      <ellipse cx="36" cy="35" rx="14" ry="13" fill={fill} />
      <path d="M24 26 L19 10 L29 22 Z" fill={dark} />
      <path d="M48 26 L53 10 L43 22 Z" fill={dark} />
      <path d="M25 24 L22 14 L28 22 Z" fill={accent} opacity="0.5" />
      <path d="M47 24 L50 14 L44 22 Z" fill={accent} opacity="0.5" />
      <path d="M10 48 Q0 38 4 24 Q12 34 16 44 Z" fill={dark} opacity="0.88" />
      <path d="M62 48 Q72 38 68 24 Q60 34 56 44 Z" fill={dark} opacity="0.88" />
      <path d="M12 40 Q6 32 8 26" stroke={accent} strokeWidth="0.9" fill="none" opacity="0.65" />
      <path d="M60 40 Q66 32 64 26" stroke={accent} strokeWidth="0.9" fill="none" opacity="0.65" />
      <path d="M32 44 Q36 48 40 44" stroke={dark} strokeWidth="1.6" fill="none" />
      <GlowEyes y={34} leftX={31} rightX={41} glow={accent} />
      <path
        d="M36 48 L33 52 M36 50 L33 54 M36 52 L33 58 M36 54 L33 60"
        stroke={accent}
        strokeWidth="0.65"
        opacity="0.45"
      />
      <path d="M40 48 L43 52 M40 50 L43 54" stroke={accent} strokeWidth="0.65" opacity="0.45" />
    </g>
  );
}

export function AnimalSprite({
  kind,
  palette,
  scale = 1,
  x = 0,
  y = 0,
  preferRaster = true,
}: {
  kind: AnimalKind;
  palette: FigureConfig["palette"];
  scale?: number;
  x?: number;
  y?: number;
  /** Use Tier-1 PNG when available (off at sm for crisp tiny avatars) */
  preferRaster?: boolean;
}) {
  const imagePath = preferRaster ? animalImagePath(kind) : null;

  if (imagePath) {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <CharacterImageSprite href={imagePath} />
      </g>
    );
  }

  const props = {
    fill: palette.animal,
    dark: palette.animalDark,
    accent: palette.accent,
  };

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {kind === "owl" && <OwlSprite {...props} />}
      {kind === "fox" && <FoxSprite {...props} />}
      {kind === "cat" && <CatSprite {...props} />}
      {kind === "wolf" && <WolfSprite {...props} />}
      {kind === "dragon" && <DragonSprite {...props} />}
      {kind === "stag" && <StagSprite {...props} />}
      {kind === "phoenix" && <PhoenixSprite {...props} />}
      {kind === "raven" && <RavenSprite {...props} />}
    </g>
  );
}

export function HumanSprite({
  archetype,
  palette,
  scale = 1,
  x = 0,
  y = 0,
  badge,
  skinSlug,
  preferRaster = true,
}: {
  archetype: HumanArchetype;
  palette: FigureConfig["palette"];
  scale?: number;
  x?: number;
  y?: number;
  badge: FigureConfig["badge"];
  skinSlug?: string;
  preferRaster?: boolean;
}) {
  const imagePath = preferRaster ? humanImagePath(archetype, skinSlug) : null;

  if (imagePath) {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <CharacterImageSprite href={imagePath} w={68} h={88} />
        {badge === "crown" && (
          <path
            d="M28 8 L31 2 L36 6 L41 2 L44 8 Z"
            fill="#fbbf24"
            stroke="#b45309"
            strokeWidth="0.8"
          />
        )}
        {badge === "verified" && (
          <circle cx="58" cy="14" r="6" fill="#0ea5e9" stroke="#fff" strokeWidth="1" />
        )}
      </g>
    );
  }

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} filter="url(#sprite-glow)">
      <rect x="30" y="72" width="7" height="18" rx="3" fill={palette.outfitDark} />
      <rect x="39" y="72" width="7" height="18" rx="3" fill={palette.outfitDark} />
      <ellipse cx="33" cy="90" rx="5" ry="2" fill={palette.outfitDark} opacity="0.6" />
      <ellipse cx="42" cy="90" rx="5" ry="2" fill={palette.outfitDark} opacity="0.6" />

      {archetype === "knight" ? (
        <path
          d="M22 48 L36 42 L50 48 L48 78 L24 78 Z"
          fill={palette.outfit}
          stroke={palette.accent}
          strokeWidth="1.5"
        />
      ) : (
        <path d="M20 48 Q36 38 52 48 L50 80 L22 80 Z" fill={palette.outfit} />
      )}

      <rect x="14" y="50" width="8" height="22" rx="4" fill={palette.outfitDark} />
      <rect x="50" y="50" width="8" height="22" rx="4" fill={palette.outfitDark} />
      <circle cx="18" cy="74" r="4" fill={palette.skin} />
      <circle cx="54" cy="74" r="4" fill={palette.skin} />

      <circle cx="36" cy="32" r="13" fill={palette.skin} />
      <ellipse cx="32" cy="28" rx="4" ry="3" fill="#fff" opacity="0.12" />
      <path d="M24 28 Q36 18 48 28 Q36 22 24 28" fill={palette.hair} />

      {archetype === "void" && (
        <path d="M24 26 Q36 20 48 26 L46 38 Q36 34 26 38 Z" fill="#1e1b4b" opacity="0.9" />
      )}
      {archetype === "seer" && (
        <>
          <rect x="24" y="30" width="24" height="5" rx="2" fill={palette.accent} opacity="0.95" />
          <rect x="28" y="31" width="6" height="3" rx="1" fill="#0f172a" />
          <rect x="38" y="31" width="6" height="3" rx="1" fill="#0f172a" />
        </>
      )}
      {archetype === "oracle" && (
        <>
          <path
            d="M22 24 Q36 6 50 24 L48 32 Q36 14 24 32 Z"
            fill={palette.outfitDark}
            opacity="0.95"
          />
          <circle cx="36" cy="12" r="2" fill={palette.accent} opacity="0.8" />
        </>
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
          <rect x="18" y="46" width="10" height="8" rx="2" fill={palette.accent} opacity="0.85" />
          <rect x="44" y="46" width="10" height="8" rx="2" fill={palette.accent} opacity="0.85" />
        </>
      )}

      {archetype !== "void" && (
        <>
          <circle cx="31" cy="32" r="1.8" fill="#020617" />
          <circle cx="41" cy="32" r="1.8" fill="#020617" />
          <path d="M33 37 Q36 39 39 37" stroke="#020617" strokeWidth="1.2" fill="none" />
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

export function SpriteGlowDefs() {
  return (
    <defs>
      <filter id="sprite-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.8" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="0.3 0 0.6 0 0  0 0.8 0.7 0 0  0.5 0 1 0 0  0 0 0 0.55 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

import type { FigureConfig } from "@/lib/companion-figure";
import { FantasySvgDefs } from "@/components/fantasy-icons";
import { CompanionAnimatedStage } from "@/components/companion-animated-stage";
import {
  CompanionLockerEquip,
  type LockerEquipItem,
} from "@/components/companion-locker-equip";
import {
  AnimalSprite,
  HumanSprite,
  SpriteGlowDefs,
} from "@/components/companion-sprites";

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

  const { companion, animal, human, skinSlug, showHuman, palette, animalScale, humanScale, badge, hasShield } =
    config;

  const animalX = showHuman ? 2 : 12;
  const animalY = showHuman ? 48 : 12;
  const humanX = showHuman ? 48 : 0;
  const humanY = showHuman ? 4 : 0;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${dim} ${className}`}
    >
      <div
        className="absolute inset-0 rounded-full opacity-70 blur-lg"
        style={{
          background: `radial-gradient(circle, ${palette.aura}55 0%, transparent 72%)`,
        }}
      />
      <svg
        viewBox="0 0 120 100"
        className="relative h-full w-full drop-shadow-[0_0_14px_rgba(94,234,212,0.2)]"
        aria-hidden
      >
        <FantasySvgDefs id={`fig-${size}`} />
        <SpriteGlowDefs />
        <defs>
          <radialGradient id={`aura-${size}`} cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor={palette.aura} stopOpacity="0.6" />
            <stop offset="55%" stopColor={palette.accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`floor-${size}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="92" rx="40" ry="8" fill={`url(#floor-${size})`} />
        <ellipse cx="60" cy="92" rx="34" ry="5" fill="#020617" opacity="0.5" />
        <circle cx="60" cy="46" r="46" fill={`url(#aura-${size})`} />

        {companion.stage <= 2 && (
          <ellipse cx="60" cy="76" rx="26" ry="9" fill="#0f172a" opacity="0.55" />
        )}

        <AnimalSprite
          kind={animal}
          palette={palette}
          scale={animalScale * (showHuman ? 0.88 : 1.08)}
          x={animalX}
          y={animalY}
          preferRaster={size !== "sm"}
        />

        {showHuman && (
          <HumanSprite
            archetype={human}
            palette={palette}
            scale={humanScale}
            x={humanX}
            y={humanY}
            badge={badge}
            skinSlug={skinSlug}
            preferRaster={size !== "sm"}
          />
        )}

        {hasShield && size !== "sm" && (
          <g transform="translate(6 6)">
            <circle cx="10" cy="10" r="10" fill="#059669" stroke="#5eead4" strokeWidth="1.5" />
            <path
              d="M10 4 L10 14 M6 8 L10 4 L14 8"
              stroke="#ecfdf5"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

export function CompanionFigureScene({
  config,
  labels,
  lockerItems,
}: {
  config: FigureConfig;
  labels?: { humanTitle: string; animalTitle: string };
  lockerItems?: { skins: LockerEquipItem[]; badges: LockerEquipItem[] };
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#020617] ring-1 ring-white/5">
      <CompanionAnimatedStage config={config} />
      {lockerItems ? (
        <CompanionLockerEquip skins={lockerItems.skins} badges={lockerItems.badges} />
      ) : (
        labels && (
          <div className="relative z-10 flex flex-wrap justify-center gap-2 px-3 pb-3 pt-1 text-center sm:px-4 sm:pb-4">
            {config.showHuman && (
              <span className="rounded-sm border border-fuchsia-400/35 bg-fuchsia-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-100 shadow-sm shadow-fuchsia-900/40">
                {labels.humanTitle}
              </span>
            )}
            <span className="rounded-sm border border-teal-400/35 bg-teal-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-100 shadow-sm shadow-teal-900/40">
              {labels.animalTitle}
            </span>
          </div>
        )
      )}
    </div>
  );
}

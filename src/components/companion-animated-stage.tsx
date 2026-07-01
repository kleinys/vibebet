"use client";

import { useId } from "react";
import type { FigureConfig } from "@/lib/companion-figure";
import { animalImagePath, humanImagePath } from "@/lib/character-art";
import { companionMotion, HUMAN_MOTION_CLASS } from "@/lib/companion-motion";
import { stageBackdropStyle } from "@/lib/companion-stage-style";
import { AnimalSprite, HumanSprite, SpriteGlowDefs } from "@/components/companion-sprites";
import { FantasySvgDefs } from "@/components/fantasy-icons";

export function CompanionAnimatedStage({ config }: { config: FigureConfig }) {
  const filterUid = useId().replace(/:/g, "");
  const whiteKeyId = `companion-key-${filterUid}`;

  const { animal, human, skinSlug, showHuman, palette, animalScale, humanScale, badge } = config;
  const motion = companionMotion(animal);
  const animalSrc = animalImagePath(animal);
  const humanSrc = showHuman ? humanImagePath(human, skinSlug) : null;

  const figureFilter = `url(#${whiteKeyId}) drop-shadow(0 22px 44px rgba(0,0,0,0.65)) drop-shadow(0 0 28px var(--figure-aura))`;

  return (
    <div
      className={`companion-stage ${showHuman ? "companion-stage--duo" : "companion-stage--solo"}`}
      style={stageBackdropStyle(palette)}
    >
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
        <defs>
          <filter id={whiteKeyId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 2 0"
            />
          </filter>
        </defs>
      </svg>

      <div className={`companion-stage__backdrop ${motion.aura}`} aria-hidden />
      <div className="companion-stage__vignette" aria-hidden />
      <div className={`companion-stage__floor-glow ${motion.bond}`} aria-hidden />

      {showHuman && (
        <div className="companion-figure-slot companion-figure-slot--human">
          <div className={`companion-figure-motion ${HUMAN_MOTION_CLASS}`}>
            {humanSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={humanSrc}
                alt=""
                draggable={false}
                className="companion-figure-raster companion-figure-raster--human"
                style={{ filter: figureFilter }}
              />
            ) : (
              <svg viewBox="0 0 72 88" className="companion-figure-svg companion-figure-svg--human" aria-hidden>
                <FantasySvgDefs id={`stage-human-${filterUid}`} />
                <SpriteGlowDefs />
                <HumanSprite
                  archetype={human}
                  palette={palette}
                  scale={humanScale * 1.35}
                  x={0}
                  y={0}
                  badge={badge}
                  skinSlug={skinSlug}
                  preferRaster={false}
                />
              </svg>
            )}
          </div>
        </div>
      )}

      <div className="companion-figure-slot companion-figure-slot--animal">
        <div className={`companion-figure-motion ${motion.animal}`}>
          {animalSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={animalSrc}
              alt=""
              draggable={false}
              className="companion-figure-raster companion-figure-raster--animal"
              style={{ filter: figureFilter }}
            />
          ) : (
            <svg viewBox="0 0 72 80" className="companion-figure-svg companion-figure-svg--animal" aria-hidden>
              <FantasySvgDefs id={`stage-animal-${filterUid}`} />
              <SpriteGlowDefs />
              <AnimalSprite
                kind={animal}
                palette={palette}
                scale={animalScale * (showHuman ? 1.2 : 1.45)}
                x={0}
                y={0}
                preferRaster={false}
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

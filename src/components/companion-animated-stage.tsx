import type { CSSProperties } from "react";
import type { FigureConfig } from "@/lib/companion-figure";
import { animalImagePath, humanImagePath } from "@/lib/character-art";
import { companionMotion, HUMAN_MOTION_CLASS } from "@/lib/companion-motion";
import { AnimalSprite, HumanSprite, SpriteGlowDefs } from "@/components/companion-sprites";
import { FantasySvgDefs } from "@/components/fantasy-icons";

export function CompanionAnimatedStage({ config }: { config: FigureConfig }) {
  const { animal, human, skinSlug, showHuman, palette, animalScale, humanScale, badge } = config;
  const motion = companionMotion(animal);
  const animalSrc = animalImagePath(animal);
  const humanSrc = showHuman ? humanImagePath(human, skinSlug) : null;
  const aura = palette.aura;

  return (
    <div
      className="companion-stage"
      style={{ "--figure-aura": `${aura}66`, "--figure-aura-strong": `${aura}99` } as CSSProperties}
    >
      <div className={`companion-stage__sky ${motion.aura}`} aria-hidden />
      <div className="companion-stage__stars" aria-hidden />
      <div className={`companion-stage__bond ${motion.bond}`} aria-hidden />

      <div className="companion-stage__platform" aria-hidden>
        <div className="companion-stage__platform-ring" />
        <div className="companion-stage__platform-core" />
      </div>

      {showHuman && (
        <div className={`companion-figure-slot companion-figure-slot--human ${HUMAN_MOTION_CLASS}`}>
          <div className="companion-figure-backing" aria-hidden />
          {humanSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={humanSrc} alt="" draggable={false} className="companion-figure-raster" />
          ) : (
            <svg viewBox="0 0 72 88" className="companion-figure-svg" aria-hidden>
              <FantasySvgDefs id="stage-human" />
              <SpriteGlowDefs />
              <HumanSprite
                archetype={human}
                palette={palette}
                scale={humanScale * 1.15}
                x={0}
                y={0}
                badge={badge}
                skinSlug={skinSlug}
                preferRaster={false}
              />
            </svg>
          )}
        </div>
      )}

      <div className={`companion-figure-slot companion-figure-slot--animal ${motion.animal}`}>
        <div className="companion-figure-backing" aria-hidden />
        {animalSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={animalSrc} alt="" draggable={false} className="companion-figure-raster" />
        ) : (
          <svg viewBox="0 0 72 80" className="companion-figure-svg" aria-hidden>
            <FantasySvgDefs id="stage-animal" />
            <SpriteGlowDefs />
            <AnimalSprite
              kind={animal}
              palette={palette}
              scale={animalScale * (showHuman ? 1.05 : 1.2)}
              x={0}
              y={0}
              preferRaster={false}
            />
          </svg>
        )}
      </div>

      <div className={`companion-stage__sparkles ${motion.aura}`} aria-hidden />
    </div>
  );
}

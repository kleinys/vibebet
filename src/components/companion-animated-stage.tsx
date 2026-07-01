"use client";

import type { CSSProperties } from "react";
import type { FigureConfig } from "@/lib/companion-figure";
import { animalImagePath, humanImagePath } from "@/lib/character-art";
import { companionMotion, HUMAN_MOTION_CLASS } from "@/lib/companion-motion";
import { stageBackdropStyle } from "@/lib/companion-stage-style";
import { AnimalSprite, HumanSprite, SpriteGlowDefs } from "@/components/companion-sprites";
import { FantasySvgDefs } from "@/components/fantasy-icons";

const FIGURE_SHADOW =
  "drop-shadow(0 24px 48px rgba(0,0,0,0.7)) drop-shadow(0 0 32px var(--figure-aura))";

function EyeGlow() {
  return (
    <>
      <span className="companion-eye-glow companion-eye-glow--left" aria-hidden />
      <span className="companion-eye-glow companion-eye-glow--right" aria-hidden />
    </>
  );
}

export function CompanionAnimatedStage({ config }: { config: FigureConfig }) {
  const { animal, human, skinSlug, showHuman, palette, animalScale, humanScale, badge } = config;
  const motion = companionMotion(animal);
  const animalSrc = animalImagePath(animal);
  const humanSrc = showHuman ? humanImagePath(human, skinSlug) : null;

  const orbitStyle = {
    "--orbit-duration": `${motion.orbitDuration}s`,
  } as CSSProperties;

  const stageStyle = { ...stageBackdropStyle(palette), ...orbitStyle };

  return (
    <div
      className={`companion-stage ${showHuman ? "companion-stage--duo" : "companion-stage--solo"}`}
      style={stageStyle}
    >
      <div className={`companion-stage__backdrop ${motion.aura}`} aria-hidden />
      <div className="companion-stage__vignette" aria-hidden />
      <div className={`companion-stage__floor-glow ${motion.bond}`} aria-hidden />

      {showHuman ? (
        <div className="companion-stage__focal">
          {/* Element wisps on orbit */}
          <div className="companion-orbit-track" aria-hidden>
            <div className="companion-orbit-ring" />
            <div className="companion-orbit-carrier">
              {[0, 120, 240].map((deg, i) => (
                <div
                  key={deg}
                  className="companion-element-wisp-host"
                  style={{ "--wisp-angle": `${deg}deg` } as CSSProperties}
                >
                  <span
                    className={`companion-element-wisp companion-element-wisp--${["a", "b", "c"][i]}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Spirit animal orbits trainer */}
          <div className="companion-orbit-track companion-orbit-track--spirit">
            <div className="companion-orbit-carrier">
              <div className="companion-orbit-spirit-anchor">
                <div className="companion-orbit-spirit">
                  <div className="companion-orbit-spirit-inner">
                    {animalSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={animalSrc}
                        alt=""
                        draggable={false}
                        className="companion-figure-raster companion-figure-raster--orbit"
                        style={{ filter: FIGURE_SHADOW }}
                      />
                    ) : (
                      <svg viewBox="0 0 72 80" className="companion-figure-svg companion-figure-svg--orbit" aria-hidden>
                        <FantasySvgDefs id="stage-animal-orbit" />
                        <SpriteGlowDefs />
                        <AnimalSprite
                          kind={animal}
                          palette={palette}
                          scale={animalScale * 0.95}
                          x={0}
                          y={0}
                          preferRaster={false}
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trainer centered */}
          <div className="companion-figure-slot companion-figure-slot--human-center">
            <div className={`companion-human-wrap ${HUMAN_MOTION_CLASS}`}>
              {humanSrc && <EyeGlow />}
              {humanSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={humanSrc}
                  alt=""
                  draggable={false}
                  className="companion-figure-raster companion-figure-raster--human-center"
                  style={{ filter: FIGURE_SHADOW }}
                />
              ) : (
                <svg viewBox="0 0 72 88" className="companion-figure-svg companion-figure-svg--human-center" aria-hidden>
                  <FantasySvgDefs id="stage-human" />
                  <SpriteGlowDefs />
                  <HumanSprite
                    archetype={human}
                    palette={palette}
                    scale={humanScale * 1.55}
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
        </div>
      ) : (
        <div className="companion-figure-slot companion-figure-slot--animal-solo">
          <div className={`companion-figure-motion ${motion.animal}`}>
            {animalSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={animalSrc}
                alt=""
                draggable={false}
                className="companion-figure-raster companion-figure-raster--solo"
                style={{ filter: FIGURE_SHADOW }}
              />
            ) : (
              <svg viewBox="0 0 72 80" className="companion-figure-svg companion-figure-svg--solo" aria-hidden>
                <FantasySvgDefs id="stage-animal-solo" />
                <SpriteGlowDefs />
                <AnimalSprite
                  kind={animal}
                  palette={palette}
                  scale={animalScale * 1.55}
                  x={0}
                  y={0}
                  preferRaster={false}
                />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

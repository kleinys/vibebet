"use client";

import type { CSSProperties } from "react";
import type { FigureConfig } from "@/lib/companion-figure";
import { animalImagePath, humanImagePath } from "@/lib/character-art";
import { companionMotion, HUMAN_MOTION_CLASS } from "@/lib/companion-motion";
import { stageBackdropStyle } from "@/lib/companion-stage-style";
import { AnimalSprite, HumanSprite, SpriteGlowDefs } from "@/components/companion-sprites";
import { FantasySvgDefs } from "@/components/fantasy-icons";
import { SpiritElementBall } from "@/components/spirit-morph-decor";
import type { HypnoticReaction } from "@/lib/hypnotic-flow";

const FIGURE_SHADOW =
  "drop-shadow(0 24px 48px rgba(0,0,0,0.7)) drop-shadow(0 0 32px var(--figure-aura))";

function BadgeOverlay({ badge }: { badge: FigureConfig["badge"] }) {
  if (!badge) return null;
  if (badge === "crown") {
    return (
      <span className="companion-badge companion-badge--crown" aria-hidden title="Founder">
        F
      </span>
    );
  }
  return (
    <span className="companion-badge companion-badge--verified" aria-hidden title="Verified">
      V
    </span>
  );
}

function EyeGlow() {
  return (
    <>
      <span className="companion-eye-glow companion-eye-glow--left" aria-hidden />
      <span className="companion-eye-glow companion-eye-glow--right" aria-hidden />
    </>
  );
}

export function CompanionAnimatedStage({
  config,
  reaction = "idle",
}: {
  config: FigureConfig;
  reaction?: HypnoticReaction;
}) {
  const { animal, human, skinSlug, showHuman, palette, animalScale, humanScale, badge, morph } =
    config;
  const motion = companionMotion(animal);
  const animalSrc = animalImagePath(animal);
  const humanSrc = showHuman ? humanImagePath(human, skinSlug) : null;

  const orbitStyle = {
    "--orbit-duration": `${motion.orbitDuration}s`,
  } as CSSProperties;

  const stageStyle = { ...stageBackdropStyle(palette), ...orbitStyle };

  return (
    <div
      className={`companion-stage ${showHuman ? "companion-stage--duo" : "companion-stage--solo"} companion-stage--react-${reaction}`}
      style={stageStyle}
    >
      <div className={`companion-stage__backdrop ${motion.aura}`} aria-hidden />
      <div className="companion-stage__vignette" aria-hidden />
      <div className={`companion-stage__floor-glow ${motion.bond}`} aria-hidden />

      {showHuman ? (
        <div className="companion-stage__focal">
          {/* Trainer centered (painted first, lower layer) */}
          <div className="companion-figure-slot companion-figure-slot--human-center">
            <div className={`companion-human-wrap ${HUMAN_MOTION_CLASS}`}>
              {humanSrc && <EyeGlow />}
              <BadgeOverlay badge={badge} />
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

          {/* Spirit animal orbits trainer (painted on top) */}
          <div className="companion-orbit-track companion-orbit-track--spirit">
            <div className="companion-orbit-carrier">
              <div className="companion-orbit-spirit-anchor">
                <div className="companion-orbit-spirit">
                  <div
                    className={`companion-orbit-spirit-inner companion-orbit-spirit-inner--${morph} companion-orbit-spirit-inner--${animal}`}
                  >
                    <SpiritElementBall morph={morph} />
                    {animalSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={animalSrc}
                        alt=""
                        draggable={false}
                        className={`companion-figure-raster companion-figure-raster--orbit companion-orbit-animal-img companion-orbit-animal-img--${animal}`}
                      />
                    ) : (
                      <svg
                        viewBox="0 0 72 80"
                        className="companion-figure-svg companion-figure-svg--orbit companion-orbit-animal-img"
                        aria-hidden
                      >
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
                className={`companion-figure-raster companion-figure-raster--solo companion-orbit-animal-img companion-orbit-animal-img--${animal}`}
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

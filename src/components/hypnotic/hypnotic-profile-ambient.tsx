"use client";

import { useEffect, useState } from "react";
import type { FigureConfig } from "@/lib/companion-figure";
import type { HypnoticReaction } from "@/lib/hypnotic-flow";
import { CompanionAnimatedStage } from "@/components/companion-animated-stage";
import { HypnoticParticleField } from "@/components/hypnotic/hypnotic-particle-field";

const AFTERGLOW_KEY = "vibebet-hypnotic-afterglow";

/** Ambient bait on profile trainer stage — breathing UI, embers, leash pull toward arena. */
export function HypnoticProfileAmbient({
  config,
  freeSpinAvailable,
  children,
}: {
  config: FigureConfig;
  freeSpinAvailable: boolean;
  children?: React.ReactNode;
}) {
  const [reaction, setReaction] = useState<HypnoticReaction>(
    freeSpinAvailable ? "leash" : "idle",
  );

  useEffect(() => {
    try {
      if (sessionStorage.getItem(AFTERGLOW_KEY)) {
        sessionStorage.removeItem(AFTERGLOW_KEY);
        setReaction("afterglow");
        const t = window.setTimeout(
          () => setReaction(freeSpinAvailable ? "leash" : "idle"),
          10_000,
        );
        return () => window.clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [freeSpinAvailable]);

  useEffect(() => {
    if (reaction === "afterglow") return;
    setReaction(freeSpinAvailable ? "leash" : "idle");
  }, [freeSpinAvailable, reaction]);

  return (
    <div
      className={`hypnotic-profile-ambient ${freeSpinAvailable ? "hypnotic-profile-ambient--bait" : ""}`}
    >
      <HypnoticParticleField intensity={freeSpinAvailable ? 1 : 0.6} />
      <div className="hypnotic-profile-ambient__stage">
        <CompanionAnimatedStage config={config} reaction={reaction} />
      </div>
      {children}
      {freeSpinAvailable && reaction !== "afterglow" && (
        <div className="hypnotic-profile-ambient__magnet-line" aria-hidden />
      )}
      {reaction === "afterglow" && (
        <p className="relative z-10 px-3 pb-2 text-center text-[10px] text-violet-300/70">
          Your spirit still echoes the arena…
        </p>
      )}
    </div>
  );
}

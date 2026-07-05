"use client";

import { useEffect, useState } from "react";
import type { FigureConfig } from "@/lib/companion-figure";
import { HypnoticFlowProvider } from "@/components/hypnotic/hypnotic-flow-provider";
import type { HypnoticSession } from "@/lib/hypnotic-flow";
import { HypnoticMomentumBar } from "@/components/hypnotic/hypnotic-momentum-bar";
import { HypnoticParticleField } from "@/components/hypnotic/hypnotic-particle-field";
import { HypnoticStageReactor } from "@/components/hypnotic/hypnotic-stage-reactor";
import { HypnoticMorphFloor } from "@/components/hypnotic/hypnotic-morph-floor";
import { HypnoticAfterglowBridge } from "@/components/hypnotic/hypnotic-afterglow-bridge";
import { useHypnoticFlowOptional } from "@/components/hypnotic/hypnotic-flow-provider";

function HypnoticArenaChrome() {
  const flow = useHypnoticFlowOptional();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    onChange();
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const arena = document.getElementById("hypnotic-arena-root");
    if (!arena) return;
    if (!document.fullscreenElement) {
      await arena.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void toggleFullscreen();
        }}
        className="hypnotic-fullscreen-toggle"
      >
        {isFullscreen ? "Exit full screen" : "Full screen"}
      </button>

      {flow?.superActive && <span className="hypnotic-fullscreen-aura" aria-hidden />}
    </>
  );
}

export function HypnoticArenaExperience({
  figureConfig,
  vibeBalance,
  spinsUsedToday,
  equippedSkinSlug,
  initialSession,
  initialAffinityLabel,
  pendingScratchers = [],
}: {
  figureConfig: FigureConfig;
  vibeBalance: number;
  spinsUsedToday: number;
  equippedSkinSlug?: string | null;
  initialSession?: HypnoticSession;
  initialAffinityLabel?: string | null;
  pendingScratchers?: { id: string; prize: number }[];
}) {
  const freeSpinAvailable = spinsUsedToday === 0;

  return (
    <HypnoticFlowProvider
      initialSession={initialSession}
      initialAffinityLabel={initialAffinityLabel}
    >
      <HypnoticAfterglowBridge animal={figureConfig.animal} />
      <div id="hypnotic-arena-root" className="hypnotic-arena relative">
        <HypnoticArenaChrome />
        <HypnoticParticleField intensity={freeSpinAvailable ? 1.2 : 0.8} />

        <div className="hypnotic-arena__layout">
          <HypnoticMomentumBar />

          <div className="hypnotic-arena__main min-w-0 flex-1">
            <div className="hypnotic-arena__stage-wrap">
              <HypnoticStageReactor config={figureConfig} />
            </div>

            <HypnoticMorphFloor
              vibeBalance={vibeBalance}
              spinsUsedToday={spinsUsedToday}
              equippedSkinSlug={equippedSkinSlug}
              pendingScratchers={pendingScratchers}
            />
          </div>
        </div>

        {freeSpinAvailable && (
          <p className="hypnotic-arena__hook mt-2 text-center text-[10px] text-amber-300/70">
            Free spin ready
          </p>
        )}
      </div>
    </HypnoticFlowProvider>
  );
}

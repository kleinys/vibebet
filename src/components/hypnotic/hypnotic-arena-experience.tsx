"use client";

import Link from "next/link";
import type { FigureConfig } from "@/lib/companion-figure";
import { HypnoticFlowProvider } from "@/components/hypnotic/hypnotic-flow-provider";
import { HypnoticMomentumBar } from "@/components/hypnotic/hypnotic-momentum-bar";
import { HypnoticParticleField } from "@/components/hypnotic/hypnotic-particle-field";
import { HypnoticStageReactor } from "@/components/hypnotic/hypnotic-stage-reactor";
import { HypnoticMorphFloor } from "@/components/hypnotic/hypnotic-morph-floor";
import { HypnoticAfterglowBridge } from "@/components/hypnotic/hypnotic-afterglow-bridge";

export function HypnoticArenaExperience({
  figureConfig,
  vibeBalance,
  spinsUsedToday,
  equippedSkinSlug,
}: {
  figureConfig: FigureConfig;
  vibeBalance: number;
  spinsUsedToday: number;
  equippedSkinSlug?: string | null;
}) {
  const freeSpinAvailable = spinsUsedToday === 0;

  return (
    <HypnoticFlowProvider>
      <HypnoticAfterglowBridge animal={figureConfig.animal} />
      <div className="hypnotic-arena relative">
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
            />
          </div>
        </div>

        {freeSpinAvailable && (
          <p className="hypnotic-arena__hook mt-4 text-center text-[11px] text-amber-300/80">
            Free spin ready — embers drift toward the wheel. One tap starts the show.
          </p>
        )}

        <p className="mt-3 text-center text-[10px] text-zinc-600">
          <Link href="/shop" className="text-violet-400/80 hover:text-violet-300">
            Shop skins
          </Link>
          {" · "}
          Momentum builds with wins — hit 100% for SUPER mode
        </p>
      </div>
    </HypnoticFlowProvider>
  );
}

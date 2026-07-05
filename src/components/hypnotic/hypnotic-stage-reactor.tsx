"use client";

import type { FigureConfig } from "@/lib/companion-figure";
import { CompanionAnimatedStage } from "@/components/companion-animated-stage";
import { useHypnoticFlowOptional } from "@/components/hypnotic/hypnotic-flow-provider";

export function HypnoticStageReactor({
  config,
  className = "",
}: {
  config: FigureConfig;
  className?: string;
}) {
  const flow = useHypnoticFlowOptional();
  const reaction = flow?.reaction ?? "idle";
  const cinema = flow?.cinema ?? "idle";
  const superActive = flow?.superActive ?? false;

  return (
    <div
      className={`hypnotic-stage-reactor ${className} hypnotic-stage-reactor--${reaction} ${
        superActive ? "hypnotic-stage-reactor--super" : ""
      } hypnotic-stage-reactor--cinema-${cinema}`}
    >
      <CompanionAnimatedStage config={config} reaction={reaction} />
      {flow?.vibeOrbs.map((orb) => (
        <span
          key={orb.id}
          className="hypnotic-vibe-orb"
          data-amount={orb.amount}
        >
          +{orb.amount}
        </span>
      ))}
      {cinema === "confetti" && (
        <div className="hypnotic-confetti" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="hypnotic-confetti__bit" style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useHypnoticFlow } from "@/components/hypnotic/hypnotic-flow-provider";

export function HypnoticMomentumBar() {
  const { momentum, superActive, superSecondsLeft } = useHypnoticFlow();

  return (
    <div className="hypnotic-momentum" aria-label={`Momentum ${momentum}%`}>
      <div className="hypnotic-momentum__label">
        <span aria-hidden>🔥</span>
        <span>Momentum</span>
      </div>
      <div className="hypnotic-momentum__track">
        <div
          className={`hypnotic-momentum__fill ${superActive ? "hypnotic-momentum__fill--super" : ""}`}
          style={{ height: `${momentum}%` }}
        />
        {[25, 50, 75].map((mark) => (
          <span
            key={mark}
            className="hypnotic-momentum__tick"
            style={{ bottom: `${mark}%` }}
          />
        ))}
      </div>
      <p className="hypnotic-momentum__pct tabular-nums">{momentum}%</p>
      {superActive && (
        <p className="hypnotic-momentum__super">
          SUPER · {superSecondsLeft}s
          <span className="block text-[9px] font-normal text-amber-200/80">2× jackpot payouts</span>
        </p>
      )}
    </div>
  );
}

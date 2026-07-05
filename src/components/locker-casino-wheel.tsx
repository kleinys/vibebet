"use client";

import { useMemo } from "react";
import { WHEEL_SEGMENTS } from "@/components/companion-locker-rewards";

export function LockerCasinoWheel({
  rotation,
  spinning,
  glowing = false,
}: {
  rotation: number;
  spinning: boolean;
  glowing?: boolean;
}) {
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  const wheelGradient = useMemo(
    () =>
      `conic-gradient(${WHEEL_SEGMENTS.map(
        (seg, i) =>
          `${seg.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`,
      ).join(", ")})`,
    [segmentAngle],
  );

  return (
    <div
      className={`locker-casino-wheel-wrap ${spinning ? "locker-casino-wheel-wrap--spin" : ""} ${glowing ? "locker-casino-wheel-wrap--glow" : ""}`}
    >
      {/* Static outer frame — does not spin */}
      <div className="locker-casino-wheel-frame" aria-hidden />
      <div className="locker-casino-wheel-pointer" aria-hidden />

      {/* Inner disk + labels — only this layer rotates */}
      <div
        className="locker-casino-wheel-disk"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="locker-casino-wheel-disk__gradient" style={{ background: wheelGradient }} />
        {WHEEL_SEGMENTS.map((seg, i) => {
          const angle = i * segmentAngle + segmentAngle / 2;
          return (
            <span
              key={seg.label}
              className="locker-casino-wheel-disk__label"
              style={{
                color: seg.text,
                transform: `rotate(${angle}deg) translateY(-92px)`,
                transformOrigin: "50% 92px",
              }}
            >
              {seg.label.replace(" VIBE", "").replace(" JACKPOT", " JP")}
            </span>
          );
        })}
      </div>

      {/* Static hub cap */}
      <div className="locker-casino-wheel-hub" aria-hidden>
        <span>VIBE</span>
      </div>
    </div>
  );
}

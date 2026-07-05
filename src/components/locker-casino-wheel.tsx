"use client";

import { LOCKER_WHEEL_IMAGE } from "@/lib/locker-assets";

export function LockerCasinoWheel({
  rotation,
  spinning,
  glowing = false,
}: {
  rotation: number;
  spinning: boolean;
  glowing?: boolean;
}) {
  return (
    <div
      className={`locker-casino-wheel-wrap ${spinning ? "locker-casino-wheel-wrap--spin" : ""} ${glowing ? "locker-casino-wheel-wrap--glow" : ""}`}
    >
      <div className="locker-casino-wheel-pointer" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOCKER_WHEEL_IMAGE}
        alt=""
        draggable={false}
        className="locker-casino-wheel locker-casino-wheel--raster"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </div>
  );
}

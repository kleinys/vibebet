"use client";

import type { CSSProperties } from "react";
import {
  mysticEyeIntensity,
  mysticEyeTheme,
  type MysticEyeStreakMode,
} from "@/lib/companion-eyes";

export function MysticEyes({
  skinSlug,
  streakMode = "none",
}: {
  skinSlug: string;
  streakMode?: MysticEyeStreakMode;
}) {
  const theme = mysticEyeTheme(skinSlug);
  const glow = mysticEyeIntensity(theme, streakMode);
  const urgent = streakMode === "urgent";

  return (
    <div
      className={`mystic-eyes mystic-eyes--${theme.pupil} ${urgent ? "mystic-eyes--urgent" : ""}`}
      style={
        {
          "--eye-left": theme.leftIris,
          "--eye-right": theme.rightIris,
          "--eye-halo": theme.halo,
          "--eye-glow-scale": glow,
        } as CSSProperties
      }
      aria-hidden
    >
      <span className="mystic-eye mystic-eye--left">
        <span className="mystic-eye__halo" />
        <span className="mystic-eye__iris" />
        <span className="mystic-eye__pupil" />
        <span className="mystic-eye__catch" />
      </span>
      <span className="mystic-eye mystic-eye--right">
        <span className="mystic-eye__halo" />
        <span className="mystic-eye__iris" />
        <span className="mystic-eye__pupil" />
        <span className="mystic-eye__catch" />
      </span>
    </div>
  );
}

import type { CSSProperties } from "react";

/** Build Fortnite-style stage gradient stops from companion palette. */
export function stageBackdropStyle(palette: {
  accent: string;
  aura: string;
  outfit: string;
  animal: string;
}): CSSProperties {
  return {
    "--stage-hot": palette.accent,
    "--stage-mid": palette.aura,
    "--stage-deep": palette.outfit,
    "--stage-spirit": palette.animal,
    "--figure-aura": `${palette.aura}55`,
    "--figure-aura-strong": `${palette.aura}aa`,
  } as CSSProperties;
}

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
    "--eye-glow": palette.accent,
    "--eye-glow-soft": `${palette.accent}99`,
    "--spirit-element": palette.animal,
    "--spirit-element-soft": `${palette.animal}66`,
  } as CSSProperties;
}

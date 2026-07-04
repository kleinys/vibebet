import type { SpiritMorphElement } from "@/lib/companion-motion";

/** Orbit phenomenon preview art in public/characters/phenomena/ */
export const PHENOMENON_IMAGES: Record<SpiritMorphElement, string> = {
  fire: "/characters/phenomena/fire.webp",
  rune: "/characters/phenomena/rune.webp",
  lunar: "/characters/phenomena/lunar.webp",
  solar: "/characters/phenomena/solar.webp",
  neon: "/characters/phenomena/neon.webp",
  voidrift: "/characters/phenomena/voidrift.webp",
  cosmic: "/characters/phenomena/cosmic.webp",
  forge: "/characters/phenomena/forge.webp",
  frost: "/characters/phenomena/frost.webp",
  thunder: "/characters/phenomena/thunder.webp",
  nebula: "/characters/phenomena/nebula.webp",
  eclipse: "/characters/phenomena/eclipse.webp",
  aurora: "/characters/phenomena/aurora.webp",
  storm: "/characters/phenomena/thunder.webp",
  arcane: "/characters/phenomena/cosmic.webp",
};

const PHENOMENON_ART_VERSION = "1";

export function phenomenonImagePath(morph: SpiritMorphElement): string {
  return `${PHENOMENON_IMAGES[morph]}?v=${PHENOMENON_ART_VERSION}`;
}

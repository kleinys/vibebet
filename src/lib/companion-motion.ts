import type { AnimalKind } from "@/lib/companion-figure";

export type SpiritMorphElement = "fire" | "arcane" | "storm" | "lunar" | "solar";

export interface CompanionMotion {
  /** Legacy idle class for solo mode */
  animal: string;
  aura: string;
  bond: string;
  orbitDuration: number;
  /** Element form when spirit passes behind the trainer */
  morph: SpiritMorphElement;
}

const MOTION: Record<AnimalKind, CompanionMotion> = {
  fox: { animal: "companion-motion-fox", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-playful", orbitDuration: 14, morph: "fire" },
  cat: { animal: "companion-motion-cat", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-playful", orbitDuration: 14, morph: "fire" },
  owl: { animal: "companion-motion-owl", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 20, morph: "lunar" },
  wolf: { animal: "companion-motion-wolf", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-alert", orbitDuration: 18, morph: "storm" },
  dragon: { animal: "companion-motion-dragon", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-arcane", orbitDuration: 22, morph: "arcane" },
  stag: { animal: "companion-motion-stag", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 21, morph: "lunar" },
  phoenix: { animal: "companion-motion-phoenix", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-arcane", orbitDuration: 13, morph: "solar" },
  raven: { animal: "companion-motion-raven", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-alert", orbitDuration: 15, morph: "arcane" },
};

export function companionMotion(animal: AnimalKind): CompanionMotion {
  return MOTION[animal];
}

/** Human-readable element form label for UI copy */
export const SPIRIT_MORPH_LABELS: Record<SpiritMorphElement, string> = {
  fire: "fireball",
  solar: "sun orb",
  storm: "lightning sphere",
  lunar: "moon spirit",
  arcane: "arcane orb",
};

export const HUMAN_MOTION_CLASS = "companion-motion-human";

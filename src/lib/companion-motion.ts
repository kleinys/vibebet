import type { AnimalKind } from "@/lib/companion-figure";

export interface CompanionMotion {
  /** Legacy idle class for solo mode */
  animal: string;
  aura: string;
  bond: string;
  orbitDuration: number;
}

const MOTION: Record<AnimalKind, CompanionMotion> = {
  fox: { animal: "companion-motion-fox", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-playful", orbitDuration: 16 },
  cat: { animal: "companion-motion-cat", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-playful", orbitDuration: 14 },
  owl: { animal: "companion-motion-owl", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 20 },
  wolf: { animal: "companion-motion-wolf", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-alert", orbitDuration: 18 },
  dragon: { animal: "companion-motion-dragon", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-arcane", orbitDuration: 22 },
  stag: { animal: "companion-motion-stag", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 21 },
  phoenix: { animal: "companion-motion-phoenix", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-arcane", orbitDuration: 13 },
  raven: { animal: "companion-motion-raven", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-alert", orbitDuration: 15 },
};

export function companionMotion(animal: AnimalKind): CompanionMotion {
  return MOTION[animal];
}

export const HUMAN_MOTION_CLASS = "companion-motion-human";

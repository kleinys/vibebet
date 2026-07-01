import type { AnimalKind } from "@/lib/companion-figure";

export interface CompanionMotion {
  animal: string;
  aura: string;
  bond: string;
}

const MOTION: Record<AnimalKind, CompanionMotion> = {
  fox: {
    animal: "companion-motion-fox",
    aura: "companion-motion-aura-warm",
    bond: "companion-motion-bond-playful",
  },
  cat: {
    animal: "companion-motion-cat",
    aura: "companion-motion-aura-warm",
    bond: "companion-motion-bond-playful",
  },
  owl: {
    animal: "companion-motion-owl",
    aura: "companion-motion-aura-cool",
    bond: "companion-motion-bond-calm",
  },
  wolf: {
    animal: "companion-motion-wolf",
    aura: "companion-motion-aura-cool",
    bond: "companion-motion-bond-alert",
  },
  dragon: {
    animal: "companion-motion-dragon",
    aura: "companion-motion-aura-arcane",
    bond: "companion-motion-bond-arcane",
  },
  stag: {
    animal: "companion-motion-stag",
    aura: "companion-motion-aura-cool",
    bond: "companion-motion-bond-calm",
  },
  phoenix: {
    animal: "companion-motion-phoenix",
    aura: "companion-motion-aura-warm",
    bond: "companion-motion-bond-arcane",
  },
  raven: {
    animal: "companion-motion-raven",
    aura: "companion-motion-aura-arcane",
    bond: "companion-motion-bond-alert",
  },
};

export function companionMotion(animal: AnimalKind): CompanionMotion {
  return MOTION[animal];
}

export const HUMAN_MOTION_CLASS = "companion-motion-human";

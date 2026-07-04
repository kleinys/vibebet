import type { AnimalKind } from "@/lib/companion-figure";

/** Each trainer skin has exactly one unique orbit phenomenon. */
export type SpiritMorphElement =
  | "fire"
  | "rune"
  | "lunar"
  | "solar"
  | "neon"
  | "voidrift"
  | "cosmic"
  | "forge"
  | "frost"
  | "thunder"
  | "nebula"
  | "eclipse"
  | "aurora"
  | "storm"
  | "arcane";

export interface CompanionMotion {
  animal: string;
  aura: string;
  bond: string;
  orbitDuration: number;
  /** Default morph when no skin roster entry (legacy) */
  morph: SpiritMorphElement;
}

const MOTION: Record<AnimalKind, CompanionMotion> = {
  fox: { animal: "companion-motion-fox", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-playful", orbitDuration: 14, morph: "fire" },
  cat: { animal: "companion-motion-cat", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-playful", orbitDuration: 14, morph: "forge" },
  owl: { animal: "companion-motion-owl", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 20, morph: "aurora" },
  wolf: { animal: "companion-motion-wolf", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-alert", orbitDuration: 18, morph: "voidrift" },
  dragon: { animal: "companion-motion-dragon", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-arcane", orbitDuration: 22, morph: "cosmic" },
  stag: { animal: "companion-motion-stag", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 21, morph: "lunar" },
  phoenix: { animal: "companion-motion-phoenix", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-arcane", orbitDuration: 13, morph: "solar" },
  raven: { animal: "companion-motion-raven", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-alert", orbitDuration: 15, morph: "rune" },
  serpent: { animal: "companion-motion-serpent", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-calm", orbitDuration: 19, morph: "frost" },
  bear: { animal: "companion-motion-bear", aura: "companion-motion-aura-warm", bond: "companion-motion-bond-alert", orbitDuration: 17, morph: "thunder" },
  mantis: { animal: "companion-motion-mantis", aura: "companion-motion-aura-cool", bond: "companion-motion-bond-alert", orbitDuration: 16, morph: "neon" },
  bat: { animal: "companion-motion-bat", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-calm", orbitDuration: 15, morph: "eclipse" },
  crane: { animal: "companion-motion-crane", aura: "companion-motion-aura-arcane", bond: "companion-motion-bond-arcane", orbitDuration: 20, morph: "nebula" },
};

export function companionMotion(animal: AnimalKind): CompanionMotion {
  return MOTION[animal];
}

export const SPIRIT_MORPH_LABELS: Record<SpiritMorphElement, string> = {
  fire: "Ember Heart",
  rune: "Ink Rune Orb",
  lunar: "Moon Spirit",
  solar: "Sun Corona",
  neon: "Neon Pulse",
  voidrift: "Void Rift",
  cosmic: "Star Singularity",
  forge: "Forge Ember",
  frost: "Ice Crystal",
  thunder: "Thunder Core",
  nebula: "Nebula Veil",
  eclipse: "Blood Eclipse",
  aurora: "Aurora Ribbon",
  storm: "Lightning Sphere",
  arcane: "Arcane Orb",
};

export const SPIRIT_MORPH_DESCRIPTIONS: Record<SpiritMorphElement, string> = {
  fire: "Playful ember heart with triple flame tail.",
  rune: "Floating golden rune ring around a scholar's violet core.",
  lunar: "Silver crescent, stardust, and moon halo.",
  solar: "Radiant corona rays — brightest phenomenon.",
  neon: "Cyan-magenta holographic pulse rings.",
  voidrift: "Dark purple spiral rift sucking in light.",
  cosmic: "Indigo singularity with orbiting star motes.",
  forge: "Molten sparks from a blacksmith's ember core.",
  frost: "Sharp ice crystal shards orbiting a pale core.",
  thunder: "Storm cloud wrapped in gold lightning.",
  nebula: "Pink-purple cosmic cloud veil with star sparks.",
  eclipse: "Crimson lunar eclipse with blood-red pulse.",
  aurora: "Green-teal northern light ribbons.",
  storm: "Cloud shell with lightning bolts.",
  arcane: "Violet rune ring and arcane sparks.",
};

export const HUMAN_MOTION_CLASS = "companion-motion-human";

import type { AnimalKind } from "@/lib/companion-figure";
import type { SpiritMorphElement } from "@/lib/companion-motion";
import { SPIRIT_MORPH_LABELS } from "@/lib/companion-motion";

export interface CompanionRosterEntry {
  skinSlug: string;
  trainerName: string;
  animal: AnimalKind;
  animalName: string;
  morph: SpiritMorphElement;
  theme: string;
  trait: string;
  elementLabel: string;
}

/** Canonical trainer ↔ spirit animal pairs (shop skin equipped). */
export const COMPANION_ROSTER: CompanionRosterEntry[] = [
  {
    skinSlug: "default-oracle",
    trainerName: "Oracle",
    animal: "fox",
    animalName: "Fox Spirit",
    morph: "fire",
    theme: "Mystic violet & ember",
    trait: "Playful starter — fox trails a fireball when orbiting",
    elementLabel: SPIRIT_MORPH_LABELS.fire,
  },
  {
    skinSlug: "oracle-sage",
    trainerName: "Oracle Sage",
    animal: "raven",
    animalName: "Rune Raven",
    morph: "arcane",
    theme: "Scholarly runes & ink",
    trait: "Wise tactician — raven carries an arcane orb",
    elementLabel: SPIRIT_MORPH_LABELS.arcane,
  },
  {
    skinSlug: "oracle-lunar",
    trainerName: "Oracle Lunar",
    animal: "stag",
    animalName: "Spirit Stag",
    morph: "lunar",
    theme: "Moonlit silver & indigo",
    trait: "Calm night seer — stag becomes a moon spirit",
    elementLabel: SPIRIT_MORPH_LABELS.lunar,
  },
  {
    skinSlug: "oracle-solar",
    trainerName: "Oracle Solar",
    animal: "phoenix",
    animalName: "Sun Phoenix",
    morph: "solar",
    theme: "Sun-forged gold & flame",
    trait: "Radiant champion — phoenix becomes a sun orb",
    elementLabel: SPIRIT_MORPH_LABELS.solar,
  },
  {
    skinSlug: "neon-seer",
    trainerName: "Neon Seer",
    animal: "owl",
    animalName: "Moon Owl",
    morph: "lunar",
    theme: "Cyber teal & neon visor",
    trait: "Night watcher — owl channels lunar glow",
    elementLabel: SPIRIT_MORPH_LABELS.lunar,
  },
  {
    skinSlug: "void-prophet",
    trainerName: "Void Prophet",
    animal: "wolf",
    animalName: "Storm Wolf",
    morph: "storm",
    theme: "Void purple & shadow",
    trait: "Edge predictor — wolf wraps a lightning sphere",
    elementLabel: SPIRIT_MORPH_LABELS.storm,
  },
  {
    skinSlug: "cosmic-oracle",
    trainerName: "Cosmic Oracle",
    animal: "dragon",
    animalName: "Star Dragon",
    morph: "arcane",
    theme: "Deep space indigo & stars",
    trait: "Legend-tier — dragon orbits an arcane core",
    elementLabel: SPIRIT_MORPH_LABELS.arcane,
  },
  {
    skinSlug: "ember-knight",
    trainerName: "Ember Knight",
    animal: "cat",
    animalName: "Ember Cat",
    morph: "fire",
    theme: "Forge orange & plate armor",
    trait: "Aggressive duelist — cat trails ember fire",
    elementLabel: SPIRIT_MORPH_LABELS.fire,
  },
  {
    skinSlug: "frost-walker",
    trainerName: "Frost Walker",
    animal: "serpent",
    animalName: "Frost Serpent",
    morph: "storm",
    theme: "Glacial cyan & ice robes",
    trait: "Cold precision — serpent coils a frost lightning sphere",
    elementLabel: SPIRIT_MORPH_LABELS.storm,
  },
  {
    skinSlug: "storm-titan",
    trainerName: "Storm Titan",
    animal: "bear",
    animalName: "Storm Bear",
    morph: "storm",
    theme: "Thunder slate & gold trim",
    trait: "Heavy hitter — bear carries storm energy",
    elementLabel: SPIRIT_MORPH_LABELS.storm,
  },
  {
    skinSlug: "nebula-ronin",
    trainerName: "Nebula Ronin",
    animal: "dragon",
    animalName: "Star Dragon",
    morph: "arcane",
    theme: "Magenta nebula & star blades",
    trait: "Cosmic duelist — dragon with nebula arcane orb",
    elementLabel: SPIRIT_MORPH_LABELS.arcane,
  },
  {
    skinSlug: "blood-moon",
    trainerName: "Blood Moon",
    animal: "raven",
    animalName: "Rune Raven",
    morph: "arcane",
    theme: "Crimson cult & lunar eclipse",
    trait: "Dark omen — raven with blood-red arcane pulse",
    elementLabel: SPIRIT_MORPH_LABELS.arcane,
  },
  {
    skinSlug: "aurora-sage",
    trainerName: "Aurora Sage",
    animal: "owl",
    animalName: "Moon Owl",
    morph: "lunar",
    theme: "Northern lights green & teal",
    trait: "Aurora mystic — owl with polar moon spirit",
    elementLabel: SPIRIT_MORPH_LABELS.lunar,
  },
];

export const MORPH_PHENOMENA: {
  morph: SpiritMorphElement;
  label: string;
  description: string;
  animals: AnimalKind[];
}[] = [
  {
    morph: "fire",
    label: SPIRIT_MORPH_LABELS.fire,
    description: "Ember trails and flame core while the spirit passes behind the trainer.",
    animals: ["fox", "cat"],
  },
  {
    morph: "lunar",
    label: SPIRIT_MORPH_LABELS.lunar,
    description: "Moon crescent, stardust, and soft silver halo on orbit.",
    animals: ["owl", "stag"],
  },
  {
    morph: "solar",
    label: SPIRIT_MORPH_LABELS.solar,
    description: "Corona rays and golden sun orb — brightest morph.",
    animals: ["phoenix"],
  },
  {
    morph: "storm",
    label: SPIRIT_MORPH_LABELS.storm,
    description: "Cloud shell with lightning bolts — electric sphere.",
    animals: ["wolf", "serpent", "bear"],
  },
  {
    morph: "arcane",
    label: SPIRIT_MORPH_LABELS.arcane,
    description: "Rune rings and violet arcane core — mystic energy.",
    animals: ["dragon", "raven"],
  },
];

export function rosterBySkin(slug: string): CompanionRosterEntry | undefined {
  return COMPANION_ROSTER.find((e) => e.skinSlug === slug);
}

import type { AnimalKind } from "@/lib/companion-figure";
import type { SpiritMorphElement } from "@/lib/companion-motion";
import {
  SPIRIT_MORPH_DESCRIPTIONS,
  SPIRIT_MORPH_LABELS,
} from "@/lib/companion-motion";

export interface CompanionRosterEntry {
  skinSlug: string;
  trainerName: string;
  animal: AnimalKind;
  animalName: string;
  morph: SpiritMorphElement;
  theme: string;
  trait: string;
  elementLabel: string;
  elementDescription: string;
}

/** One unique spirit animal + orbit phenomenon per trainer skin. */
export const COMPANION_ROSTER: CompanionRosterEntry[] = [
  {
    skinSlug: "default-oracle",
    trainerName: "Oracle",
    animal: "fox",
    animalName: "Fox Spirit",
    morph: "fire",
    theme: "Mystic violet & ember",
    trait: "Playful starter — trails an ember heart",
    elementLabel: SPIRIT_MORPH_LABELS.fire,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.fire,
  },
  {
    skinSlug: "oracle-sage",
    trainerName: "Oracle Sage",
    animal: "raven",
    animalName: "Rune Raven",
    morph: "rune",
    theme: "Scholarly runes & ink",
    trait: "Wise tactician — ink rune orb",
    elementLabel: SPIRIT_MORPH_LABELS.rune,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.rune,
  },
  {
    skinSlug: "oracle-lunar",
    trainerName: "Oracle Lunar",
    animal: "stag",
    animalName: "Spirit Stag",
    morph: "lunar",
    theme: "Moonlit silver & indigo",
    trait: "Calm night seer — moon spirit halo",
    elementLabel: SPIRIT_MORPH_LABELS.lunar,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.lunar,
  },
  {
    skinSlug: "oracle-solar",
    trainerName: "Oracle Solar",
    animal: "phoenix",
    animalName: "Sun Phoenix",
    morph: "solar",
    theme: "Sun-forged gold & flame",
    trait: "Radiant champion — sun corona",
    elementLabel: SPIRIT_MORPH_LABELS.solar,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.solar,
  },
  {
    skinSlug: "neon-seer",
    trainerName: "Neon Seer",
    animal: "mantis",
    animalName: "Neon Mantis",
    morph: "neon",
    theme: "Cyber teal & holo visor",
    trait: "Data-hunter — neon pulse rings",
    elementLabel: SPIRIT_MORPH_LABELS.neon,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.neon,
  },
  {
    skinSlug: "void-prophet",
    trainerName: "Void Prophet",
    animal: "wolf",
    animalName: "Storm Wolf",
    morph: "voidrift",
    theme: "Void purple & shadow",
    trait: "Edge predictor — void rift spiral",
    elementLabel: SPIRIT_MORPH_LABELS.voidrift,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.voidrift,
  },
  {
    skinSlug: "cosmic-oracle",
    trainerName: "Cosmic Oracle",
    animal: "dragon",
    animalName: "Star Dragon",
    morph: "cosmic",
    theme: "Deep space indigo & stars",
    trait: "Legend-tier — star singularity",
    elementLabel: SPIRIT_MORPH_LABELS.cosmic,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.cosmic,
  },
  {
    skinSlug: "ember-knight",
    trainerName: "Ember Knight",
    animal: "tiger",
    animalName: "Ember Tiger",
    morph: "reddwarf",
    theme: "Forge orange & plate armor",
    trait: "Aggressive duelist — red dwarf heat flares",
    elementLabel: SPIRIT_MORPH_LABELS.reddwarf,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.reddwarf,
  },
  {
    skinSlug: "frost-walker",
    trainerName: "Frost Walker",
    animal: "serpent",
    animalName: "Frost Serpent",
    morph: "frost",
    theme: "Glacial cyan & ice robes",
    trait: "Cold precision — ice crystal shards",
    elementLabel: SPIRIT_MORPH_LABELS.frost,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.frost,
  },
  {
    skinSlug: "storm-titan",
    trainerName: "Storm Titan",
    animal: "bear",
    animalName: "Storm Bear",
    morph: "thunder",
    theme: "Thunder slate & gold trim",
    trait: "Heavy hitter — thunder core",
    elementLabel: SPIRIT_MORPH_LABELS.thunder,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.thunder,
  },
  {
    skinSlug: "nebula-ronin",
    trainerName: "Nebula Ronin",
    animal: "crane",
    animalName: "Nebula Crane",
    morph: "nebula",
    theme: "Magenta nebula & star blades",
    trait: "Cosmic duelist — nebula veil",
    elementLabel: SPIRIT_MORPH_LABELS.nebula,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.nebula,
  },
  {
    skinSlug: "blood-moon",
    trainerName: "Blood Moon",
    animal: "bat",
    animalName: "Eclipse Bat",
    morph: "eclipse",
    theme: "Crimson cult & lunar eclipse",
    trait: "Dark omen — blood eclipse pulse",
    elementLabel: SPIRIT_MORPH_LABELS.eclipse,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.eclipse,
  },
  {
    skinSlug: "aurora-sage",
    trainerName: "Aurora Sage",
    animal: "owl",
    animalName: "Moon Owl",
    morph: "aurora",
    theme: "Northern lights green & teal",
    trait: "Polar mystic — aurora ribbons",
    elementLabel: SPIRIT_MORPH_LABELS.aurora,
    elementDescription: SPIRIT_MORPH_DESCRIPTIONS.aurora,
  },
];

export function rosterBySkin(slug: string): CompanionRosterEntry | undefined {
  return COMPANION_ROSTER.find((e) => e.skinSlug === slug);
}

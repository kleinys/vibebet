import type { Rarity } from "@/lib/supabase/types";
import type { CompanionInput, CompanionState } from "@/lib/vibe-companion";
import { computeCompanion } from "@/lib/vibe-companion";
import { SKIN_HUMAN_LABELS } from "@/lib/character-art";

export type AnimalKind =
  | "fox"
  | "wolf"
  | "owl"
  | "cat"
  | "dragon"
  | "stag"
  | "phoenix"
  | "raven"
  | "serpent"
  | "bear";
export type HumanArchetype = "oracle" | "seer" | "knight" | "void" | "cosmic";

export interface FigurePalette {
  skin: string;
  hair: string;
  outfit: string;
  outfitDark: string;
  accent: string;
  animal: string;
  animalDark: string;
  aura: string;
}

export interface FigureConfig {
  companion: CompanionState;
  animal: AnimalKind;
  human: HumanArchetype;
  skinSlug: string;
  showHuman: boolean;
  animalScale: number;
  humanScale: number;
  palette: FigurePalette;
  badge: "crown" | "verified" | null;
  hasShield: boolean;
}

const SKIN_TO_ARCHETYPE: Record<string, HumanArchetype> = {
  "default-oracle": "oracle",
  "oracle-sage": "oracle",
  "oracle-lunar": "oracle",
  "oracle-solar": "oracle",
  "neon-seer": "seer",
  "void-prophet": "void",
  "cosmic-oracle": "cosmic",
  "ember-knight": "knight",
  "frost-walker": "void",
  "storm-titan": "knight",
  "nebula-ronin": "cosmic",
  "blood-moon": "oracle",
  "aurora-sage": "seer",
};

const SKIN_PALETTE_OVERRIDES: Partial<Record<string, Partial<FigurePalette>>> = {
  "oracle-lunar": {
    hair: "#312e81",
    outfit: "#6366f1",
    outfitDark: "#4338ca",
    accent: "#c4b5fd",
    animal: "#a78bfa",
    animalDark: "#6d28d9",
    aura: "#818cf8",
  },
  "oracle-solar": {
    hair: "#451a03",
    outfit: "#d97706",
    outfitDark: "#92400e",
    accent: "#fcd34d",
    animal: "#fbbf24",
    animalDark: "#b45309",
    aura: "#f59e0b",
  },
  "frost-walker": {
    hair: "#0c4a6e",
    outfit: "#0284c7",
    outfitDark: "#075985",
    accent: "#67e8f9",
    animal: "#22d3ee",
    animalDark: "#0e7490",
    aura: "#38bdf8",
  },
  "storm-titan": {
    hair: "#1e293b",
    outfit: "#475569",
    outfitDark: "#334155",
    accent: "#fbbf24",
    animal: "#78716c",
    animalDark: "#44403c",
    aura: "#eab308",
  },
  "nebula-ronin": {
    hair: "#4c1d95",
    outfit: "#7c3aed",
    outfitDark: "#5b21b6",
    accent: "#e879f9",
    animal: "#a855f7",
    animalDark: "#6b21a8",
    aura: "#d946ef",
  },
  "blood-moon": {
    hair: "#450a0a",
    outfit: "#991b1b",
    outfitDark: "#7f1d1d",
    accent: "#fca5a5",
    animal: "#dc2626",
    animalDark: "#991b1b",
    aura: "#ef4444",
  },
  "aurora-sage": {
    hair: "#064e3b",
    outfit: "#059669",
    outfitDark: "#047857",
    accent: "#6ee7b7",
    animal: "#34d399",
    animalDark: "#059669",
    aura: "#10b981",
  },
};

const SKIN_PALETTES: Record<HumanArchetype, FigurePalette> = {
  oracle: {
    skin: "#fcd9b6",
    hair: "#3b2a4a",
    outfit: "#c026d3",
    outfitDark: "#86198f",
    accent: "#f0abfc",
    animal: "#f97316",
    animalDark: "#c2410c",
    aura: "#d946ef",
  },
  seer: {
    skin: "#e8d5c4",
    hair: "#0e7490",
    outfit: "#0891b2",
    outfitDark: "#155e75",
    accent: "#67e8f9",
    animal: "#38bdf8",
    animalDark: "#0284c7",
    aura: "#22d3ee",
  },
  void: {
    skin: "#c4b5fd",
    hair: "#1e1b4b",
    outfit: "#5b21b6",
    outfitDark: "#312e81",
    accent: "#a78bfa",
    animal: "#7c3aed",
    animalDark: "#4c1d95",
    aura: "#8b5cf6",
  },
  cosmic: {
    skin: "#fde68a",
    hair: "#312e81",
    outfit: "#4338ca",
    outfitDark: "#1e1b4b",
    accent: "#818cf8",
    animal: "#6366f1",
    animalDark: "#3730a3",
    aura: "#6366f1",
  },
  knight: {
    skin: "#fecaca",
    hair: "#451a03",
    outfit: "#ea580c",
    outfitDark: "#9a3412",
    accent: "#fdba74",
    animal: "#dc2626",
    animalDark: "#991b1b",
    aura: "#f97316",
  },
};

const ANIMAL_BY_SKIN: Partial<Record<string, AnimalKind>> = {
  "default-oracle": "fox",
  "oracle-sage": "raven",
  "oracle-lunar": "stag",
  "oracle-solar": "phoenix",
  "neon-seer": "owl",
  "void-prophet": "wolf",
  "cosmic-oracle": "dragon",
  "ember-knight": "cat",
  "frost-walker": "serpent",
  "storm-titan": "bear",
  "nebula-ronin": "dragon",
  "blood-moon": "raven",
  "aurora-sage": "owl",
};

const ANIMAL_RANK: Record<AnimalKind, number> = {
  fox: 1,
  cat: 2,
  owl: 3,
  wolf: 4,
  dragon: 5,
  stag: 6,
  phoenix: 7,
  raven: 8,
  serpent: 9,
  bear: 10,
};

function animalFromStreak(streak: number): AnimalKind {
  const kinds: AnimalKind[] = ["fox", "cat", "owl", "wolf", "dragon"];
  if (streak >= 30) return "dragon";
  if (streak >= 14) return "wolf";
  if (streak >= 7) return "owl";
  if (streak >= 3) return "cat";
  return kinds[Math.max(0, streak) % kinds.length] ?? "fox";
}

function animalFromInventory(count: number, rarity?: Rarity): AnimalKind {
  if (count >= 6 || rarity === "legendary") return "dragon";
  if (count >= 4 || rarity === "epic") return "wolf";
  if (count >= 2 || rarity === "rare") return "owl";
  if (count >= 1) return "cat";
  return "fox";
}

export function resolveFigureConfig(input: CompanionInput): FigureConfig {
  const companion = computeCompanion(input);
  const skinSlug = input.equippedSkinSlug ?? "default-oracle";
  const archetype = SKIN_TO_ARCHETYPE[skinSlug] ?? "oracle";
  const palette = { ...SKIN_PALETTES[archetype] };
  const overrides = SKIN_PALETTE_OVERRIDES[skinSlug];
  if (overrides) Object.assign(palette, overrides);

  const skinAnimal = ANIMAL_BY_SKIN[skinSlug];
  const streakAnimal = animalFromStreak(input.currentStreak);
  const itemAnimal = animalFromInventory(
    input.inventoryCount,
    input.skinRarity ?? input.badgeRarity,
  );

  const animal =
    skinAnimal ??
    ([streakAnimal, itemAnimal] as AnimalKind[]).sort(
      (a, b) => ANIMAL_RANK[b] - ANIMAL_RANK[a],
    )[0]!;

  const showHuman = companion.stage >= 2;
  const animalScale =
    companion.stage === 1 ? 0.85 : companion.stage === 2 ? 0.95 : 1;
  const humanScale =
    companion.stage === 2 ? 0.62 : companion.stage === 3 ? 0.78 : companion.stage === 4 ? 0.92 : 1.05;

  let badge: FigureConfig["badge"] = null;
  if (input.equippedBadgeSlug === "founder-badge") badge = "crown";
  if (input.equippedBadgeSlug === "verified-seer") badge = "verified";

  return {
    companion,
    animal,
    human: archetype,
    skinSlug,
    showHuman,
    animalScale,
    humanScale,
    palette,
    badge,
    hasShield: input.streakShields > 0,
  };
}

export function figureLabels(config: FigureConfig): {
  humanTitle: string;
  animalTitle: string;
} {
  const humanNames: Record<HumanArchetype, string> = {
    oracle: "Oracle",
    seer: "Neon Seer",
    knight: "Ember Knight",
    void: "Void Prophet",
    cosmic: "Cosmic Oracle",
  };
  const animalNames: Record<AnimalKind, string> = {
    fox: "Fox Spirit",
    cat: "Ember Cat",
    owl: "Moon Owl",
    wolf: "Storm Wolf",
    dragon: "Star Dragon",
    stag: "Spirit Stag",
    phoenix: "Sun Phoenix",
    raven: "Rune Raven",
    serpent: "Frost Serpent",
    bear: "Storm Bear",
  };
  return {
    humanTitle:
      SKIN_HUMAN_LABELS[config.skinSlug] ?? humanNames[config.human],
    animalTitle: animalNames[config.animal],
  };
}

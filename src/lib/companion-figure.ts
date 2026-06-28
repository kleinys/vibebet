import type { Rarity } from "@/lib/supabase/types";
import type { CompanionInput, CompanionState } from "@/lib/vibe-companion";
import { computeCompanion } from "@/lib/vibe-companion";

export type AnimalKind = "fox" | "wolf" | "owl" | "cat" | "dragon";
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
  showHuman: boolean;
  animalScale: number;
  humanScale: number;
  palette: FigurePalette;
  badge: "crown" | "verified" | null;
  hasShield: boolean;
}

const SKIN_TO_ARCHETYPE: Record<string, HumanArchetype> = {
  "default-oracle": "oracle",
  "neon-seer": "seer",
  "void-prophet": "void",
  "cosmic-oracle": "cosmic",
  "ember-knight": "knight",
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
  "neon-seer": "owl",
  "void-prophet": "wolf",
  "cosmic-oracle": "dragon",
  "ember-knight": "cat",
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
  const archetype =
    SKIN_TO_ARCHETYPE[input.equippedSkinSlug ?? "default-oracle"] ?? "oracle";
  const palette = { ...SKIN_PALETTES[archetype] };

  const skinAnimal = input.equippedSkinSlug
    ? ANIMAL_BY_SKIN[input.equippedSkinSlug]
    : undefined;
  const streakAnimal = animalFromStreak(input.currentStreak);
  const itemAnimal = animalFromInventory(
    input.inventoryCount,
    input.skinRarity ?? input.badgeRarity,
  );

  // Prefer skin-linked animal, then higher progression signal
  const animal =
    skinAnimal ??
    ([streakAnimal, itemAnimal] as AnimalKind[]).sort((a, b) => {
      const rank: Record<AnimalKind, number> = {
        fox: 1,
        cat: 2,
        owl: 3,
        wolf: 4,
        dragon: 5,
      };
      return rank[b] - rank[a];
    })[0]!;

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
  };
  return {
    humanTitle: humanNames[config.human],
    animalTitle: animalNames[config.animal],
  };
}

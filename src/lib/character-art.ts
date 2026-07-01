/**
 * Character art tiers for Vibebet companions & shop cosmetics.
 *
 * Tier 0: SVG sprites in companion-sprites.tsx — fast, scalable fallback.
 * Tier 1: PNG/WebP in public/characters/{animal|human}/
 * Tier 2: Animated Lottie or sprite sheets for evolution / idle loops.
 */

import type { AnimalKind, HumanArchetype } from "@/lib/companion-figure";

export type CharacterAssetKind = "animal" | "human" | "icon";

export interface CharacterAssetRef {
  kind: CharacterAssetKind;
  slug: string;
  imagePath: string | null;
  label: string;
}

/** Shop skin slug → human portrait (overrides archetype default) */
export const SKIN_HUMAN_IMAGES: Record<string, string> = {
  "default-oracle": "/characters/humans/oracle-female.png",
  "oracle-sage": "/characters/humans/oracle-male.png",
  "oracle-lunar": "/characters/humans/oracle-lunar.png",
  "oracle-solar": "/characters/humans/oracle-solar.png",
  "neon-seer": "/characters/humans/neon-seer.png",
  "void-prophet": "/characters/humans/void-prophet.png",
  "cosmic-oracle": "/characters/humans/cosmic-oracle.png",
  "ember-knight": "/characters/humans/ember-knight.png",
};

export const ANIMAL_IMAGES: Record<AnimalKind, string> = {
  fox: "/characters/animals/fox-spirit.png",
  cat: "/characters/animals/ember-cat.png",
  owl: "/characters/animals/owl-moon.png",
  wolf: "/characters/animals/storm-wolf.png",
  dragon: "/characters/animals/star-dragon.png",
  stag: "/characters/animals/spirit-stag.png",
  phoenix: "/characters/animals/sun-phoenix.png",
  raven: "/characters/animals/rune-raven.png",
};

export const CHARACTER_ASSETS: CharacterAssetRef[] = [
  { kind: "animal", slug: "fox", imagePath: ANIMAL_IMAGES.fox, label: "Fox Spirit" },
  { kind: "animal", slug: "cat", imagePath: ANIMAL_IMAGES.cat, label: "Ember Cat" },
  { kind: "animal", slug: "owl", imagePath: ANIMAL_IMAGES.owl, label: "Moon Owl" },
  { kind: "animal", slug: "wolf", imagePath: ANIMAL_IMAGES.wolf, label: "Storm Wolf" },
  { kind: "animal", slug: "dragon", imagePath: ANIMAL_IMAGES.dragon, label: "Star Dragon" },
  { kind: "animal", slug: "stag", imagePath: ANIMAL_IMAGES.stag, label: "Spirit Stag" },
  { kind: "animal", slug: "phoenix", imagePath: ANIMAL_IMAGES.phoenix, label: "Sun Phoenix" },
  { kind: "animal", slug: "raven", imagePath: ANIMAL_IMAGES.raven, label: "Rune Raven" },
  {
    kind: "human",
    slug: "oracle",
    imagePath: "/characters/humans/oracle-female.png",
    label: "Oracle",
  },
  {
    kind: "human",
    slug: "oracle-male",
    imagePath: "/characters/humans/oracle-male.png",
    label: "Oracle Sage",
  },
  { kind: "human", slug: "seer", imagePath: "/characters/humans/neon-seer.png", label: "Neon Seer" },
  {
    kind: "human",
    slug: "knight",
    imagePath: "/characters/humans/ember-knight.png",
    label: "Ember Knight",
  },
  {
    kind: "human",
    slug: "void",
    imagePath: "/characters/humans/void-prophet.png",
    label: "Void Prophet",
  },
  {
    kind: "human",
    slug: "cosmic",
    imagePath: "/characters/humans/cosmic-oracle.png",
    label: "Cosmic Oracle",
  },
];

const assetByKey = new Map(
  CHARACTER_ASSETS.map((a) => [`${a.kind}:${a.slug}`, a] as const),
);

export function getCharacterAsset(
  kind: CharacterAssetKind,
  slug: string,
): CharacterAssetRef | undefined {
  return assetByKey.get(`${kind}:${slug}`);
}

export function characterImagePath(
  kind: "animal",
  slug: AnimalKind,
): string | null;
export function characterImagePath(
  kind: "human",
  slug: HumanArchetype,
): string | null;
export function characterImagePath(
  kind: CharacterAssetKind,
  slug: string,
): string | null {
  return getCharacterAsset(kind, slug)?.imagePath ?? null;
}

export function animalImagePath(kind: AnimalKind): string | null {
  return ANIMAL_IMAGES[kind] ?? null;
}

export function humanImagePath(
  archetype: HumanArchetype,
  skinSlug?: string | null,
): string | null {
  if (skinSlug && SKIN_HUMAN_IMAGES[skinSlug]) {
    return SKIN_HUMAN_IMAGES[skinSlug];
  }
  return characterImagePath("human", archetype);
}

export const SKIN_HUMAN_LABELS: Record<string, string> = {
  "default-oracle": "Oracle",
  "oracle-sage": "Oracle Sage",
  "oracle-lunar": "Oracle Lunar",
  "oracle-solar": "Oracle Solar",
  "neon-seer": "Neon Seer",
  "void-prophet": "Void Prophet",
  "cosmic-oracle": "Cosmic Oracle",
  "ember-knight": "Ember Knight",
};

export const CHARACTER_ART_BRIEF = `
Stylized fantasy mobile game art, high-fidelity vector-painterly hybrid,
vibrant bioluminescent glow, soft rim lighting, clean readable silhouette,
centered subject, transparent background, no text, no watermark,
dark navy UI compatible (#020617), emerald teal and violet accents,
ArtStation mobile RPG quality.
`.trim();

export function artBriefFor(subject: string): string {
  return `${subject}, ${CHARACTER_ART_BRIEF}`;
}

/**
 * Character art tiers for Vibebet companions & shop cosmetics.
 *
 * Tier 0: SVG sprites in companion-sprites.tsx — fast, scalable fallback.
 * Tier 1: WebP rasters in public/characters/{animal|human}/ (run npm run compress:characters after PNG updates)
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
  "default-oracle": "/characters/humans/oracle-female.webp",
  "oracle-sage": "/characters/humans/oracle-male.webp",
  "oracle-lunar": "/characters/humans/oracle-lunar.webp",
  "oracle-solar": "/characters/humans/oracle-solar.webp",
  "neon-seer": "/characters/humans/neon-seer.webp",
  "void-prophet": "/characters/humans/void-prophet.webp",
  "cosmic-oracle": "/characters/humans/cosmic-oracle.webp",
  "ember-knight": "/characters/humans/ember-knight.webp",
  "frost-walker": "/characters/humans/frost-walker.webp",
  "storm-titan": "/characters/humans/storm-titan.webp",
  "nebula-ronin": "/characters/humans/nebula-ronin.webp",
  "blood-moon": "/characters/humans/blood-moon.webp",
  "aurora-sage": "/characters/humans/aurora-sage.webp",
};

export const ANIMAL_IMAGES: Record<AnimalKind, string | null> = {
  fox: "/characters/animals/fox-spirit.webp",
  cat: "/characters/animals/ember-cat.webp",
  owl: "/characters/animals/owl-moon.webp",
  wolf: "/characters/animals/storm-wolf.webp",
  dragon: "/characters/animals/star-dragon.webp",
  stag: "/characters/animals/spirit-stag.webp",
  phoenix: "/characters/animals/sun-phoenix.webp",
  raven: "/characters/animals/rune-raven.webp",
  serpent: "/characters/animals/frost-serpent.webp",
  bear: "/characters/animals/storm-bear.webp",
  mantis: "/characters/animals/neon-mantis.webp",
  bat: "/characters/animals/eclipse-bat.webp",
  crane: "/characters/animals/nebula-crane.webp",
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
  { kind: "animal", slug: "serpent", imagePath: ANIMAL_IMAGES.serpent, label: "Frost Serpent" },
  { kind: "animal", slug: "bear", imagePath: ANIMAL_IMAGES.bear, label: "Storm Bear" },
  { kind: "animal", slug: "mantis", imagePath: ANIMAL_IMAGES.mantis, label: "Neon Mantis" },
  { kind: "animal", slug: "bat", imagePath: ANIMAL_IMAGES.bat, label: "Eclipse Bat" },
  { kind: "animal", slug: "crane", imagePath: ANIMAL_IMAGES.crane, label: "Nebula Crane" },
  {
    kind: "human",
    slug: "oracle",
    imagePath: "/characters/humans/oracle-female.webp",
    label: "Oracle",
  },
  {
    kind: "human",
    slug: "oracle-male",
    imagePath: "/characters/humans/oracle-male.webp",
    label: "Oracle Sage",
  },
  { kind: "human", slug: "seer", imagePath: "/characters/humans/neon-seer.webp", label: "Neon Seer" },
  {
    kind: "human",
    slug: "knight",
    imagePath: "/characters/humans/ember-knight.webp",
    label: "Ember Knight",
  },
  {
    kind: "human",
    slug: "void",
    imagePath: "/characters/humans/void-prophet.webp",
    label: "Void Prophet",
  },
  {
    kind: "human",
    slug: "cosmic",
    imagePath: "/characters/humans/cosmic-oracle.webp",
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

const CHARACTER_ART_VERSION = "8";

function withArtVersion(path: string | null): string | null {
  return path ? `${path}?v=${CHARACTER_ART_VERSION}` : null;
}

export function animalImagePath(kind: AnimalKind): string | null {
  return withArtVersion(ANIMAL_IMAGES[kind] ?? null);
}
export function humanImagePath(
  archetype: HumanArchetype,
  skinSlug?: string | null,
): string | null {
  if (skinSlug && SKIN_HUMAN_IMAGES[skinSlug]) {
    return withArtVersion(SKIN_HUMAN_IMAGES[skinSlug]);
  }
  return withArtVersion(characterImagePath("human", archetype));
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
  "frost-walker": "Frost Walker",
  "storm-titan": "Storm Titan",
  "nebula-ronin": "Nebula Ronin",
  "blood-moon": "Blood Moon",
  "aurora-sage": "Aurora Sage",
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

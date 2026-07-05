/**
 * Trinity loadout design — trainer + spirit animal + phenomenon per theme rank.
 *
 * Gameplay rules (target):
 * - Each theme has 3 purchasable pieces (trainer skin, animal unlock, phenomenon orb).
 * - Buff activates only when all 3 of the SAME theme rank are owned.
 * - Ranks 1–6: cosmetic + flavor only (0% EV shift on wheel/case).
 * - Ranks 7–10: proportional buff growth, capped below +50% effective edge until rank 10 (~45% max).
 * - Higher stake cases improve tier odds slightly; never breaks house margin at low ranks.
 *
 * Implementation: shop + inventory kinds (`skin`, `animal`, `phenomenon`) + RPC weight tables (future migration).
 */

import type { AnimalKind } from "@/lib/companion-figure";
import type { SpiritMorphElement } from "@/lib/companion-motion";
import { COMPANION_ROSTER } from "@/lib/companion-roster";
import type { OrbitArchetype } from "@/lib/orbit-affinity";

export type TrinityPiece = "trainer" | "animal" | "phenomenon";

export interface TrinityTheme {
  rank: number;
  skinSlug: string;
  trainerName: string;
  animal: AnimalKind;
  animalName: string;
  morph: SpiritMorphElement;
  archetype: OrbitArchetype;
  /** VIBE price per piece at this rank (exponential). Rank 0 = starter bundle (free). */
  pieceCostVibe: { trainer: number; animal: number; phenomenon: number };
  /** Buff when full trinity owned — EV shift % on locker (0 until rank 7). */
  trinityBuffPercent: number;
  buffLabel: string;
  buffDetail: string;
  /** Small chance to drop a cosmetic fragment on case open (parts system). */
  fragmentChance: number;
}

const ARCHETYPE_BUFF: Record<
  OrbitArchetype,
  { label: string; case: string; wheel: string; fragment: string }
> = {
  volatile: {
    label: "Ember Surge",
    case: "Jackpot tier weight +{n}%",
    wheel: "Top 2 segments widen +{n}%",
    fragment: "Ember shard (jackpot chase)",
  },
  steady: {
    label: "Aegis Floor",
    case: "Worst tier can't go below {n}% of stake",
    wheel: "Loss segments shrink −{n}%",
    fragment: "Aegis plate (loss protection)",
  },
  streak: {
    label: "Chain Spark",
    case: "Win streak adds +{n}% per consecutive open",
    wheel: "Back-to-back spins stack +{n}%",
    fragment: "Chain link (momentum)",
  },
  arcane: {
    label: "Rift Gambit",
    case: "Legendary roll gets +{n}% weight; commons −{n}%",
    wheel: "Jackpot arc widens +{n}%",
    fragment: "Rift sigil (jackpot arc)",
  },
};

function pieceCosts(rank: number): TrinityTheme["pieceCostVibe"] {
  if (rank === 0) return { trainer: 0, animal: 0, phenomenon: 0 };
  const mult = Math.pow(2.15, rank - 1);
  return {
    trainer: Math.round(220 * mult),
    animal: Math.round(180 * mult),
    phenomenon: Math.round(180 * mult),
  };
}

function trinityBuffForRank(rank: number): number {
  if (rank < 7) return 0;
  if (rank === 7) return 8;
  if (rank === 8) return 18;
  if (rank === 9) return 32;
  return 45;
}

const ARCHETYPE_BY_MORPH: Record<SpiritMorphElement, OrbitArchetype> = {
  fire: "volatile",
  forge: "volatile",
  solar: "volatile",
  reddwarf: "volatile",
  lunar: "steady",
  frost: "steady",
  aurora: "steady",
  neon: "steady",
  voidrift: "streak",
  thunder: "streak",
  storm: "streak",
  cosmic: "arcane",
  nebula: "arcane",
  eclipse: "arcane",
  rune: "arcane",
  arcane: "arcane",
};

export const TRINITY_THEMES: TrinityTheme[] = COMPANION_ROSTER.map((entry, index) => {
  const archetype = ARCHETYPE_BY_MORPH[entry.morph];
  const buff = ARCHETYPE_BUFF[archetype];
  const rank = index;
  const n = trinityBuffForRank(rank);
  return {
    rank,
    skinSlug: entry.skinSlug,
    trainerName: entry.trainerName,
    animal: entry.animal,
    animalName: entry.animalName,
    morph: entry.morph,
    archetype,
    pieceCostVibe: pieceCosts(rank),
    trinityBuffPercent: n,
    buffLabel: buff.label,
    buffDetail: buff.case.replace("{n}", String(n || "—")),
    fragmentChance: rank === 0 ? 0.02 : Math.min(0.12, 0.03 + rank * 0.008),
  };
});

export function trinityBySkin(slug: string): TrinityTheme | undefined {
  return TRINITY_THEMES.find((t) => t.skinSlug === slug);
}

/** Whether owned inventory satisfies full trinity (future: check 3 item kinds). */
export function isTrinityComplete(
  ownedSlugs: Set<string>,
  theme: TrinityTheme,
): boolean {
  if (theme.rank === 0) return ownedSlugs.has(theme.skinSlug);
  return (
    ownedSlugs.has(theme.skinSlug) &&
    ownedSlugs.has(`${theme.skinSlug}--animal`) &&
    ownedSlugs.has(`${theme.skinSlug}--phenomenon`)
  );
}

export function effectiveLockerBuffPercent(
  equippedSlug: string | null,
  ownedSlugs: Set<string>,
): number {
  const theme = trinityBySkin(equippedSlug ?? "");
  if (!theme || !isTrinityComplete(ownedSlugs, theme)) return 0;
  return theme.trinityBuffPercent;
}
